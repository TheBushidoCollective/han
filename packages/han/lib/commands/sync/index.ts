/**
 * Sync CLI Commands
 *
 * Commands for managing data synchronization to the team platform:
 * - han sync status - Show sync status and configuration
 * - han sync session <id> - Sync a specific session
 * - han sync all - Sync all pending sessions
 * - han sync queue - Show and manage the sync queue
 * - han sync watch - Continuously sync on session changes
 */

import type { Command } from 'commander';
import { getSyncConfig, isSyncEnabled } from '../../config/han-settings.ts';
import {
  syncAllSessions as authSyncAllSessions,
  syncSession as authSyncSession,
  getAuthStatus,
  getSyncableSessionCount,
  watchAndSync,
} from '../../services/index.ts';
import {
  enqueuePendingSessions,
  getStatus,
  processQueue,
  sync,
} from '../../sync/client.ts';
import { getQueueManager } from '../../sync/queue.ts';

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

/**
 * Format duration to human readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Format timestamp to relative time
 */
function formatRelativeTime(timestamp: string | null): string {
  if (!timestamp) return 'never';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 60000) return 'just now';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)} minutes ago`;
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)} hours ago`;
  return `${Math.floor(diffMs / 86400000)} days ago`;
}

/**
 * Register sync commands
 */
export function registerSyncCommands(program: Command): void {
  const syncCommand = program
    .command('sync')
    .description('Manage data synchronization to team platform');

  // sync status
  syncCommand
    .command('status')
    .description('Show sync status and configuration')
    .action(async () => {
      try {
        const status = await getStatus();
        const config = getSyncConfig();

        console.log('\n=== Han Sync Status ===\n');

        // Configuration
        console.log('Configuration:');
        console.log(
          `  Enabled:     ${status.enabled ? '\x1b[32myes\x1b[0m' : '\x1b[33mno\x1b[0m'}`
        );
        console.log(
          `  Configured:  ${status.configured ? '\x1b[32myes\x1b[0m' : '\x1b[31mno\x1b[0m'}`
        );
        if (status.endpoint) {
          console.log(`  Endpoint:    ${status.endpoint}`);
        }
        if (config) {
          console.log(`  Batch Size:  ${config.batchSize ?? 1000} messages`);
          console.log(`  Interval:    ${config.interval ?? 300}s`);
          console.log(
            `  Compression: ${config.compression !== false ? 'yes' : 'no'}`
          );
          console.log(
            `  Personal:    ${config.includePersonal ? 'included' : 'excluded'}`
          );
        }

        console.log('\nSync Status:');
        console.log(
          `  Last Sync:        ${formatRelativeTime(status.lastSyncTime)}`
        );
        console.log(`  Queue Size:       ${status.queueSize} items`);
        console.log(`  Pending Sessions: ${status.pendingSessions}`);
        console.log(`  Pending Messages: ${status.pendingMessages}`);

        console.log('\nSession Eligibility:');
        console.log(`  Eligible:  ${status.eligibleSessions}`);
        console.log(`  Excluded:  ${status.excludedSessions}`);

        console.log('\nStatistics:');
        console.log(
          `  Total Synced:      ${status.stats.totalSynced} messages`
        );
        console.log(`  Successful Syncs:  ${status.stats.successfulSyncs}`);
        console.log(`  Failed Attempts:   ${status.stats.failedAttempts}`);
        if (status.stats.lastSyncDuration) {
          console.log(
            `  Last Duration:     ${formatDuration(status.stats.lastSyncDuration)}`
          );
        }

        if (!status.enabled) {
          console.log('\n\x1b[33mSync is disabled.\x1b[0m');
          console.log('To enable, add to han.yml:');
          console.log('  sync:');
          console.log('    enabled: true');
          console.log('    endpoint: https://your-team-platform.com/api/sync');
          console.log('    apiKey: han_xxx (or set HAN_SYNC_API_KEY env var)');
        }

        console.log('');
      } catch (error) {
        console.error(
          'Error getting sync status:',
          error instanceof Error ? error.message : error
        );
        process.exit(1);
      }
    });

  // sync session <id>
  syncCommand
    .command('session <sessionId>')
    .description('Sync a specific session immediately')
    .option('--force', 'Force sync even if sync is disabled')
    .action(async (sessionId: string, options: { force?: boolean }) => {
      try {
        if (!options.force && !isSyncEnabled()) {
          console.log('\x1b[33mSync is not enabled.\x1b[0m');
          console.log('Use --force to sync anyway, or enable sync in han.yml');
          process.exit(1);
        }

        console.log(`Syncing session ${sessionId}...`);

        const result = await sync({
          sessionId,
          force: options.force,
        });

        if (result.success) {
          console.log('\x1b[32mSync successful!\x1b[0m');
          console.log(`  Sessions: ${result.sessionsProcessed}`);
          console.log(`  Messages: ${result.messagesProcessed}`);
          console.log(`  Transferred: ${formatBytes(result.bytesTransferred)}`);
          console.log(`  Duration: ${formatDuration(result.durationMs)}`);
        } else {
          console.log('\x1b[31mSync failed:\x1b[0m', result.error);
          process.exit(1);
        }
      } catch (error) {
        console.error(
          'Error syncing session:',
          error instanceof Error ? error.message : error
        );
        process.exit(1);
      }
    });

  // sync all
  syncCommand
    .command('all')
    .description('Sync all pending sessions')
    .option('--force', 'Force sync even if sync is disabled')
    .option('--enqueue-only', 'Only add sessions to queue, do not process')
    .action(async (options: { force?: boolean; enqueueOnly?: boolean }) => {
      try {
        if (!options.force && !isSyncEnabled()) {
          console.log('\x1b[33mSync is not enabled.\x1b[0m');
          console.log('Use --force to sync anyway, or enable sync in han.yml');
          process.exit(1);
        }

        if (options.enqueueOnly) {
          console.log('Enqueueing pending sessions...');
          const enqueued = await enqueuePendingSessions();
          console.log(`Enqueued ${enqueued} sessions for sync.`);
          return;
        }

        console.log('Syncing all pending sessions...');

        const result = await sync({ force: options.force });

        if (result.success) {
          console.log('\x1b[32mSync successful!\x1b[0m');
          console.log(`  Sessions: ${result.sessionsProcessed}`);
          console.log(`  Messages: ${result.messagesProcessed}`);
          console.log(`  Transferred: ${formatBytes(result.bytesTransferred)}`);
          console.log(`  Duration: ${formatDuration(result.durationMs)}`);

          if (result.response?.errors && result.response.errors.length > 0) {
            console.log('\n\x1b[33mWarnings:\x1b[0m');
            for (const err of result.response.errors) {
              console.log(`  ${err.sessionId}: ${err.message}`);
            }
          }
        } else {
          console.log('\x1b[31mSync failed:\x1b[0m', result.error);
          process.exit(1);
        }
      } catch (error) {
        console.error(
          'Error syncing:',
          error instanceof Error ? error.message : error
        );
        process.exit(1);
      }
    });

  // sync queue
  syncCommand
    .command('queue')
    .description('Show and manage the sync queue')
    .option('--process', 'Process pending items in the queue')
    .option('--clear-completed', 'Remove completed items from queue')
    .option('--clear-failed', 'Remove permanently failed items from queue')
    .option('--reset', 'Reset the entire queue (dangerous)')
    .action(
      async (options: {
        process?: boolean;
        clearCompleted?: boolean;
        clearFailed?: boolean;
        reset?: boolean;
      }) => {
        try {
          const queueManager = getQueueManager();

          if (options.reset) {
            console.log('\x1b[31mResetting sync queue...\x1b[0m');
            queueManager.reset();
            console.log('Queue has been reset.');
            return;
          }

          if (options.clearCompleted) {
            const removed = queueManager.cleanupCompleted();
            console.log(`Removed ${removed} completed items from queue.`);
            return;
          }

          if (options.clearFailed) {
            const removed = queueManager.removeFailed();
            console.log(
              `Removed ${removed} permanently failed items from queue.`
            );
            return;
          }

          if (options.process) {
            console.log('Processing sync queue...');
            const result = await processQueue({ maxItems: 10 });
            console.log(`\nProcessed: ${result.processed}`);
            console.log(`Succeeded: ${result.succeeded}`);
            console.log(`Failed: ${result.failed}`);
            if (result.errors.length > 0) {
              console.log('\nErrors:');
              for (const err of result.errors) {
                console.log(`  ${err}`);
              }
            }
            return;
          }

          // Show queue status
          const queue = queueManager.getQueue();

          console.log('\n=== Sync Queue ===\n');
          console.log(`Total items: ${queue.length}`);
          console.log(
            `Pending: ${queue.filter((i) => i.status === 'pending').length}`
          );
          console.log(
            `In Progress: ${queue.filter((i) => i.status === 'in_progress').length}`
          );
          console.log(
            `Completed: ${queue.filter((i) => i.status === 'completed').length}`
          );
          console.log(
            `Failed: ${queue.filter((i) => i.status === 'failed').length}`
          );

          if (queue.length > 0) {
            console.log('\nRecent items:');
            const recent = queue.slice(-10);
            for (const item of recent) {
              const statusColor =
                item.status === 'completed'
                  ? '\x1b[32m'
                  : item.status === 'failed'
                    ? '\x1b[31m'
                    : item.status === 'in_progress'
                      ? '\x1b[34m'
                      : '\x1b[33m';
              console.log(
                `  ${statusColor}[${item.status}]\x1b[0m ${item.sessionId.slice(0, 8)}... ` +
                  `(${item.priority}, attempts: ${item.attempts})`
              );
              if (item.error) {
                console.log(`    Error: ${item.error}`);
              }
              if (item.nextRetry) {
                console.log(
                  `    Next retry: ${formatRelativeTime(item.nextRetry)}`
                );
              }
            }
          }

          console.log('');
        } catch (error) {
          console.error(
            'Error managing queue:',
            error instanceof Error ? error.message : error
          );
          process.exit(1);
        }
      }
    );

  // sync enqueue <sessionId>
  syncCommand
    .command('enqueue <sessionId>')
    .description('Add a session to the sync queue')
    .option('--priority <level>', 'Priority level: high, normal, low', 'normal')
    .action(async (sessionId: string, options: { priority: string }) => {
      try {
        const priority = options.priority as 'high' | 'normal' | 'low';
        if (!['high', 'normal', 'low'].includes(priority)) {
          console.error('Priority must be "high", "normal", or "low"');
          process.exit(1);
        }

        const queueManager = getQueueManager();
        const item = queueManager.enqueue(sessionId, priority);

        console.log(`Added to queue: ${item.id}`);
        console.log(`  Session: ${sessionId}`);
        console.log(`  Priority: ${priority}`);
      } catch (error) {
        console.error(
          'Error enqueueing session:',
          error instanceof Error ? error.message : error
        );
        process.exit(1);
      }
    });

  // sync watch - Continuously sync on session changes (requires auth)
  syncCommand
    .command('watch')
    .description(
      'Continuously sync sessions on changes (requires authentication)'
    )
    .option('-i, --interval <seconds>', 'Sync interval in seconds', '60')
    .action(async (options: { interval?: string }) => {
      // Check authentication
      const authStatus = getAuthStatus();
      if (!authStatus.authenticated) {
        console.error('\x1b[31mNot authenticated.\x1b[0m');
        console.log("Run 'han auth login' first to authenticate.");
        process.exit(1);
      }

      const interval = parseInt(options.interval || '60', 10) * 1000;
      const sessionCount = getSyncableSessionCount();

      console.log(`\n=== Han Sync Watch Mode ===\n`);
      console.log(`Server: ${authStatus.serverUrl}`);
      console.log(
        `User: ${authStatus.user?.github_username || authStatus.user?.email || 'unknown'}`
      );
      console.log(`Sessions: ${sessionCount} available`);
      console.log(`Interval: ${interval / 1000}s\n`);
      console.log('Watching for session changes. Press Ctrl+C to stop.\n');

      const watcher = watchAndSync(interval, (result) => {
        const timestamp = new Date().toLocaleTimeString();
        if (result.success) {
          if (result.sessionsProcessed > 0) {
            console.log(
              `[${timestamp}] \x1b[32mSynced ${result.sessionsProcessed} session(s)\x1b[0m`
            );
          }
        } else {
          console.log(
            `[${timestamp}] \x1b[31mSync failed: ${result.error}\x1b[0m`
          );
        }
      });

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n\nStopping watch mode...');
        watcher.stop();
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        watcher.stop();
        process.exit(0);
      });

      // Keep process running
      await new Promise(() => {});
    });

  // sync upload <sessionId> - Sync using OAuth authentication (new command)
  syncCommand
    .command('upload [sessionId]')
    .description('Upload session(s) to team server using OAuth authentication')
    .option('-a, --all', 'Upload all sessions')
    .action(
      async (sessionId: string | undefined, options: { all?: boolean }) => {
        // Check authentication
        const authStatus = getAuthStatus();
        if (!authStatus.authenticated) {
          console.error('\x1b[31mNot authenticated.\x1b[0m');
          console.log("Run 'han auth login' first to authenticate.");
          process.exit(1);
        }

        console.log(`\nServer: ${authStatus.serverUrl}`);
        console.log(
          `User: ${authStatus.user?.github_username || authStatus.user?.email || 'unknown'}\n`
        );

        if (options.all || !sessionId) {
          console.log('Uploading all sessions...');
          const result = await authSyncAllSessions();

          if (result.success) {
            console.log(
              `\x1b[32mSuccessfully uploaded ${result.sessionsProcessed} session(s).\x1b[0m`
            );
          } else {
            console.error(`\x1b[31mUpload failed:\x1b[0m ${result.error}`);
            process.exit(1);
          }
        } else {
          console.log(`Uploading session ${sessionId}...`);
          const result = await authSyncSession(sessionId);

          if (result.success) {
            console.log(`\x1b[32mSuccessfully uploaded session.\x1b[0m`);
          } else {
            console.error(`\x1b[31mUpload failed:\x1b[0m ${result.error}`);
            process.exit(1);
          }
        }
      }
    );
}
