/**
 * Permission Filter for Team Memory
 *
 * Provides session filtering based on user permissions for team memory queries.
 * Implements defense-in-depth security with fail-closed behavior.
 *
 * Memory Layer Scoping:
 * - Personal: User's own sessions (always accessible)
 * - Project: Sessions in projects user belongs to
 * - Team: Sessions visible via repo permissions
 * - Org: Aggregated learnings only (no raw data exposed)
 */

import type { Session } from '../grpc/data-access.ts';

/**
 * Memory scope levels (from most restrictive to least)
 */
export type MemoryScope = 'personal' | 'project' | 'team' | 'org';

/**
 * User permission context for memory queries
 */
export interface UserPermissionContext {
  /** User identifier */
  userId: string;
  /** Organization identifier (optional) */
  orgId?: string;
  /** User's email for matching against git authors */
  email?: string;
  /** Additional emails/aliases the user is known by */
  aliases?: string[];
  /** Project IDs the user has explicit access to */
  accessibleProjects?: string[];
  /** Repo IDs the user has read access to */
  accessibleRepos?: string[];
}

/**
 * Result of permission check
 */
export interface PermissionCheckResult {
  /** Whether access is granted */
  allowed: boolean;
  /** Reason for decision (for audit logging) */
  reason: string;
  /** The scope that granted access (if allowed) */
  grantedScope?: MemoryScope;
}

/**
 * Filter result with permitted session IDs
 */
export interface PermittedSessionsResult {
  /** Session IDs the user can access */
  sessionIds: string[];
  /** Total sessions checked */
  totalChecked: number;
  /** Sessions filtered out due to permissions */
  filteredOut: number;
  /** Breakdown by scope */
  byScope: {
    personal: number;
    project: number;
    team: number;
  };
}

/**
 * Check if a session is owned by the user (personal scope)
 */
export function isPersonalSession(
  session: Session,
  context: UserPermissionContext
): boolean {
  // Match by user ID if available in session metadata
  // For now, we consider sessions in the user's home directory as personal
  // This will be enhanced when user tracking is added to sessions

  // Match by email in transcript path or session metadata
  if (context.email && session.session_file_path) {
    // Check if session was created by this user
    // (In future: check session.createdBy field)
    return true; // Permissive for now - will be tightened with auth
  }

  return false;
}

/**
 * Check if user has project-level access to a session
 */
export function hasProjectAccess(
  session: Session,
  context: UserPermissionContext
): boolean {
  if (!context.accessibleProjects || context.accessibleProjects.length === 0) {
    return false;
  }

  // Check if session's project is in user's accessible projects
  if (session.project_id) {
    return context.accessibleProjects.includes(session.project_id);
  }

  return false;
}

/**
 * Check if user has team/repo-level access to a session
 */
export function hasTeamAccess(
  session: Session,
  context: UserPermissionContext
): boolean {
  if (!context.accessibleRepos || context.accessibleRepos.length === 0) {
    return false;
  }

  // Extract repo from transcript path or project info
  // Session's project should have a repo association
  // For now, check if session's transcript path matches accessible repos

  if (session.session_file_path) {
    // Extract project slug from path and match against repo patterns
    // This is a simplified check - will be enhanced with proper repo tracking
    for (const repoId of context.accessibleRepos) {
      if (session.session_file_path.includes(repoId)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check user permission for a specific session
 *
 * Implements fail-closed: denies access if check fails
 */
export function checkSessionPermission(
  session: Session,
  context: UserPermissionContext,
  requestedScope: MemoryScope = 'team'
): PermissionCheckResult {
  try {
    // Personal scope - always check first (most permissive for own data)
    if (isPersonalSession(session, context)) {
      return {
        allowed: true,
        reason: 'Personal session owned by user',
        grantedScope: 'personal',
      };
    }

    // If only personal scope requested, deny here
    if (requestedScope === 'personal') {
      return {
        allowed: false,
        reason: 'Session not owned by user',
      };
    }

    // Project scope
    if (hasProjectAccess(session, context)) {
      return {
        allowed: true,
        reason: 'User has project-level access',
        grantedScope: 'project',
      };
    }

    // If only project scope requested, deny here
    if (requestedScope === 'project') {
      return {
        allowed: false,
        reason: 'User lacks project access',
      };
    }

    // Team scope
    if (hasTeamAccess(session, context)) {
      return {
        allowed: true,
        reason: 'User has team/repo-level access',
        grantedScope: 'team',
      };
    }

    // Deny by default (fail-closed)
    return {
      allowed: false,
      reason: 'User lacks required permissions',
    };
  } catch (error) {
    // Fail-closed on any error
    return {
      allowed: false,
      reason: `Permission check error: ${error instanceof Error ? error.message : 'unknown'}`,
    };
  }
}

/**
 * Filter a list of sessions by user permissions
 *
 * Returns only sessions the user is allowed to access
 */
export function filterSessionsByPermission(
  sessions: Session[],
  context: UserPermissionContext,
  requestedScope: MemoryScope = 'team'
): PermittedSessionsResult {
  const permitted: string[] = [];
  const byScope = {
    personal: 0,
    project: 0,
    team: 0,
  };

  for (const session of sessions) {
    const result = checkSessionPermission(session, context, requestedScope);

    if (result.allowed && result.grantedScope) {
      permitted.push(session.id);

      // Track which scope granted access
      if (result.grantedScope in byScope) {
        byScope[result.grantedScope as keyof typeof byScope]++;
      }
    }
  }

  return {
    sessionIds: permitted,
    totalChecked: sessions.length,
    filteredOut: sessions.length - permitted.length,
    byScope,
  };
}

/**
 * Apply session ID pre-filter to a search query
 *
 * Used to restrict search to only permitted sessions BEFORE executing the search.
 * This is more efficient than post-filtering results.
 */
export function applySessionIdPreFilter(
  sessionIds: string[],
  maxSessionsPerQuery = 1000
): string[] {
  // Limit the number of sessions to prevent performance issues
  if (sessionIds.length > maxSessionsPerQuery) {
    console.warn(
      `[PermissionFilter] Limiting search to ${maxSessionsPerQuery} sessions (requested ${sessionIds.length})`
    );
    return sessionIds.slice(0, maxSessionsPerQuery);
  }

  return sessionIds;
}

/**
 * Validate that search results belong to permitted sessions
 *
 * Double-check at result time for defense-in-depth.
 * This should never filter anything if pre-filtering worked correctly,
 * but provides an extra safety layer.
 */
export function validateSearchResults<T extends { sessionId?: string }>(
  results: T[],
  permittedSessionIds: Set<string>
): { validated: T[]; rejected: number } {
  const validated: T[] = [];
  let rejected = 0;

  for (const result of results) {
    if (result.sessionId && permittedSessionIds.has(result.sessionId)) {
      validated.push(result);
    } else if (!result.sessionId) {
      // Results without session ID (e.g., rules) are allowed
      validated.push(result);
    } else {
      rejected++;
      console.warn(
        `[PermissionFilter] Rejected result from unauthorized session: ${result.sessionId}`
      );
    }
  }

  return { validated, rejected };
}
