/**
 * File watcher for memory directories
 *
 * Monitors memory directories for changes and emits events for SSE streaming.
 * Watches:
 * - ~/.claude/han/memory/personal/sessions/ (session observations)
 * - ~/.claude/han/memory/personal/summaries/ (session summaries)
 * - ~/.claude/rules/ and .claude/rules/ (project rules)
 * - ~/.claude/han/memory/projects/ (team memory)
 */

import { existsSync, type FSWatcher, watch } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  getMemoryRoot,
  getSessionsPath,
  getSummariesPath,
} from '../../memory/paths.ts';

/**
 * Event types for memory changes
 */
export interface MemoryEvent {
  type: 'session' | 'summary' | 'rule' | 'observation' | 'team';
  action: 'created' | 'updated' | 'deleted';
  path: string;
  timestamp: number;
}

/**
 * Callback for memory events
 */
export type WatchCallback = (event: MemoryEvent) => void;

/**
 * Memory watcher interface
 */
export interface MemoryWatcher {
  start(): void;
  stop(): void;
}

/**
 * Debounce function to prevent event flooding
 */
function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delay: number
): (...args: TArgs) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  return (...args: TArgs) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Track recent events to deduplicate rapid changes to the same file
 */
interface EventTracker {
  lastEvent: Map<string, { action: string; timestamp: number }>;
  cleanup(): void;
}

function createEventTracker(): EventTracker {
  const lastEvent = new Map<string, { action: string; timestamp: number }>();
  let cleanupInterval: NodeJS.Timeout | null = null;

  // Clean up old entries every 30 seconds
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of lastEvent) {
      if (now - value.timestamp > 30000) {
        lastEvent.delete(key);
      }
    }
  }, 30000);

  return {
    lastEvent,
    cleanup() {
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
      }
      lastEvent.clear();
    },
  };
}

/**
 * Determine event type from file path
 */
function getEventType(
  _filePath: string,
  watchType: 'sessions' | 'summaries' | 'rules' | 'team' | 'claudeProjects'
): MemoryEvent['type'] {
  switch (watchType) {
    case 'sessions':
    case 'claudeProjects':
      return 'session';
    case 'summaries':
      return 'summary';
    case 'rules':
      return 'rule';
    case 'team':
      return 'team';
    default:
      return 'observation';
  }
}

/**
 * Determine action from fs.watch event type
 */
function getAction(
  eventType: string,
  filePath: string
): MemoryEvent['action'] | null {
  // fs.watch returns "rename" for both create and delete
  // and "change" for modifications
  if (eventType === 'change') {
    return 'updated';
  }

  if (eventType === 'rename') {
    // Check if file exists to determine create vs delete
    if (existsSync(filePath)) {
      return 'created';
    }
    return 'deleted';
  }

  return null;
}

/**
 * Check if a filename matches expected patterns for a directory type
 */
function isValidFile(
  filename: string,
  watchType: 'sessions' | 'summaries' | 'rules' | 'team' | 'claudeProjects'
): boolean {
  switch (watchType) {
    case 'sessions':
    case 'claudeProjects':
      return filename.endsWith('.jsonl');
    case 'summaries':
      return filename.endsWith('.yaml') || filename.endsWith('.json');
    case 'rules':
      return filename.endsWith('.md');
    case 'team':
      // Team memory can have various index files
      return true;
    default:
      return false;
  }
}

/**
 * Create a watcher for a specific directory
 */
function createDirWatcher(
  dirPath: string,
  watchType: 'sessions' | 'summaries' | 'rules' | 'team' | 'claudeProjects',
  callback: WatchCallback,
  eventTracker: EventTracker
): FSWatcher | null {
  // Don't create watcher if directory doesn't exist
  if (!existsSync(dirPath)) {
    return null;
  }

  try {
    const watcher = watch(
      dirPath,
      { recursive: true },
      (eventType, filename) => {
        if (!filename) return;

        // Filter out non-matching files
        if (!isValidFile(filename, watchType)) return;

        const fullPath = join(dirPath, filename);
        const action = getAction(eventType, fullPath);

        if (!action) return;

        // Deduplicate: check if we've seen this exact event recently
        const eventKey = `${fullPath}:${action}`;
        const lastSeen = eventTracker.lastEvent.get(eventKey);
        const now = Date.now();

        if (lastSeen && now - lastSeen.timestamp < 100) {
          // Skip duplicate events within 100ms
          return;
        }

        eventTracker.lastEvent.set(eventKey, { action, timestamp: now });

        const event: MemoryEvent = {
          type: getEventType(fullPath, watchType),
          action,
          path: fullPath,
          timestamp: now,
        };

        callback(event);
      }
    );

    return watcher;
  } catch (_error) {
    // Silently fail - directory may not be accessible
    return null;
  }
}

/**
 * Get paths to watch for memory events
 */
export function getWatchPaths(): {
  sessions: string;
  summaries: string;
  userRules: string;
  projectRules: string;
  teamMemory: string;
  claudeProjects: string;
} {
  const home = homedir();
  return {
    sessions: getSessionsPath(),
    summaries: getSummariesPath(),
    userRules: join(home, '.claude', 'rules'),
    projectRules: join(process.cwd(), '.claude', 'rules'),
    teamMemory: join(getMemoryRoot(), 'projects'),
    // Claude Code native project sessions
    claudeProjects: join(home, '.claude', 'projects'),
  };
}

/**
 * Create a memory watcher that monitors all memory directories
 *
 * @param callback Function called when a memory event occurs
 * @param debounceMs Debounce delay in milliseconds (default: 100)
 * @returns MemoryWatcher with start() and stop() methods
 *
 * @example
 * ```ts
 * const watcher = createMemoryWatcher((event) => {
 *   console.log(`${event.type} ${event.action}: ${event.path}`);
 * });
 *
 * watcher.start();
 * // ... later
 * watcher.stop();
 * ```
 */
export function createMemoryWatcher(
  callback: WatchCallback,
  debounceMs = 100
): MemoryWatcher {
  const watchers: FSWatcher[] = [];
  let started = false;
  let eventTracker: EventTracker | null = null;

  // Create debounced callback
  const debouncedCallback = debounce(callback, debounceMs);

  return {
    start(): void {
      if (started) return;
      started = true;

      eventTracker = createEventTracker();
      const paths = getWatchPaths();

      // Watch sessions directory
      const sessionsWatcher = createDirWatcher(
        paths.sessions,
        'sessions',
        debouncedCallback,
        eventTracker
      );
      if (sessionsWatcher) watchers.push(sessionsWatcher);

      // Watch summaries directory
      const summariesWatcher = createDirWatcher(
        paths.summaries,
        'summaries',
        debouncedCallback,
        eventTracker
      );
      if (summariesWatcher) watchers.push(summariesWatcher);

      // Watch user rules directory
      const userRulesWatcher = createDirWatcher(
        paths.userRules,
        'rules',
        debouncedCallback,
        eventTracker
      );
      if (userRulesWatcher) watchers.push(userRulesWatcher);

      // Watch project rules directory (if different from user rules)
      if (paths.projectRules !== paths.userRules) {
        const projectRulesWatcher = createDirWatcher(
          paths.projectRules,
          'rules',
          debouncedCallback,
          eventTracker
        );
        if (projectRulesWatcher) watchers.push(projectRulesWatcher);
      }

      // Watch team memory directory
      const teamWatcher = createDirWatcher(
        paths.teamMemory,
        'team',
        debouncedCallback,
        eventTracker
      );
      if (teamWatcher) watchers.push(teamWatcher);

      // Watch Claude Code native project sessions for real-time updates
      const claudeProjectsWatcher = createDirWatcher(
        paths.claudeProjects,
        'claudeProjects',
        debouncedCallback,
        eventTracker
      );
      if (claudeProjectsWatcher) watchers.push(claudeProjectsWatcher);
    },

    stop(): void {
      if (!started) return;
      started = false;

      // Close all watchers
      for (const watcher of watchers) {
        try {
          watcher.close();
        } catch {
          // Ignore errors when closing
        }
      }
      watchers.length = 0;

      // Cleanup event tracker
      if (eventTracker) {
        eventTracker.cleanup();
        eventTracker = null;
      }
    },
  };
}

/**
 * Create a single directory watcher (useful for targeted watching)
 *
 * @param dirPath Directory to watch
 * @param type Type of content in the directory
 * @param callback Function called when changes occur
 */
export function watchDirectory(
  dirPath: string,
  type: 'sessions' | 'summaries' | 'rules' | 'team' | 'claudeProjects',
  callback: WatchCallback
): MemoryWatcher {
  let watcher: FSWatcher | null = null;
  let eventTracker: EventTracker | null = null;

  return {
    start(): void {
      if (watcher) return;
      eventTracker = createEventTracker();
      watcher = createDirWatcher(dirPath, type, callback, eventTracker);
    },

    stop(): void {
      if (watcher) {
        try {
          watcher.close();
        } catch {
          // Ignore errors
        }
        watcher = null;
      }
      if (eventTracker) {
        eventTracker.cleanup();
        eventTracker = null;
      }
    },
  };
}
