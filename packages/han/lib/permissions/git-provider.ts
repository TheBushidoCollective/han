/**
 * Git Provider Interface
 *
 * Abstraction layer for checking repository permissions across different
 * git hosting providers (GitHub, GitLab, etc.).
 */

import type { AccessLevel, GitProvider, OrgRole, RepoOwnership } from "./types.ts";

/**
 * Result of a repository access check
 */
export interface RepoAccessResult {
	/** The determined access level */
	accessLevel: AccessLevel;
	/** Whether the check succeeded (API call worked) */
	success: boolean;
	/** Error message if the check failed */
	error?: string;
}

/**
 * Result of an organization membership check
 */
export interface OrgMembershipResult {
	/** Whether the user is a member of the org */
	isMember: boolean;
	/** The user's role in the org */
	role: OrgRole;
	/** Whether the check succeeded */
	success: boolean;
	/** Error message if the check failed */
	error?: string;
}

/**
 * Result of checking repo ownership type
 */
export interface RepoOwnershipResult {
	/** Updated ownership info with isOrg determined */
	ownership: RepoOwnership;
	/** Whether the check succeeded */
	success: boolean;
	/** Error message if the check failed */
	error?: string;
}

/**
 * Interface for git provider API interactions
 */
export interface GitProviderService {
	/** Provider name */
	readonly name: GitProvider;

	/**
	 * Check a user's access level to a repository
	 *
	 * @param token - OAuth access token
	 * @param owner - Repository owner (user or org)
	 * @param repo - Repository name
	 * @param username - Username to check access for
	 * @returns The user's access level
	 */
	checkRepoAccess(
		token: string,
		owner: string,
		repo: string,
		username: string,
	): Promise<RepoAccessResult>;

	/**
	 * Get repository ownership information (determines if owner is user or org)
	 *
	 * @param token - OAuth access token
	 * @param owner - Repository owner
	 * @param repo - Repository name
	 * @returns Updated ownership info with isOrg field set
	 */
	getRepoOwnership(
		token: string,
		owner: string,
		repo: string,
	): Promise<RepoOwnershipResult>;

	/**
	 * Check if a user is a member of an organization
	 *
	 * @param token - OAuth access token
	 * @param orgName - Organization name
	 * @param username - Username to check
	 * @returns Membership status and role
	 */
	checkOrgMembership(
		token: string,
		orgName: string,
		username: string,
	): Promise<OrgMembershipResult>;
}

/**
 * Registry of git provider implementations
 */
const providerRegistry = new Map<GitProvider, GitProviderService>();

/**
 * Register a git provider implementation
 */
export function registerProvider(provider: GitProviderService): void {
	providerRegistry.set(provider.name, provider);
}

/**
 * Get a git provider implementation by name
 */
export function getProvider(name: GitProvider): GitProviderService | undefined {
	return providerRegistry.get(name);
}

/**
 * Get all registered providers
 */
export function getAllProviders(): GitProviderService[] {
	return Array.from(providerRegistry.values());
}
