/**
 * Sync Queue Manager
 *
 * Manages a persistent queue of sync operations with:
 * - Disk persistence for crash recovery
 * - Exponential backoff for retries
 * - Priority-based processing
 * - Concurrent sync protection
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getClaudeConfigDir } from '../config/claude-settings.ts';
import type { SyncCursor, SyncQueueItem, SyncState } from './types.ts';

/** Maximum retry attempts before giving up */
const MAX_RETRY_ATTEMPTS = 10;

/** Exponential backoff base in milliseconds */
const BACKOFF_BASE_MS = 1000;

/** Maximum backoff time (1 hour) */
const MAX_BACKOFF_MS = 60 * 60 * 1000;

/**
 * Get the path to the sync state file
 */
export function getSyncStatePath(): string {
  const configDir = getClaudeConfigDir();
  if (!configDir) {
    throw new Error('Could not determine Claude config directory');
  }

  const hanDir = join(configDir, 'han');
  mkdirSync(hanDir, { recursive: true });

  return join(hanDir, 'sync-state.json');
}

/**
 * Generate a unique client ID for this installation
 */
function generateClientId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `han-${id}`;
}

/**
 * Load sync state from disk
 */
export function loadSyncState(): SyncState {
  const statePath = getSyncStatePath();

  if (!existsSync(statePath)) {
    return createDefaultState();
  }

  try {
    const content = readFileSync(statePath, 'utf-8');
    const state = JSON.parse(content) as SyncState;

    // Validate and migrate state if needed
    if (!state.clientId) {
      state.clientId = generateClientId();
    }
    if (!state.cursor) {
      state.cursor = createDefaultCursor();
    }
    if (!state.sessionCursors) {
      state.sessionCursors = {};
    }
    if (!state.queue) {
      state.queue = [];
    }
    if (!state.stats) {
      state.stats = {
        totalSynced: 0,
        lastSyncDuration: null,
        failedAttempts: 0,
        successfulSyncs: 0,
      };
    }

    return state;
  } catch (error) {
    console.warn(
      `Failed to load sync state, starting fresh: ${error instanceof Error ? error.message : error}`
    );
    return createDefaultState();
  }
}

/**
 * Save sync state to disk
 */
export function saveSyncState(state: SyncState): void {
  const statePath = getSyncStatePath();

  try {
    writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    console.error(
      `Failed to save sync state: ${error instanceof Error ? error.message : error}`
    );
  }
}

/**
 * Create default sync state
 */
function createDefaultState(): SyncState {
  return {
    clientId: generateClientId(),
    cursor: createDefaultCursor(),
    sessionCursors: {},
    lastFullSync: null,
    queue: [],
    stats: {
      totalSynced: 0,
      lastSyncDuration: null,
      failedAttempts: 0,
      successfulSyncs: 0,
    },
  };
}

/**
 * Create default cursor
 */
function createDefaultCursor(): SyncCursor {
  return {
    lastSessionId: null,
    lastMessageLineNumber: 0,
    lastSyncTimestamp: new Date(0).toISOString(),
  };
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoff(attempts: number): number {
  // 2^attempts * base, capped at max
  const delay = Math.min(BACKOFF_BASE_MS * 2 ** attempts, MAX_BACKOFF_MS);

  // Add jitter (0-10% of delay)
  const jitter = Math.random() * delay * 0.1;

  return Math.floor(delay + jitter);
}

/**
 * Sync Queue Manager class
 */
export class SyncQueueManager {
  private state: SyncState;
  private isProcessing = false;

  constructor() {
    this.state = loadSyncState();
  }

  /**
   * Get the client ID for this installation
   */
  getClientId(): string {
    return this.state.clientId;
  }

  /**
   * Get the global cursor
   */
  getCursor(): SyncCursor {
    return { ...this.state.cursor };
  }

  /**
   * Update the global cursor
   */
  updateCursor(cursor: SyncCursor): void {
    this.state.cursor = cursor;
    saveSyncState(this.state);
  }

  /**
   * Get cursor for a specific session
   */
  getSessionCursor(sessionId: string): SyncCursor {
    return (
      this.state.sessionCursors[sessionId] ?? {
        lastSessionId: sessionId,
        lastMessageLineNumber: 0,
        lastSyncTimestamp: new Date(0).toISOString(),
      }
    );
  }

  /**
   * Update cursor for a specific session
   */
  updateSessionCursor(sessionId: string, cursor: SyncCursor): void {
    this.state.sessionCursors[sessionId] = cursor;
    saveSyncState(this.state);
  }

  /**
   * Add a session to the sync queue
   */
  enqueue(
    sessionId: string,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): SyncQueueItem {
    // Check if already in queue
    const existing = this.state.queue.find(
      (item) => item.sessionId === sessionId && item.status !== 'completed'
    );

    if (existing) {
      // Update priority if higher
      if (
        priority === 'high' ||
        (priority === 'normal' && existing.priority === 'low')
      ) {
        existing.priority = priority;
        saveSyncState(this.state);
      }
      return existing;
    }

    const item: SyncQueueItem = {
      id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sessionId,
      priority,
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastAttempt: null,
      nextRetry: null,
      error: null,
      status: 'pending',
    };

    this.state.queue.push(item);
    saveSyncState(this.state);

    return item;
  }

  /**
   * Get the next item ready for processing
   */
  getNextReady(): SyncQueueItem | null {
    const now = new Date();

    // Sort by priority and creation time
    const ready = this.state.queue
      .filter((item) => {
        if (item.status === 'completed' || item.status === 'in_progress') {
          return false;
        }
        if (item.status === 'failed' && item.attempts >= MAX_RETRY_ATTEMPTS) {
          return false;
        }
        if (item.nextRetry && new Date(item.nextRetry) > now) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Priority order: high > normal > low
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        const priorityDiff =
          priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;

        // Then by creation time (oldest first)
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });

    return ready[0] ?? null;
  }

  /**
   * Mark an item as in progress
   */
  markInProgress(itemId: string): void {
    const item = this.state.queue.find((i) => i.id === itemId);
    if (item) {
      item.status = 'in_progress';
      item.lastAttempt = new Date().toISOString();
      item.attempts++;
      saveSyncState(this.state);
    }
  }

  /**
   * Mark an item as completed
   */
  markCompleted(itemId: string): void {
    const item = this.state.queue.find((i) => i.id === itemId);
    if (item) {
      item.status = 'completed';
      item.error = null;
      this.state.stats.successfulSyncs++;
      saveSyncState(this.state);
    }
  }

  /**
   * Mark an item as failed with retry scheduling
   */
  markFailed(itemId: string, error: string): void {
    const item = this.state.queue.find((i) => i.id === itemId);
    if (item) {
      item.status = 'failed';
      item.error = error;

      // Schedule retry with exponential backoff
      if (item.attempts < MAX_RETRY_ATTEMPTS) {
        const backoffMs = calculateBackoff(item.attempts);
        item.nextRetry = new Date(Date.now() + backoffMs).toISOString();
        item.status = 'pending'; // Back to pending for retry
      }

      this.state.stats.failedAttempts++;
      saveSyncState(this.state);
    }
  }

  /**
   * Get all items in the queue
   */
  getQueue(): SyncQueueItem[] {
    return [...this.state.queue];
  }

  /**
   * Get pending items count
   */
  getPendingCount(): number {
    return this.state.queue.filter(
      (item) => item.status === 'pending' || item.status === 'failed'
    ).length;
  }

  /**
   * Remove completed items older than specified hours
   */
  cleanupCompleted(maxAgeHours = 24): number {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    const before = this.state.queue.length;
    this.state.queue = this.state.queue.filter((item) => {
      if (item.status !== 'completed') return true;
      return new Date(item.createdAt) > cutoff;
    });

    const removed = before - this.state.queue.length;
    if (removed > 0) {
      saveSyncState(this.state);
    }

    return removed;
  }

  /**
   * Remove permanently failed items
   */
  removeFailed(): number {
    const before = this.state.queue.length;
    this.state.queue = this.state.queue.filter(
      (item) =>
        !(item.status === 'failed' && item.attempts >= MAX_RETRY_ATTEMPTS)
    );

    const removed = before - this.state.queue.length;
    if (removed > 0) {
      saveSyncState(this.state);
    }

    return removed;
  }

  /**
   * Get sync statistics
   */
  getStats(): SyncState['stats'] {
    return { ...this.state.stats };
  }

  /**
   * Update sync statistics
   */
  updateStats(update: Partial<SyncState['stats']>): void {
    this.state.stats = { ...this.state.stats, ...update };
    saveSyncState(this.state);
  }

  /**
   * Record sync duration
   */
  recordSyncDuration(durationMs: number): void {
    this.state.stats.lastSyncDuration = durationMs;
    saveSyncState(this.state);
  }

  /**
   * Increment total synced count
   */
  incrementSynced(count: number): void {
    this.state.stats.totalSynced += count;
    saveSyncState(this.state);
  }

  /**
   * Set processing flag (prevents concurrent processing)
   */
  setProcessing(processing: boolean): boolean {
    if (processing && this.isProcessing) {
      return false; // Already processing
    }
    this.isProcessing = processing;
    return true;
  }

  /**
   * Check if currently processing
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Reset the queue (for testing/debugging)
   */
  reset(): void {
    this.state = createDefaultState();
    saveSyncState(this.state);
  }
}

// Singleton instance
let _queueManager: SyncQueueManager | null = null;

/**
 * Get the singleton queue manager instance
 */
export function getQueueManager(): SyncQueueManager {
  if (!_queueManager) {
    _queueManager = new SyncQueueManager();
  }
  return _queueManager;
}

/**
 * Reset the singleton (for testing)
 */
export function _resetQueueManager(): void {
  _queueManager = null;
}
