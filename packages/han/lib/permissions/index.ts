/**
 * Permission System
 *
 * Repo-based access control for the Han Team Platform.
 * Sessions are accessible if the user has access to the repository.
 *
 * @example
 * ```typescript
 * import { createPermissionService, isLocalMode } from "./permissions";
 *
 * // In hosted mode with authenticated user
 * const service = createPermissionService(authenticatedUser);
 * const result = await service.canViewSession(session);
 *
 * if (!result.allowed) {
 *   throw new ForbiddenError(result.reason);
 * }
 * ```
 */

// Core types
export type {
	AccessLevel,
	AuditLogEntry,
	AuthenticatedUser,
	CachedPermission,
	GitProvider,
	OrgRole,
	OrgVisibilitySettings,
	PermissionResult,
	RepoOwnership,
	SessionForPermission,
} from "./types.ts";

export { DEFAULT_ORG_VISIBILITY } from "./types.ts";

// Permission service
export {
	createLocalPermissionService,
	createPermissionService,
	isLocalMode,
	PermissionService,
} from "./service.ts";

// Cache
export { permissionCache, PermissionCache, startCacheCleanup } from "./cache.ts";

// Repo ownership utilities
export {
	buildRepoUrl,
	getProviderFromUrl,
	isLikelyPersonalRepo,
	normalizeRepoId,
	parseRemoteUrl,
} from "./repo-ownership.ts";

// Git provider interface
export type {
	GitProviderService,
	OrgMembershipResult,
	RepoAccessResult,
	RepoOwnershipResult,
} from "./git-provider.ts";

export { getAllProviders, getProvider, registerProvider } from "./git-provider.ts";

// Audit logging
export {
	auditLogger,
	logPermissionCheckFailed,
	logPermissionDenied,
	logPermissionGranted,
	writeAuditLog,
} from "./audit.ts";

// Provider implementations (importing registers them)
export { githubProvider } from "./providers/github.ts";
export { gitlabProvider } from "./providers/gitlab.ts";
