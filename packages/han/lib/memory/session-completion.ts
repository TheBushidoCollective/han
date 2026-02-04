/**
 * Session Completion Detection
 *
 * Detects when Claude Code sessions appear to be complete based on:
 * - Time gap since last message (default: 30 minutes)
 * - Session status (explicit completion)
 * - Minimum message threshold for meaningful sessions
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { tryGetNativeModule } from '../native.ts';

/**
 * Information about a session's completion status
 */
export interface SessionCompletionStatus {
  sessionId: string;
  isComplete: boolean;
  reason: 'time_gap' | 'explicit_end' | 'status_completed' | 'unknown';
  lastMessageAt: string | null;
  messageCount: number;
}

/**
 * Options for session completion detection
 */
export interface CompletionDetectionOptions {
  /** Minimum minutes since last message to consider complete (default: 30) */
  minGapMinutes?: number;
  /** Maximum sessions to return (default: 50) */
  limit?: number;
  /** Minimum messages for a "meaningful" session (default: 5) */
  minMessages?: number;
  /** Additional cooldown minutes after completion before summary generation (default: 5) */
  cooldownMinutes?: number;
}

/** Default values for completion detection */
const COMPLETION_DEFAULTS = {
  MIN_GAP_MINUTES: 30,
  LIMIT: 50,
  MIN_MESSAGES: 5,
  COOLDOWN_MINUTES: 5, // Extra cooldown to prevent race conditions
} as const;

/**
 * Check if a timestamp is older than the specified gap
 */
export function isSessionComplete(
  lastMessageTimestamp: string | null,
  gapMinutes = 30
): boolean {
  if (!lastMessageTimestamp) return false;

  const lastMsg = new Date(lastMessageTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - lastMsg.getTime();
  return diffMs > gapMinutes * 60 * 1000;
}

/**
 * Detect sessions that appear to be completed but don't have generated summaries yet
 *
 * Criteria for completion:
 * - Last message is older than minGapMinutes + cooldownMinutes
 * - Session has at least minMessages (meaningful session)
 * - No generated summary exists yet
 *
 * The cooldown period prevents race conditions where summary generation starts
 * while the user is still thinking or the assistant is responding slowly.
 */
export async function detectCompletedSessions(
  options: CompletionDetectionOptions = {}
): Promise<SessionCompletionStatus[]> {
  const {
    minGapMinutes = COMPLETION_DEFAULTS.MIN_GAP_MINUTES,
    limit = COMPLETION_DEFAULTS.LIMIT,
    minMessages = COMPLETION_DEFAULTS.MIN_MESSAGES,
    cooldownMinutes = COMPLETION_DEFAULTS.COOLDOWN_MINUTES,
  } = options;

  // Total gap includes both the minimum gap and cooldown period
  const totalGapMinutes = minGapMinutes + cooldownMinutes;

  const nativeModule = tryGetNativeModule();
  if (!nativeModule) {
    console.warn('[session-completion] Native module not available');
    return [];
  }

  const dbPath = join(homedir(), '.claude', 'han', 'han.db');

  // Get sessions without summaries
  const sessionsWithoutSummaries = nativeModule.listSessionsWithoutSummaries(
    dbPath,
    limit * 2 // Get more than we need since we'll filter
  );

  if (sessionsWithoutSummaries.length === 0) {
    return [];
  }

  // Get message counts for these sessions
  const messageCounts = nativeModule.getMessageCountsBatch(
    dbPath,
    sessionsWithoutSummaries
  );

  // Get timestamps for these sessions
  const timestamps = nativeModule.getSessionTimestampsBatch(
    dbPath,
    sessionsWithoutSummaries
  );

  const results: SessionCompletionStatus[] = [];

  for (const sessionId of sessionsWithoutSummaries) {
    const messageCount = messageCounts[sessionId] || 0;
    const ts = timestamps[sessionId];
    const lastMessageAt = ts?.endedAt || null;

    // Skip sessions with too few messages
    if (messageCount < minMessages) {
      continue;
    }

    // Check if session is complete based on time gap (includes cooldown)
    const complete = isSessionComplete(lastMessageAt, totalGapMinutes);

    if (complete) {
      results.push({
        sessionId,
        isComplete: true,
        reason: 'time_gap',
        lastMessageAt,
        messageCount,
      });

      if (results.length >= limit) {
        break;
      }
    }
  }

  return results;
}

/**
 * Get sessions ready for summary generation
 *
 * Returns sessions that:
 * 1. Don't have a generated summary yet
 * 2. Have enough messages to be meaningful
 * 3. Appear to be complete (time gap exceeded)
 */
export async function getSessionsReadyForSummary(
  options: CompletionDetectionOptions = {}
): Promise<string[]> {
  const completedSessions = await detectCompletedSessions(options);
  return completedSessions.filter((s) => s.isComplete).map((s) => s.sessionId);
}
