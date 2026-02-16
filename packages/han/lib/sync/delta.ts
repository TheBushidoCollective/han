/**
 * Delta Calculator for Incremental Sync
 *
 * Calculates what data needs to be synced based on:
 * - Last synced line number per session
 * - Session modification timestamps
 * - Batch size limits
 */

import { createHash } from 'node:crypto';
import type { Message, Project, Repo, Session } from '../grpc/data-access.ts';
import {
  messages,
  nativeTasks,
  projects,
  repos,
  sessions,
} from '../grpc/data-access.ts';
import { checkSyncEligibility } from './privacy-filter.ts';
import { getQueueManager } from './queue.ts';
import type {
  SyncConfig,
  SyncCursor,
  SyncDelta,
  SyncMessage,
  SyncSession,
  SyncTask,
} from './types.ts';

/**
 * Hash content for deduplication (not full content for privacy)
 */
export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Convert a database message to sync format
 */
export function messageToSyncFormat(
  message: Message,
  includeContent: boolean
): SyncMessage {
  const content = message.rawJson ?? '';

  return {
    id: message.id,
    lineNumber: message.lineNumber,
    messageType: message.messageType,
    timestamp: message.timestamp,
    contentHash: hashContent(content),
    content: includeContent ? content : undefined,
    // Token counts not available in current Message type
    inputTokens: null,
    outputTokens: null,
    cacheReadTokens: null,
    cacheCreationTokens: null,
  };
}

/**
 * Map native task status to sync task status
 */
function mapTaskStatus(
  status: string
): 'pending' | 'in_progress' | 'completed' {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'in_progress':
      return 'in_progress';
    default:
      return 'pending';
  }
}

/**
 * Convert database tasks to sync format
 */
async function getTasksForSession(sessionId: string): Promise<SyncTask[]> {
  const tasks = await nativeTasks.getForSession(sessionId);

  return tasks.map((task) => ({
    id: task.id,
    taskId: task.id.split('-').pop() ?? task.id, // Extract task number from ID
    subject: task.subject,
    description: task.description ?? null,
    status: mapTaskStatus(task.status),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }));
}

/**
 * Get new messages for a session since the last sync
 */
async function getNewMessages(
  sessionId: string,
  lastLineNumber: number,
  limit: number,
  includeContent: boolean
): Promise<{ messages: SyncMessage[]; hasMore: boolean }> {
  // Get messages after the last synced line
  const allMessages = await messages.list({
    sessionId,
    limit: limit + 1, // Get one extra to check if there's more
    offset: lastLineNumber,
  });

  const hasMore = allMessages.length > limit;
  const messagesToSync = hasMore ? allMessages.slice(0, limit) : allMessages;

  return {
    messages: messagesToSync.map((msg) =>
      messageToSyncFormat(msg, includeContent)
    ),
    hasMore,
  };
}

/**
 * Extended session info with project and repo data for sync
 */
interface SessionWithContext {
  session: Session;
  project: Project | null;
  repo: Repo | null;
}

/**
 * Get sessions with their associated projects and repos
 */
async function getSessionsWithContext(): Promise<SessionWithContext[]> {
  // Get all sessions
  const allSessions = await sessions.list({ limit: 1000 });

  // Get all projects
  const allProjects = await projects.list();
  const projectMap = new Map<string, Project>();
  for (const project of allProjects) {
    if (project.id) {
      projectMap.set(project.id, project);
    }
  }

  // Get all repos
  const allRepos = await repos.list();
  const repoMap = new Map<string, Repo>();
  for (const repo of allRepos) {
    if (repo.id) {
      repoMap.set(repo.id, repo);
    }
  }

  // Build session context
  return allSessions.map((session) => {
    const project = session.projectId
      ? (projectMap.get(session.projectId) ?? null)
      : null;
    const repoId = project?.repoId;
    const repo = repoId ? (repoMap.get(repoId) ?? null) : null;

    return { session, project, repo };
  });
}

/**
 * Calculate delta for a single session
 */
export async function calculateSessionDelta(
  session: Session,
  project: Project | null,
  repo: Repo | null,
  config: SyncConfig,
  _cursor: SyncCursor
): Promise<SyncSession | null> {
  // Check eligibility
  const eligibility = checkSyncEligibility(session, repo, config);
  if (!eligibility.eligible) {
    return null;
  }

  // Get queue manager for session cursor
  const queueManager = getQueueManager();
  const sessionCursor = queueManager.getSessionCursor(session.id);

  // Get new messages since last sync
  const { messages: newMessages } = await getNewMessages(
    session.id,
    sessionCursor.lastMessageLineNumber,
    config.batchSize,
    config.includeContent
  );

  // No new messages to sync
  if (newMessages.length === 0) {
    return null;
  }

  // Get tasks for the session
  const tasks = await getTasksForSession(session.id);

  // Get total message count for validation
  const totalCount = await messages.count(session.id);

  return {
    id: session.id,
    projectSlug: project?.slug ?? session.projectId ?? '',
    repoRemote: repo?.remote ?? '',
    status: session.status,
    slug: session.slug ?? null,
    messages: newMessages,
    tasks,
    lastModified: new Date().toISOString(), // Session doesn't have updatedAt
    totalMessageCount: totalCount,
  };
}

/**
 * Calculate full delta for all eligible sessions
 */
export async function calculateDelta(config: SyncConfig): Promise<SyncDelta> {
  const queueManager = getQueueManager();
  const cursor = queueManager.getCursor();

  // Get sessions with their context
  const sessionsWithContext = await getSessionsWithContext();

  const syncSessions: SyncSession[] = [];
  let totalNewMessages = 0;
  let hasMore = false;

  for (const { session, project, repo } of sessionsWithContext) {
    // Skip if we've already processed too many messages this batch
    if (totalNewMessages >= config.batchSize) {
      hasMore = true;
      break;
    }

    // Calculate delta for this session
    const sessionDelta = await calculateSessionDelta(
      session,
      project,
      repo,
      config,
      cursor
    );

    if (sessionDelta && sessionDelta.messages.length > 0) {
      syncSessions.push(sessionDelta);
      totalNewMessages += sessionDelta.messages.length;
    }
  }

  // Calculate new cursor based on what we processed
  const newCursor: SyncCursor = {
    lastSessionId:
      syncSessions.length > 0
        ? syncSessions[syncSessions.length - 1].id
        : cursor.lastSessionId,
    lastMessageLineNumber:
      syncSessions.length > 0
        ? Math.max(
            ...syncSessions.map(
              (s) => s.messages[s.messages.length - 1]?.lineNumber ?? 0
            )
          )
        : cursor.lastMessageLineNumber,
    lastSyncTimestamp: new Date().toISOString(),
  };

  return {
    sessions: syncSessions,
    newCursor,
    newMessageCount: totalNewMessages,
    hasMore,
  };
}

/**
 * Calculate delta for a specific session only
 */
export async function calculateSessionOnlyDelta(
  sessionId: string,
  config: SyncConfig
): Promise<SyncDelta> {
  // Get the specific session
  const session = await sessions.get(sessionId);
  if (!session) {
    return {
      sessions: [],
      newCursor: getQueueManager().getCursor(),
      newMessageCount: 0,
      hasMore: false,
    };
  }

  // Get project for this session
  let project: Project | null = null;
  if (session.projectId) {
    const allProjects = await projects.list();
    project = allProjects.find((p) => p.id === session.projectId) ?? null;
  }

  // Get repo for this session (via project)
  let repo: Repo | null = null;
  if (project?.repoId) {
    const allRepos = await repos.list();
    repo = allRepos.find((r) => r.id === project?.repoId) ?? null;
  }

  // Calculate delta for this session
  const queueManager = getQueueManager();
  const cursor = queueManager.getCursor();
  const sessionDelta = await calculateSessionDelta(
    session,
    project,
    repo,
    config,
    cursor
  );

  if (!sessionDelta || sessionDelta.messages.length === 0) {
    return {
      sessions: [],
      newCursor: cursor,
      newMessageCount: 0,
      hasMore: false,
    };
  }

  const newCursor: SyncCursor = {
    lastSessionId: session.id,
    lastMessageLineNumber:
      sessionDelta.messages[sessionDelta.messages.length - 1]?.lineNumber ??
      cursor.lastMessageLineNumber,
    lastSyncTimestamp: new Date().toISOString(),
  };

  return {
    sessions: [sessionDelta],
    newCursor,
    newMessageCount: sessionDelta.messages.length,
    hasMore: false,
  };
}

/**
 * Get sync status summary
 */
export async function getSyncStatus(config: SyncConfig): Promise<{
  pendingSessions: number;
  pendingMessages: number;
  lastSyncTime: string | null;
  eligibleSessions: number;
  excludedSessions: number;
}> {
  const queueManager = getQueueManager();
  const cursor = queueManager.getCursor();

  // Get sessions with their context
  const sessionsWithContext = await getSessionsWithContext();

  let eligibleSessions = 0;
  let excludedSessions = 0;
  let pendingSessions = 0;
  let pendingMessages = 0;

  for (const { session, repo } of sessionsWithContext) {
    const eligibility = checkSyncEligibility(session, repo, config);

    if (eligibility.eligible) {
      eligibleSessions++;

      // Check if this session has unsynced messages
      const sessionCursor = queueManager.getSessionCursor(session.id);
      const totalMessages = await messages.count(session.id);
      const unsyncedCount = totalMessages - sessionCursor.lastMessageLineNumber;

      if (unsyncedCount > 0) {
        pendingSessions++;
        pendingMessages += unsyncedCount;
      }
    } else {
      excludedSessions++;
    }
  }

  return {
    pendingSessions,
    pendingMessages,
    lastSyncTime: cursor.lastSyncTimestamp,
    eligibleSessions,
    excludedSessions,
  };
}
