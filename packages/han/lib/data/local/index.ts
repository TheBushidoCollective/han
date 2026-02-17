/**
 * LocalDataSource Implementation
 *
 * Wraps gRPC data access operations into the DataSource interface.
 * This is a thin wrapper that delegates all calls to the gRPC data access layer.
 *
 * Used when running in local mode (han browse on developer machine).
 */

import type { Session } from '../../grpc/data-access.ts';
import * as db from '../../grpc/data-access.ts';
import type {
  Connection,
  ConnectionArgs,
  DataSource,
  HookStatsOptions,
  MessageListOptions,
  MessageSearchOptions,
  SessionListOptions,
  TaskMetricsOptions,
} from '../interfaces.ts';

/**
 * LocalDataSource implementation
 *
 * Wraps the gRPC data access layer operations.
 * All methods are thin wrappers that delegate to the gRPC client.
 */
export class LocalDataSource implements DataSource {
  // =========================================================================
  // Session Operations
  // =========================================================================
  sessions = {
    async get(sessionId: string) {
      return db.sessions.get(sessionId);
    },

    async list(options?: SessionListOptions) {
      return db.sessions.list({
        projectId: options?.projectId ?? undefined,
        status: options?.status ?? undefined,
        limit: options?.limit ?? undefined,
      });
    },

    async getConnection(
      args: ConnectionArgs & { projectId?: string | null }
    ): Promise<Connection<Session>> {
      // For local mode, we load all sessions and apply pagination in memory
      // This is acceptable for local mode with limited data
      const sessions = await db.sessions.list({
        projectId: args.projectId ?? undefined,
        limit: 1000, // Reasonable limit for local mode
      });

      // Apply cursor-based pagination
      let filtered = sessions;

      // Handle 'after' cursor
      if (args.after) {
        const afterIndex = sessions.findIndex(
          (s) => encodeCursor(s.id) === args.after
        );
        if (afterIndex !== -1) {
          filtered = sessions.slice(afterIndex + 1);
        }
      }

      // Handle 'before' cursor
      if (args.before) {
        const beforeIndex = filtered.findIndex(
          (s) => encodeCursor(s.id) === args.before
        );
        if (beforeIndex !== -1) {
          filtered = filtered.slice(0, beforeIndex);
        }
      }

      // Apply first/last limits
      const first = args.first ?? 50;
      const sliced = filtered.slice(0, first);

      const edges = sliced.map((session) => ({
        node: session,
        cursor: encodeCursor(session.id),
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage: filtered.length > sliced.length,
          hasPreviousPage: args.after !== undefined,
          startCursor: edges[0]?.cursor ?? null,
          endCursor: edges[edges.length - 1]?.cursor ?? null,
        },
        totalCount: sessions.length,
      };
    },
  };

  // =========================================================================
  // Message Operations
  // =========================================================================
  messages = {
    async get(messageId: string) {
      return db.messages.get(messageId);
    },

    async list(options: MessageListOptions) {
      return db.messages.list({
        sessionId: options.sessionId ?? '',
        type: options.messageType ?? undefined,
        limit: options.limit ?? undefined,
        offset: options.offset ?? undefined,
      });
    },

    async count(sessionId: string) {
      return db.messages.count(sessionId);
    },

    async countBatch(sessionIds: string[]): Promise<Record<string, number>> {
      return db.messages.countBatch(sessionIds);
    },

    async timestampsBatch(sessionIds: string[]): Promise<Record<string, db.SessionTimestamps>> {
      return db.messages.timestampsBatch(sessionIds);
    },

    async search(options: MessageSearchOptions): Promise<db.Message[]> {
      const results = await db.messages.search({
        query: options.query,
        sessionId: options.sessionId ?? undefined,
        limit: options.limit ?? undefined,
      });
      // FtsSearchResult -> Message shape for interface compatibility
      return results as unknown as db.Message[];
    },
  };

  // =========================================================================
  // Project Operations
  // =========================================================================
  projects = {
    async get(_projectId: string) {
      // The native module doesn't have a direct getById - projects are looked up by slug or path
      // For local mode, we can list and filter (not ideal but works)
      const projects = await db.projects.list();
      return projects.find((p) => p.id === _projectId) ?? null;
    },

    async list(repoId?: string | null) {
      return db.projects.list(repoId ?? undefined);
    },

    async getBySlug(slug: string) {
      return db.projects.getBySlug(slug);
    },

    async getByPath(path: string) {
      return db.projects.getByPath(path);
    },
  };

  // =========================================================================
  // Repo Operations
  // =========================================================================
  repos = {
    async getByRemote(remote: string) {
      return db.repos.getByRemote(remote);
    },

    async list() {
      return db.repos.list();
    },
  };

  // =========================================================================
  // Task/Metrics Operations
  // =========================================================================
  tasks = {
    async queryMetrics(options?: TaskMetricsOptions) {
      return db.tasks.queryMetrics({});
    },
  };

  // =========================================================================
  // Native Tasks Operations
  // =========================================================================
  nativeTasks = {
    async getForSession(sessionId: string) {
      return db.nativeTasks.getForSession(sessionId);
    },

    async get(sessionId: string, taskId: string) {
      return db.nativeTasks.get(sessionId, taskId);
    },
  };

  // =========================================================================
  // Hook Execution Operations
  // =========================================================================
  hookExecutions = {
    async list(sessionId: string) {
      // Import dynamically to avoid circular dependencies
      const { getHookExecutionsForSession } = await import(
        '../../api/hooks.ts'
      );
      const results = await getHookExecutionsForSession(sessionId);
      // Convert null to undefined for native type compatibility
      return results.map((r) => ({
        id: (r as unknown as Record<string, unknown>).id as string ?? '',
        session_id: (r as unknown as Record<string, unknown>).sessionId as string ?? '',
        hook_name: (r as unknown as Record<string, unknown>).hookName as string ?? '',
        plugin_name: (r as unknown as Record<string, unknown>).hookSource as string ?? null,
        event_type: (r as unknown as Record<string, unknown>).hookType as string ?? '',
        exit_code: (r as unknown as Record<string, unknown>).exitCode as number ?? null,
        duration_ms: (r as unknown as Record<string, unknown>).durationMs as number ?? null,
        cached: false,
        executed_at: (r as unknown as Record<string, unknown>).executedAt as string ?? new Date().toISOString(),
      }));
    },

    async queryStats(options?: HookStatsOptions) {
      return db.hookExecutions.queryStats({});
    },
  };

  // =========================================================================
  // File Change Operations
  // =========================================================================
  fileChanges = {
    async list(sessionId: string) {
      return db.sessionFileChanges.list(sessionId);
    },

    async hasChanges(sessionId: string) {
      return db.sessionFileChanges.hasChanges(sessionId);
    },
  };

  // =========================================================================
  // File Validation Operations
  // =========================================================================
  fileValidations = {
    async listAll(_sessionId: string) {
      return db.sessionFileValidations.listAll();
    },

    async get(
      sessionId: string,
      filePath: string,
      pluginName: string,
      hookName: string,
      _directory?: string
    ) {
      return db.sessionFileValidations.get(
        sessionId,
        filePath,
        `${pluginName}/${hookName}`
      );
    },
  };

  // =========================================================================
  // Session Todos Operations
  // =========================================================================
  sessionTodos = {
    async get(sessionId: string) {
      return db.sessionTodos.get(sessionId);
    },
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Encode a cursor from a session ID
 * Uses base64 encoding for compatibility with Relay spec
 */
function encodeCursor(sessionId: string): string {
  return Buffer.from(`session:${sessionId}`).toString('base64');
}

/**
 * Create a singleton instance of LocalDataSource
 * This is the default data source for local mode
 */
let _localDataSource: LocalDataSource | null = null;

export function getLocalDataSource(): LocalDataSource {
  if (!_localDataSource) {
    _localDataSource = new LocalDataSource();
  }
  return _localDataSource;
}

/**
 * Reset the singleton (for testing)
 * @internal
 */
export function _resetLocalDataSource(): void {
  _localDataSource = null;
}
