/**
 * DataSource Interface
 *
 * Abstracts over SQLite (local mode) and PostgreSQL (hosted mode).
 * This interface enables the same GraphQL schema to work with both
 * backend storage systems.
 *
 * All data access in GraphQL resolvers should go through this interface,
 * injected via the GraphQL context.
 */

// Re-export types from db/index.ts which already re-exports from han-native
import type {
  HookExecution,
  HookStats,
  Message,
  NativeTask,
  Project,
  Repo,
  Session,
  SessionFileChange,
  SessionFileValidation,
  SessionTimestamps,
  SessionTodos,
  TaskMetrics,
} from '../db/index.ts';

// =============================================================================
// Multi-tenant Entity Types (Hosted Mode Only)
// =============================================================================

/**
 * Organization entity (multi-tenant platform)
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Team entity within an organization
 */
export interface Team {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * User entity (authenticated via OAuth)
 */
export interface User {
  id: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  provider?: string;
  providerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Membership linking users to organizations/teams
 */
export interface Membership {
  id: string;
  userId: string;
  organizationId: string;
  teamId?: string;
  role: MembershipRole;
  createdAt?: string;
}

/**
 * Role types for memberships
 */
export type MembershipRole = 'owner' | 'admin' | 'member' | 'viewer';

// =============================================================================
// Input Types for Write Operations
// =============================================================================

/**
 * Input for creating an organization
 */
export interface CreateOrganizationInput {
  name: string;
  slug: string;
}

/**
 * Input for updating an organization
 */
export interface UpdateOrganizationInput {
  name?: string;
  slug?: string;
}

/**
 * Input for creating a team
 */
export interface CreateTeamInput {
  name: string;
  slug: string;
}

/**
 * Input for updating a team
 */
export interface UpdateTeamInput {
  name?: string;
  slug?: string;
}

/**
 * Input for creating a user
 */
export interface CreateUserInput {
  email?: string;
  name?: string;
  avatarUrl?: string;
  provider?: string;
  providerId?: string;
}

/**
 * Input for updating a user
 */
export interface UpdateUserInput {
  email?: string;
  name?: string;
  avatarUrl?: string;
}

/**
 * Input for creating a membership
 */
export interface CreateMembershipInput {
  userId: string;
  organizationId: string;
  teamId?: string;
  role?: MembershipRole;
}

/**
 * Input for updating a membership
 */
export interface UpdateMembershipInput {
  teamId?: string;
  role?: MembershipRole;
}

/**
 * Input for linking a repository to an organization
 */
export interface LinkRepositoryInput {
  remote: string;
  name: string;
  defaultBranch?: string;
}

// =============================================================================
// Query Options Types
// =============================================================================

/**
 * Options for listing sessions
 */
export interface SessionListOptions {
  projectId?: string | null;
  status?: string | null;
  limit?: number | null;
}

/**
 * Options for listing messages
 */
export interface MessageListOptions {
  sessionId: string;
  messageType?: string | null;
  agentIdFilter?: string | null;
  limit?: number | null;
  offset?: number | null;
}

/**
 * Options for searching messages
 */
export interface MessageSearchOptions {
  query: string;
  sessionId?: string | null;
  limit?: number | null;
}

/**
 * Options for querying task metrics
 */
export interface TaskMetricsOptions {
  taskType?: string | null;
  outcome?: string | null;
  period?: 'day' | 'week' | 'month' | null;
}

/**
 * Options for querying hook stats
 */
export interface HookStatsOptions {
  period?: 'day' | 'week' | 'month' | null;
}

// =============================================================================
// Relay Connection Types
// =============================================================================

/**
 * Page info for Relay connections
 */
export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string | null;
  endCursor?: string | null;
}

/**
 * Generic edge type for Relay connections
 */
export interface Edge<T> {
  node: T;
  cursor: string;
}

/**
 * Generic connection type for Relay connections
 */
export interface Connection<T> {
  edges: Edge<T>[];
  pageInfo: PageInfo;
  totalCount?: number;
}

/**
 * Relay connection arguments
 */
export interface ConnectionArgs {
  first?: number | null;
  after?: string | null;
  last?: number | null;
  before?: string | null;
}

// =============================================================================
// DataSource Interface
// =============================================================================

/**
 * DataSource interface
 *
 * Abstracts database operations so resolvers don't know about the
 * underlying storage mechanism.
 *
 * Two implementations:
 * - LocalDataSource: Wraps existing han-native SQLite operations
 * - HostedDataSource: Uses Drizzle ORM with PostgreSQL
 */
export interface DataSource {
  // =========================================================================
  // Session Operations
  // =========================================================================
  sessions: {
    /**
     * Get a session by ID
     */
    get(sessionId: string): Promise<Session | null>;

    /**
     * List sessions with optional filters
     */
    list(options?: SessionListOptions): Promise<Session[]>;

    /**
     * Get sessions as a Relay connection
     */
    getConnection(
      args: ConnectionArgs & {
        projectId?: string | null;
      }
    ): Promise<Connection<Session>>;
  };

  // =========================================================================
  // Message Operations
  // =========================================================================
  messages: {
    /**
     * Get a message by ID
     */
    get(messageId: string): Promise<Message | null>;

    /**
     * List messages with filters and pagination
     */
    list(options: MessageListOptions): Promise<Message[]>;

    /**
     * Get message count for a session
     */
    count(sessionId: string): Promise<number>;

    /**
     * Get message counts for multiple sessions (batch)
     */
    countBatch(sessionIds: string[]): Promise<Record<string, number>>;

    /**
     * Get timestamps for multiple sessions (batch)
     */
    timestampsBatch(
      sessionIds: string[]
    ): Promise<Record<string, SessionTimestamps>>;

    /**
     * Search messages using full-text search
     */
    search(options: MessageSearchOptions): Promise<Message[]>;
  };

  // =========================================================================
  // Project Operations
  // =========================================================================
  projects: {
    /**
     * Get a project by ID
     */
    get(projectId: string): Promise<Project | null>;

    /**
     * List all projects
     */
    list(repoId?: string | null): Promise<Project[]>;

    /**
     * Get a project by slug
     */
    getBySlug(slug: string): Promise<Project | null>;

    /**
     * Get a project by path
     */
    getByPath(path: string): Promise<Project | null>;
  };

  // =========================================================================
  // Repo Operations
  // =========================================================================
  repos: {
    /**
     * Get a repo by remote URL
     */
    getByRemote(remote: string): Promise<Repo | null>;

    /**
     * List all repos
     */
    list(): Promise<Repo[]>;
  };

  // =========================================================================
  // Task/Metrics Operations
  // =========================================================================
  tasks: {
    /**
     * Query task metrics with optional filters
     */
    queryMetrics(options?: TaskMetricsOptions): Promise<TaskMetrics>;
  };

  // =========================================================================
  // Native Tasks (Claude Code's built-in TaskCreate/TaskUpdate)
  // =========================================================================
  nativeTasks: {
    /**
     * Get native tasks for a session
     */
    getForSession(sessionId: string): Promise<NativeTask[]>;

    /**
     * Get a specific native task by session ID and task ID
     */
    get(sessionId: string, taskId: string): Promise<NativeTask | null>;
  };

  // =========================================================================
  // Hook Execution Operations
  // =========================================================================
  hookExecutions: {
    /**
     * List hook executions for a session
     */
    list(sessionId: string): Promise<HookExecution[]>;

    /**
     * Query hook statistics
     */
    queryStats(options?: HookStatsOptions): Promise<HookStats>;
  };

  // =========================================================================
  // File Change Operations
  // =========================================================================
  fileChanges: {
    /**
     * List file changes for a session
     */
    list(sessionId: string): Promise<SessionFileChange[]>;

    /**
     * Check if a session has any file changes
     */
    hasChanges(sessionId: string): Promise<boolean>;
  };

  // =========================================================================
  // File Validation Operations
  // =========================================================================
  fileValidations: {
    /**
     * List all validations for a session
     */
    listAll(sessionId: string): Promise<SessionFileValidation[]>;

    /**
     * Get a specific file validation
     */
    get(
      sessionId: string,
      filePath: string,
      pluginName: string,
      hookName: string,
      directory: string
    ): Promise<SessionFileValidation | null>;
  };

  // =========================================================================
  // Session Todos Operations
  // =========================================================================
  sessionTodos: {
    /**
     * Get todos for a session
     */
    get(sessionId: string): Promise<SessionTodos | null>;
  };
}

/**
 * DataSource mode indicator
 */
export type DataSourceMode = 'local' | 'hosted';

// =============================================================================
// Write Operations Interface (Hosted Mode Only)
// =============================================================================

/**
 * Organization write operations
 *
 * Only available in hosted mode. Local mode is single-user and doesn't need
 * multi-tenant organization management.
 */
export interface OrganizationWriteOperations {
  /**
   * Create a new organization
   */
  create(data: CreateOrganizationInput): Promise<Organization>;

  /**
   * Update an organization
   */
  update(id: string, data: UpdateOrganizationInput): Promise<Organization>;

  /**
   * Delete an organization (cascades to all related data)
   */
  delete(id: string): Promise<void>;

  /**
   * Get an organization by ID
   */
  get(id: string): Promise<Organization | null>;

  /**
   * Get an organization by slug
   */
  getBySlug(slug: string): Promise<Organization | null>;

  /**
   * List all organizations (for admin views)
   */
  list(): Promise<Organization[]>;
}

/**
 * Team write operations
 */
export interface TeamWriteOperations {
  /**
   * Create a new team in the current organization
   */
  create(data: CreateTeamInput): Promise<Team>;

  /**
   * Update a team
   */
  update(id: string, data: UpdateTeamInput): Promise<Team>;

  /**
   * Delete a team
   */
  delete(id: string): Promise<void>;

  /**
   * Get a team by ID
   */
  get(id: string): Promise<Team | null>;

  /**
   * Get a team by slug within the current organization
   */
  getBySlug(slug: string): Promise<Team | null>;

  /**
   * List all teams in the current organization
   */
  list(): Promise<Team[]>;
}

/**
 * User write operations
 */
export interface UserWriteOperations {
  /**
   * Create or update a user (upsert by provider + providerId)
   */
  upsert(data: CreateUserInput): Promise<User>;

  /**
   * Update a user
   */
  update(id: string, data: UpdateUserInput): Promise<User>;

  /**
   * Delete a user
   */
  delete(id: string): Promise<void>;

  /**
   * Get a user by ID
   */
  get(id: string): Promise<User | null>;

  /**
   * Get a user by email
   */
  getByEmail(email: string): Promise<User | null>;

  /**
   * Get a user by provider credentials
   */
  getByProvider(provider: string, providerId: string): Promise<User | null>;
}

/**
 * Membership write operations
 */
export interface MembershipWriteOperations {
  /**
   * Add a user to an organization (with optional team and role)
   */
  create(data: CreateMembershipInput): Promise<Membership>;

  /**
   * Update a membership (change role or team)
   */
  update(id: string, data: UpdateMembershipInput): Promise<Membership>;

  /**
   * Remove a user from an organization/team
   */
  delete(id: string): Promise<void>;

  /**
   * Get a membership by ID
   */
  get(id: string): Promise<Membership | null>;

  /**
   * List memberships for a user
   */
  listForUser(userId: string): Promise<Membership[]>;

  /**
   * List memberships for an organization
   */
  listForOrganization(organizationId: string): Promise<Membership[]>;

  /**
   * List memberships for a team
   */
  listForTeam(teamId: string): Promise<Membership[]>;

  /**
   * Check if a user is a member of an organization
   */
  isMember(userId: string, organizationId: string): Promise<boolean>;

  /**
   * Get a user's role in an organization
   */
  getRole(
    userId: string,
    organizationId: string
  ): Promise<MembershipRole | null>;
}

/**
 * Repository linking operations
 */
export interface RepositoryWriteOperations {
  /**
   * Link a repository to the current organization
   */
  link(data: LinkRepositoryInput): Promise<Repo>;

  /**
   * Unlink a repository from the organization
   */
  unlink(id: string): Promise<void>;

  /**
   * Update repository metadata
   */
  update(id: string, data: Partial<LinkRepositoryInput>): Promise<Repo>;
}

/**
 * Extended DataSource with write operations (hosted mode only)
 *
 * These operations are optional on the base DataSource interface because
 * local mode doesn't need multi-tenant CRUD operations.
 */
export interface HostedDataSourceWriteOps {
  /**
   * Organization CRUD operations
   */
  organizations: OrganizationWriteOperations;

  /**
   * Team management operations
   */
  teams: TeamWriteOperations;

  /**
   * User management operations
   */
  users: UserWriteOperations;

  /**
   * Membership management operations
   */
  memberships: MembershipWriteOperations;

  /**
   * Repository linking operations
   */
  repositoryLinks: RepositoryWriteOperations;
}
