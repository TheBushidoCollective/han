/**
 * Permissions Hook for Team Platform
 *
 * Provides permission checking for team session access.
 * This is a stub implementation - actual permission checks will be
 * integrated when the team backend is ready.
 */

import { useCallback, useMemo } from 'react';
import { useMode } from '@/contexts';
import type { Org, User } from '@/types/auth.ts';

/**
 * Permission check result
 */
export interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Session permission context
 */
export interface SessionPermissionContext {
  sessionId: string;
  ownerId?: string;
  orgId?: string;
  repoId?: string;
}

/**
 * Permission actions for sessions
 */
export type SessionAction = 'view' | 'edit' | 'delete' | 'export';

/**
 * Permissions hook return type
 */
export interface UsePermissionsReturn {
  /**
   * Check if the current user can perform an action on a session
   */
  canAccessSession: (
    context: SessionPermissionContext,
    action?: SessionAction
  ) => PermissionResult;

  /**
   * Check if user has access to a repository's sessions
   */
  canAccessRepo: (repoId: string) => PermissionResult;

  /**
   * Check if user has access to an organization's sessions
   */
  canAccessOrg: (orgId: string) => PermissionResult;

  /**
   * Whether permission checks are enabled (hosted mode)
   */
  isPermissionCheckEnabled: boolean;
}

/**
 * Hook for checking permissions in team mode
 *
 * In local mode, all permissions are granted.
 * In hosted mode, checks against user's org membership and repo access.
 *
 * @example
 * ```tsx
 * const { canAccessSession, isPermissionCheckEnabled } = usePermissions();
 *
 * const result = canAccessSession({
 *   sessionId: 'abc-123',
 *   ownerId: 'user-456',
 *   orgId: 'org-789',
 * });
 *
 * if (!result.allowed) {
 *   return <AccessDenied reason={result.reason} />;
 * }
 * ```
 */
export function usePermissions(): UsePermissionsReturn {
  const { isHosted, currentUser, currentOrg, orgs } = useMode();

  // In local mode, permission checks are disabled - everything is allowed
  const isPermissionCheckEnabled = isHosted;

  /**
   * Check if user can access a specific session
   *
   * Permission rules (when team backend is ready):
   * 1. User can always access their own sessions
   * 2. User can access sessions from orgs they belong to
   * 3. User can access sessions from repos they have access to
   */
  const canAccessSession = useCallback(
    (
      context: SessionPermissionContext,
      _action: SessionAction = 'view'
    ): PermissionResult => {
      // Local mode: always allowed
      if (!isPermissionCheckEnabled) {
        return { allowed: true };
      }

      // Not logged in: deny access
      if (!currentUser) {
        return {
          allowed: false,
          reason: 'Authentication required to access team sessions',
        };
      }

      // User is the owner: always allowed
      if (context.ownerId && context.ownerId === currentUser.id) {
        return { allowed: true };
      }

      // Check organization membership
      if (context.orgId) {
        const isMember = orgs.some((org) => org.id === context.orgId);
        if (!isMember) {
          return {
            allowed: false,
            reason: 'You do not have access to this organization',
          };
        }
      }

      // Check repository access (stub - will be implemented with team backend)
      if (context.repoId) {
        // TODO: Check user's repository access when backend is ready
        // For now, allow access if user is in the same org
        if (context.orgId && currentOrg?.id === context.orgId) {
          return { allowed: true };
        }
      }

      // Default: allow if in same org or if no org context
      if (!context.orgId || (currentOrg && currentOrg.id === context.orgId)) {
        return { allowed: true };
      }

      return {
        allowed: false,
        reason: 'You do not have permission to access this session',
      };
    },
    [isPermissionCheckEnabled, currentUser, currentOrg, orgs]
  );

  /**
   * Check if user has access to a repository's sessions
   */
  const canAccessRepo = useCallback(
    (repoId: string): PermissionResult => {
      // Local mode: always allowed
      if (!isPermissionCheckEnabled) {
        return { allowed: true };
      }

      // Not logged in: deny access
      if (!currentUser) {
        return {
          allowed: false,
          reason: 'Authentication required to access repository sessions',
        };
      }

      // TODO: Implement repository access check when team backend is ready
      // For now, stub implementation allows access
      // Actual implementation will check:
      // 1. GitHub/GitLab organization membership
      // 2. Repository-level permissions
      // 3. Team membership
      console.log(`[usePermissions] Checking repo access for: ${repoId}`);

      return { allowed: true };
    },
    [isPermissionCheckEnabled, currentUser]
  );

  /**
   * Check if user has access to an organization's sessions
   */
  const canAccessOrg = useCallback(
    (orgId: string): PermissionResult => {
      // Local mode: always allowed
      if (!isPermissionCheckEnabled) {
        return { allowed: true };
      }

      // Not logged in: deny access
      if (!currentUser) {
        return {
          allowed: false,
          reason: 'Authentication required to access organization sessions',
        };
      }

      // Check if user is a member of the organization
      const isMember = orgs.some((org) => org.id === orgId);
      if (!isMember) {
        return {
          allowed: false,
          reason: 'You are not a member of this organization',
        };
      }

      return { allowed: true };
    },
    [isPermissionCheckEnabled, currentUser, orgs]
  );

  return useMemo(
    () => ({
      canAccessSession,
      canAccessRepo,
      canAccessOrg,
      isPermissionCheckEnabled,
    }),
    [canAccessSession, canAccessRepo, canAccessOrg, isPermissionCheckEnabled]
  );
}

/**
 * Access Denied Error
 *
 * Thrown when permission check fails
 */
export class AccessDeniedError extends Error {
  constructor(
    message: string,
    public readonly context?: SessionPermissionContext
  ) {
    super(message);
    this.name = 'AccessDeniedError';
  }
}
