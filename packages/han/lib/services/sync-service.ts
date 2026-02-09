/**
 * Session Sync Service
 *
 * Syncs local Claude Code sessions to the team server.
 * Features:
 * - Authenticated sync using stored credentials
 * - Session compression
 * - Watch mode for continuous sync
 * - Error handling with retry logic
 * - Basic secret redaction for sensitive data (HIGH-3)
 *
 * SECURITY WARNING (HIGH-3):
 * Session transcripts may contain sensitive information including:
 * - API keys and tokens passed in tool arguments
 * - Environment variables displayed in terminal output
 * - File contents that were read during the session
 * - Credentials in command outputs
 *
 * Basic redaction is applied, but users should be aware that session
 * data is being synced to the team server. Sensitive operations should
 * use environment variables that aren't logged.
 */

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  watch,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { getValidAccessToken } from './auth-service.ts';
import { getServerUrl } from './credentials.ts';

/**
 * Patterns for secret redaction (HIGH-3)
 * These patterns match common secret formats to redact before sync
 */
const SECRET_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // API keys with common prefixes
  { pattern: /\b(sk-[a-zA-Z0-9]{20,})/g, replacement: 'sk-[REDACTED]' },
  { pattern: /\b(pk-[a-zA-Z0-9]{20,})/g, replacement: 'pk-[REDACTED]' },
  {
    pattern: /\b(api[_-]?key['":\s]*)[a-zA-Z0-9]{16,}/gi,
    replacement: '$1[REDACTED]',
  },
  {
    pattern: /\b(api[_-]?secret['":\s]*)[a-zA-Z0-9]{16,}/gi,
    replacement: '$1[REDACTED]',
  },

  // AWS credentials
  { pattern: /\b(AKIA[0-9A-Z]{16})/g, replacement: 'AKIA[REDACTED]' },
  {
    pattern: /\b(aws_secret_access_key['":\s]*)[a-zA-Z0-9/+=]{40}/gi,
    replacement: '$1[REDACTED]',
  },

  // GitHub tokens
  { pattern: /\b(ghp_[a-zA-Z0-9]{36})/g, replacement: 'ghp_[REDACTED]' },
  { pattern: /\b(gho_[a-zA-Z0-9]{36})/g, replacement: 'gho_[REDACTED]' },
  { pattern: /\b(ghu_[a-zA-Z0-9]{36})/g, replacement: 'ghu_[REDACTED]' },
  { pattern: /\b(ghs_[a-zA-Z0-9]{36})/g, replacement: 'ghs_[REDACTED]' },

  // Generic tokens and secrets
  {
    pattern: /\b(token['":\s]*)[a-zA-Z0-9_-]{32,}/gi,
    replacement: '$1[REDACTED]',
  },
  {
    pattern: /\b(secret['":\s]*)[a-zA-Z0-9_-]{32,}/gi,
    replacement: '$1[REDACTED]',
  },
  { pattern: /\b(password['":\s]*)[^\s'"]{8,}/gi, replacement: '$1[REDACTED]' },

  // Bearer tokens in headers
  {
    pattern: /(Authorization['":\s]*Bearer\s+)[a-zA-Z0-9._-]+/gi,
    replacement: '$1[REDACTED]',
  },

  // Private keys
  {
    pattern:
      /(-----BEGIN[A-Z ]*PRIVATE KEY-----)[\s\S]*?(-----END[A-Z ]*PRIVATE KEY-----)/g,
    replacement: '$1\n[REDACTED]\n$2',
  },
];

/**
 * Redact sensitive information from transcript content (HIGH-3)
 *
 * @param content - Raw transcript content
 * @returns Content with secrets redacted
 */
function redactSecrets(content: string): string {
  let redacted = content;
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted;
}

/**
 * Session metadata for sync
 */
interface SessionMetadata {
  id: string;
  projectPath: string | null;
  startTime: string;
  lastActivityTime: string | null;
  messageCount: number;
}

/**
 * Sync payload sent to server
 */
interface SyncPayload {
  version: string;
  sessions: SessionToSync[];
  timestamp: string;
}

/**
 * Session data to sync
 */
interface SessionToSync {
  id: string;
  projectPath: string | null;
  transcript: string; // Gzipped and base64 encoded
  metadata: {
    startTime: string;
    lastActivityTime: string | null;
    messageCount: number;
    transcriptSize: number;
  };
}

/**
 * Sync response from server
 */
interface SyncResponse {
  status: 'success' | 'partial' | 'error';
  processed: number;
  errors?: Array<{
    sessionId: string;
    message: string;
  }>;
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean;
  sessionsProcessed: number;
  error?: string;
  details?: SyncResponse;
}

/**
 * Watch result
 */
export interface WatchResult {
  stop: () => void;
}

/**
 * Get Claude sessions directory
 */
function getSessionsDir(): string {
  return join(homedir(), '.claude', 'projects');
}

/**
 * Get transcript file path for a session
 */
function getTranscriptPath(sessionDir: string): string {
  // Transcripts are stored in session directories as transcript.jsonl
  return join(sessionDir, 'transcript.jsonl');
}

/**
 * List all available sessions
 */
function listSessions(): SessionMetadata[] {
  const sessionsDir = getSessionsDir();

  if (!existsSync(sessionsDir)) {
    return [];
  }

  const sessions: SessionMetadata[] = [];

  try {
    // Each project directory contains session directories
    const projectDirs = readdirSync(sessionsDir, {
      withFileTypes: true,
    }).filter((d) => d.isDirectory());

    for (const projectDir of projectDirs) {
      const projectPath = join(sessionsDir, projectDir.name);
      const sessionDirs = readdirSync(projectPath, {
        withFileTypes: true,
      }).filter((d) => d.isDirectory());

      for (const sessionDir of sessionDirs) {
        const sessionPath = join(projectPath, sessionDir.name);
        const transcriptPath = getTranscriptPath(sessionPath);

        if (!existsSync(transcriptPath)) {
          continue;
        }

        try {
          const stats = statSync(transcriptPath);
          const content = readFileSync(transcriptPath, 'utf-8');
          const lines = content.trim().split('\n').filter(Boolean);
          const messageCount = lines.length;

          // Parse first and last lines for timestamps
          let startTime = stats.birthtime.toISOString();
          let lastActivityTime = stats.mtime.toISOString();

          if (lines.length > 0) {
            try {
              const firstMessage = JSON.parse(lines[0]);
              if (firstMessage.timestamp) {
                startTime = firstMessage.timestamp;
              }
              const lastMessage = JSON.parse(lines[lines.length - 1]);
              if (lastMessage.timestamp) {
                lastActivityTime = lastMessage.timestamp;
              }
            } catch {
              // Use file stats
            }
          }

          sessions.push({
            id: sessionDir.name,
            projectPath: decodeURIComponent(projectDir.name),
            startTime,
            lastActivityTime,
            messageCount,
          });
        } catch {
          // Skip invalid sessions
        }
      }
    }
  } catch {
    // Return empty if unable to read
  }

  return sessions;
}

/**
 * Get session by ID
 */
function getSessionById(sessionId: string): SessionMetadata | null {
  const sessions = listSessions();
  return sessions.find((s) => s.id === sessionId) || null;
}

/**
 * Read, redact secrets, and compress session transcript (HIGH-3)
 */
function readSessionTranscript(
  sessionId: string
): { data: string; size: number } | null {
  const sessionsDir = getSessionsDir();

  if (!existsSync(sessionsDir)) {
    return null;
  }

  // Find the session across all project directories
  const projectDirs = readdirSync(sessionsDir, { withFileTypes: true }).filter(
    (d) => d.isDirectory()
  );

  for (const projectDir of projectDirs) {
    const sessionPath = join(sessionsDir, projectDir.name, sessionId);
    const transcriptPath = getTranscriptPath(sessionPath);

    if (existsSync(transcriptPath)) {
      try {
        const content = readFileSync(transcriptPath, 'utf-8');
        // Redact sensitive information before syncing (HIGH-3)
        const redactedContent = redactSecrets(content);
        const compressed = gzipSync(Buffer.from(redactedContent, 'utf-8'));
        return {
          data: compressed.toString('base64'),
          size: redactedContent.length,
        };
      } catch {
        return null;
      }
    }
  }

  return null;
}

/**
 * Sync a specific session to the server
 *
 * @param sessionId - Session ID to sync
 * @returns Sync result
 */
export async function syncSession(sessionId: string): Promise<SyncResult> {
  // Check authentication
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return {
      success: false,
      sessionsProcessed: 0,
      error: "Not authenticated. Please run 'han auth login' first.",
    };
  }

  // Get session metadata
  const session = getSessionById(sessionId);
  if (!session) {
    return {
      success: false,
      sessionsProcessed: 0,
      error: `Session not found: ${sessionId}`,
    };
  }

  // Read transcript
  const transcript = readSessionTranscript(sessionId);
  if (!transcript) {
    return {
      success: false,
      sessionsProcessed: 0,
      error: `Could not read transcript for session: ${sessionId}`,
    };
  }

  // Build payload
  const payload: SyncPayload = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    sessions: [
      {
        id: session.id,
        projectPath: session.projectPath,
        transcript: transcript.data,
        metadata: {
          startTime: session.startTime,
          lastActivityTime: session.lastActivityTime,
          messageCount: session.messageCount,
          transcriptSize: transcript.size,
        },
      },
    ],
  };

  // Send to server
  const serverUrl = getServerUrl();
  try {
    const response = await fetch(`${serverUrl}/api/v1/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        sessionsProcessed: 0,
        error: `Server error: ${response.status} - ${error}`,
      };
    }

    const result = (await response.json()) as SyncResponse;

    return {
      success: result.status === 'success',
      sessionsProcessed: result.processed,
      details: result,
      error:
        result.status === 'error'
          ? result.errors?.map((e) => e.message).join('; ')
          : undefined,
    };
  } catch (error) {
    return {
      success: false,
      sessionsProcessed: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Sync all sessions to the server
 *
 * @returns Sync result
 */
export async function syncAllSessions(): Promise<SyncResult> {
  // Check authentication
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return {
      success: false,
      sessionsProcessed: 0,
      error: "Not authenticated. Please run 'han auth login' first.",
    };
  }

  // Get all sessions
  const sessions = listSessions();
  if (sessions.length === 0) {
    return {
      success: true,
      sessionsProcessed: 0,
    };
  }

  // Build payload with all sessions
  const sessionsToSync: SessionToSync[] = [];

  for (const session of sessions) {
    const transcript = readSessionTranscript(session.id);
    if (transcript) {
      sessionsToSync.push({
        id: session.id,
        projectPath: session.projectPath,
        transcript: transcript.data,
        metadata: {
          startTime: session.startTime,
          lastActivityTime: session.lastActivityTime,
          messageCount: session.messageCount,
          transcriptSize: transcript.size,
        },
      });
    }
  }

  if (sessionsToSync.length === 0) {
    return {
      success: true,
      sessionsProcessed: 0,
    };
  }

  const payload: SyncPayload = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    sessions: sessionsToSync,
  };

  // Send to server
  const serverUrl = getServerUrl();
  try {
    const response = await fetch(`${serverUrl}/api/v1/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        sessionsProcessed: 0,
        error: `Server error: ${response.status} - ${error}`,
      };
    }

    const result = (await response.json()) as SyncResponse;

    return {
      success: result.status === 'success',
      sessionsProcessed: result.processed,
      details: result,
      error:
        result.status === 'error'
          ? result.errors?.map((e) => e.message).join('; ')
          : undefined,
    };
  } catch (error) {
    return {
      success: false,
      sessionsProcessed: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Watch for session changes and sync continuously
 *
 * @param interval - Sync interval in milliseconds (default: 60 seconds)
 * @param onSync - Callback when sync completes
 * @returns Object with stop function
 */
export function watchAndSync(
  interval = 60_000,
  onSync?: (result: SyncResult) => void
): WatchResult {
  let running = true;
  let lastSyncTime = 0;
  const syncedSessions = new Set<string>();

  // Track file changes
  const changedSessions = new Set<string>();

  // Set up file watcher
  const sessionsDir = getSessionsDir();
  let watcher: ReturnType<typeof watch> | null = null;

  if (existsSync(sessionsDir)) {
    watcher = watch(
      sessionsDir,
      { recursive: true },
      (_eventType, filename) => {
        if (filename?.endsWith('transcript.jsonl')) {
          // Extract session ID from path
          const parts = filename.split('/');
          if (parts.length >= 2) {
            changedSessions.add(parts[parts.length - 2]);
          }
        }
      }
    );
  }

  // Sync loop
  const syncLoop = async () => {
    while (running) {
      const now = Date.now();

      // Check if it's time to sync
      if (now - lastSyncTime >= interval && changedSessions.size > 0) {
        lastSyncTime = now;

        // Get sessions to sync
        const sessionsToSync = Array.from(changedSessions);
        changedSessions.clear();

        // Sync each changed session
        for (const sessionId of sessionsToSync) {
          if (!running) break;

          const result = await syncSession(sessionId);
          onSync?.(result);

          if (result.success) {
            syncedSessions.add(sessionId);
          } else {
            // Re-add for retry
            changedSessions.add(sessionId);
          }
        }
      }

      // Wait a bit before checking again
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  };

  // Start the loop
  syncLoop().catch(console.error);

  // Initial sync of all sessions
  syncAllSessions()
    .then((result) => {
      onSync?.(result);
    })
    .catch(console.error);

  return {
    stop: () => {
      running = false;
      watcher?.close();
    },
  };
}

/**
 * Get sync status for sessions
 */
export function getSyncableSessionCount(): number {
  return listSessions().length;
}
