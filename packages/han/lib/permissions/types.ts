/**
 * Permission System Types
 *
 * Defines types for repo-based access control in the Han Team Platform.
 * Sessions are accessible if the user has access to the repository.
 */

/**
 * Access level for repository permissions
 * Maps to GitHub/GitLab permission levels
 */
export type AccessLevel =
  | 'none'
  | 'read'
  | 'triage'
  | 'write'
  | 'maintain'
  | 'admin';

/**
 * Organization role for a user
 */
export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer' | 'none';

/**
 * Result of a permission check
 */
export interface PermissionResult {
  /** Whether access is allowed */
  allowed: boolean;
  /** The access level granted */
  accessLevel: AccessLevel;
  /** Human-readable reason for the decision */
  reason: string;
  /** Source of the permission decision */
  source: 'cache' | 'api' | 'override' | 'default';
}

/**
 * Cached permission entry
 */
export interface CachedPermission {
  /** User identifier (e.g., GitHub username) */
  userId: string;
  /** Repository identifier (owner/repo format) */
  repoId: string;
  /** The cached access level */
  accessLevel: AccessLevel;
  /** When this entry was cached (Unix timestamp ms) */
  cachedAt: number;
  /** When this entry expires (Unix timestamp ms) */
  expiresAt: number;
}

/**
 * Repository ownership information
 */
export interface RepoOwnership {
  /** The repository owner (user or org name) */
  owner: string;
  /** The repository name */
  repo: string;
  /** Whether the owner is an organization */
  isOrg: boolean;
  /** The git provider (github, gitlab, etc.) */
  provider: GitProvider;
  /** Full remote URL */
  remoteUrl: string;
}

/**
 * Supported git providers
 */
export type GitProvider = 'github' | 'gitlab' | 'bitbucket' | 'unknown';

/**
 * Authenticated user information
 */
export interface AuthenticatedUser {
  /** User's unique identifier from the auth provider */
  id: string;
  /** Username (e.g., GitHub login) */
  username: string;
  /** Email address if available */
  email?: string;
  /** Git provider this user authenticated with */
  provider: GitProvider;
  /** OAuth access token for API calls */
  accessToken: string;
}

/**
 * Organization visibility settings
 */
export interface OrgVisibilitySettings {
  /** Whether managers can see all sessions in repos they manage */
  managerCanSeeAll: boolean;
  /** Whether aggregated metrics are visible to all org members */
  aggregatedMetricsPublic: boolean;
  /** Behavior when API is unavailable: "open" allows, "closed" denies */
  failMode: 'open' | 'closed';
}

/**
 * Default organization visibility settings
 */
export const DEFAULT_ORG_VISIBILITY: OrgVisibilitySettings = {
  managerCanSeeAll: false,
  aggregatedMetricsPublic: true,
  failMode: 'closed',
};

/**
 * Audit log entry for permission events
 */
export interface AuditLogEntry {
  /** Unique identifier for this entry */
  id?: string;
  /** Type of event */
  eventType:
    | 'permission_denied'
    | 'permission_granted'
    | 'permission_check_failed';
  /** User who triggered the event */
  userId: string;
  /** What type of resource was accessed */
  targetType: 'session' | 'org' | 'repo' | 'metrics';
  /** Identifier of the target resource */
  targetId: string;
  /** Reason for the permission decision */
  reason: string;
  /** When this event occurred */
  timestamp: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Session with repo information for permission checking
 */
export interface SessionForPermission {
  sessionId: string;
  /** Git remote URL (e.g., git@github.com:owner/repo.git) */
  repoRemote?: string;
  /** Project path on filesystem */
  projectPath?: string;
  /** User who created this session (if known) */
  createdBy?: string;
}
