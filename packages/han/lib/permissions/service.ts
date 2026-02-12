/**
 * Permission Service
 *
 * Core service for checking user permissions to access sessions and resources.
 * Implements repo-based access control with caching and audit logging.
 */

import { auditLogger } from './audit.ts';
import { permissionCache } from './cache.ts';
import { getProvider } from './git-provider.ts';
import { normalizeRepoId, parseRemoteUrl } from './repo-ownership.ts';
import type {
  AuthenticatedUser,
  OrgRole,
  OrgVisibilitySettings,
  PermissionResult,
  SessionForPermission,
} from './types.ts';

// Import providers to register them
import './providers/github.ts';
import './providers/gitlab.ts';

/**
 * Permission service for checking access rights
 */
export class PermissionService {
  private user: AuthenticatedUser;
  private orgSettings: Map<string, OrgVisibilitySettings>;

  constructor(user: AuthenticatedUser) {
    this.user = user;
    this.orgSettings = new Map();
  }

  /**
   * Get the current authenticated user
   */
  getUser(): AuthenticatedUser {
    return this.user;
  }

  /**
   * Check if the user can view a session
   *
   * Permission logic:
   * 1. If session has no repo remote, allow (local-only session)
   * 2. If user owns the repo (personal repo), allow
   * 3. Check repo access via provider API (cached)
   * 4. Check manager visibility settings if applicable
   * 5. Default deny with audit log
   */
  async canViewSession(
    session: SessionForPermission
  ): Promise<PermissionResult> {
    // 1. No repo remote - local session, always allowed
    if (!session.repoRemote) {
      return {
        allowed: true,
        accessLevel: 'admin',
        reason: 'Local session without git remote',
        source: 'default',
      };
    }

    // 2. Parse the remote URL
    const ownership = parseRemoteUrl(session.repoRemote);
    if (!ownership) {
      // Can't parse URL - deny by default
      auditLogger.denied(
        this.user.username,
        'session',
        session.sessionId,
        'Could not parse repository URL',
        { repoRemote: session.repoRemote }
      );

      return {
        allowed: false,
        accessLevel: 'none',
        reason: 'Could not parse repository URL',
        source: 'default',
      };
    }

    // 3. Check if user owns the repo (personal repo)
    if (ownership.owner.toLowerCase() === this.user.username.toLowerCase()) {
      return {
        allowed: true,
        accessLevel: 'admin',
        reason: 'Repository owner',
        source: 'default',
      };
    }

    // 4. Check repo access (with caching)
    const repoId = normalizeRepoId(ownership.owner, ownership.repo);
    const accessResult = await this.checkRepoAccess(
      ownership.owner,
      ownership.repo
    );

    if (accessResult.allowed) {
      return {
        ...accessResult,
        reason: `Access via repository permission: ${accessResult.accessLevel}`,
      };
    }

    // 5. Check manager visibility settings
    const orgSettings = await this.getOrgSettings(ownership.owner);
    if (orgSettings.managerCanSeeAll) {
      // Check if user is a manager in the org
      const orgAccess = await this.checkOrgRole(ownership.owner);
      if (orgAccess === 'admin' || orgAccess === 'owner') {
        auditLogger.granted(
          this.user.username,
          'session',
          session.sessionId,
          'Manager visibility enabled',
          { org: ownership.owner, role: orgAccess }
        );

        return {
          allowed: true,
          accessLevel: 'read',
          reason: 'Manager visibility enabled for organization',
          source: 'override',
        };
      }
    }

    // 6. Default deny
    auditLogger.denied(
      this.user.username,
      'session',
      session.sessionId,
      'No repository access',
      { repoId, provider: ownership.provider }
    );

    return {
      allowed: false,
      accessLevel: 'none',
      reason: 'No access to repository',
      source: 'api',
    };
  }

  /**
   * Check if user can view aggregated metrics for an org
   * By default, all org members can view aggregated metrics
   */
  async canViewAggregatedMetrics(orgId: string): Promise<PermissionResult> {
    const orgSettings = await this.getOrgSettings(orgId);

    if (!orgSettings.aggregatedMetricsPublic) {
      // Only admins can view if not public
      const role = await this.checkOrgRole(orgId);
      if (role === 'owner' || role === 'admin') {
        return {
          allowed: true,
          accessLevel: 'read',
          reason: 'Admin access to aggregated metrics',
          source: 'api',
        };
      }

      auditLogger.denied(
        this.user.username,
        'metrics',
        orgId,
        'Aggregated metrics not public and user is not admin'
      );

      return {
        allowed: false,
        accessLevel: 'none',
        reason: 'Aggregated metrics are not public for this organization',
        source: 'override',
      };
    }

    // Check org membership
    const provider = getProvider(this.user.provider);
    if (!provider) {
      return {
        allowed: orgSettings.failMode === 'open',
        accessLevel: orgSettings.failMode === 'open' ? 'read' : 'none',
        reason: `No provider for ${this.user.provider}`,
        source: 'default',
      };
    }

    const membership = await provider.checkOrgMembership(
      this.user.accessToken,
      orgId,
      this.user.username
    );

    if (!membership.success) {
      const allowed = orgSettings.failMode === 'open';
      if (!allowed) {
        auditLogger.failed(
          this.user.username,
          'metrics',
          orgId,
          membership.error || 'Org membership check failed'
        );
      }

      return {
        allowed,
        accessLevel: allowed ? 'read' : 'none',
        reason: membership.error || 'Could not verify organization membership',
        source: 'default',
      };
    }

    if (membership.isMember) {
      return {
        allowed: true,
        accessLevel: 'read',
        reason: 'Organization member can view aggregated metrics',
        source: 'api',
      };
    }

    auditLogger.denied(
      this.user.username,
      'metrics',
      orgId,
      'Not an organization member'
    );

    return {
      allowed: false,
      accessLevel: 'none',
      reason: 'Not a member of this organization',
      source: 'api',
    };
  }

  /**
   * Check repo access for the current user
   */
  async checkRepoAccess(
    owner: string,
    repo: string
  ): Promise<PermissionResult> {
    const repoId = normalizeRepoId(owner, repo);

    // Check cache first
    const cached = permissionCache.get(this.user.username, repoId);
    if (cached) {
      const allowed = cached.accessLevel !== 'none';
      return {
        allowed,
        accessLevel: cached.accessLevel,
        reason: `Cached permission: ${cached.accessLevel}`,
        source: 'cache',
      };
    }

    // Get provider
    const provider = getProvider(this.user.provider);
    if (!provider) {
      return {
        allowed: false,
        accessLevel: 'none',
        reason: `No provider implementation for ${this.user.provider}`,
        source: 'default',
      };
    }

    // Check via API
    const result = await provider.checkRepoAccess(
      this.user.accessToken,
      owner,
      repo,
      this.user.username
    );

    if (!result.success) {
      auditLogger.failed(
        this.user.username,
        'repo',
        repoId,
        result.error || 'API check failed'
      );

      // Fail closed by default
      return {
        allowed: false,
        accessLevel: 'none',
        reason: result.error || 'Permission check failed',
        source: 'api',
      };
    }

    // Cache the result
    permissionCache.set(this.user.username, repoId, result.accessLevel);

    const allowed = result.accessLevel !== 'none';
    return {
      allowed,
      accessLevel: result.accessLevel,
      reason: allowed
        ? `Repository access: ${result.accessLevel}`
        : 'No repository access',
      source: 'api',
    };
  }

  /**
   * Check user's role in an organization
   */
  private async checkOrgRole(orgName: string): Promise<OrgRole> {
    const provider = getProvider(this.user.provider);
    if (!provider) {
      return 'none';
    }

    const result = await provider.checkOrgMembership(
      this.user.accessToken,
      orgName,
      this.user.username
    );

    if (!result.success || !result.isMember) {
      return 'none';
    }

    return result.role;
  }

  /**
   * Get organization visibility settings
   * Returns defaults if not configured
   */
  private async getOrgSettings(orgId: string): Promise<OrgVisibilitySettings> {
    // Check cache
    const cached = this.orgSettings.get(orgId.toLowerCase());
    if (cached) {
      return cached;
    }

    // TODO: Fetch from database when org settings table is implemented
    // For now, return defaults
    const settings: OrgVisibilitySettings = {
      managerCanSeeAll: false,
      aggregatedMetricsPublic: true,
      failMode: 'closed',
    };

    this.orgSettings.set(orgId.toLowerCase(), settings);
    return settings;
  }

  /**
   * Update organization visibility settings
   */
  setOrgSettings(
    orgId: string,
    settings: Partial<OrgVisibilitySettings>
  ): void {
    const current = this.orgSettings.get(orgId.toLowerCase()) || {
      managerCanSeeAll: false,
      aggregatedMetricsPublic: true,
      failMode: 'closed' as const,
    };

    this.orgSettings.set(orgId.toLowerCase(), {
      ...current,
      ...settings,
    });
  }

  /**
   * Invalidate cached permissions for the current user
   */
  invalidateCache(): number {
    return permissionCache.invalidateUser(this.user.username);
  }
}

/**
 * Create a permission service for an authenticated user
 */
export function createPermissionService(
  user: AuthenticatedUser
): PermissionService {
  return new PermissionService(user);
}

/**
 * Check if running in local mode (no authentication needed)
 */
export function isLocalMode(): boolean {
  // Local mode is determined by the server configuration
  // In local mode, all permission checks return allowed
  return process.env.HAN_MODE !== 'hosted';
}

/**
 * Create a local-mode permission service that allows all access
 */
export function createLocalPermissionService(): PermissionService {
  // Create a dummy user for local mode
  const localUser: AuthenticatedUser = {
    id: 'local',
    username: 'local',
    provider: 'github',
    accessToken: '',
  };

  // Override the service to always allow
  const service = new PermissionService(localUser);

  // Monkey-patch to always allow in local mode
  service.canViewSession = async () => ({
    allowed: true,
    accessLevel: 'admin',
    reason: 'Local mode - all access allowed',
    source: 'override',
  });

  service.canViewAggregatedMetrics = async () => ({
    allowed: true,
    accessLevel: 'admin',
    reason: 'Local mode - all access allowed',
    source: 'override',
  });

  service.checkRepoAccess = async () => ({
    allowed: true,
    accessLevel: 'admin',
    reason: 'Local mode - all access allowed',
    source: 'override',
  });

  return service;
}
