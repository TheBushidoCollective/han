/**
 * GitLab Provider Implementation
 *
 * Implements the GitProviderService interface for GitLab.
 * Uses the GitLab REST API to check repository permissions.
 */

import type {
	GitProviderService,
	OrgMembershipResult,
	RepoAccessResult,
	RepoOwnershipResult,
} from "../git-provider.ts";
import { registerProvider } from "../git-provider.ts";
import type { AccessLevel, OrgRole, } from "../types.ts";

/**
 * GitLab API base URL
 */
const GITLAB_API_BASE = "https://gitlab.com/api/v4";

/**
 * Map GitLab access level to our AccessLevel
 *
 * GitLab access levels:
 * - 0: No access
 * - 5: Minimal access
 * - 10: Guest
 * - 20: Reporter
 * - 30: Developer
 * - 40: Maintainer
 * - 50: Owner
 */
function mapGitLabAccessLevel(accessLevel: number): AccessLevel {
	if (accessLevel >= 50) return "admin";
	if (accessLevel >= 40) return "maintain";
	if (accessLevel >= 30) return "write";
	if (accessLevel >= 20) return "triage";
	if (accessLevel >= 10) return "read";
	return "none";
}

/**
 * Map GitLab group access level to OrgRole
 */
function mapGitLabGroupRole(accessLevel: number): OrgRole {
	if (accessLevel >= 50) return "owner";
	if (accessLevel >= 40) return "admin";
	if (accessLevel >= 30) return "member";
	if (accessLevel >= 10) return "viewer";
	return "none";
}

/**
 * Make an authenticated GitLab API request
 */
async function gitlabFetch<T>(
	token: string,
	endpoint: string,
	options: RequestInit = {},
): Promise<{ data: T | null; status: number; error?: string }> {
	const url = endpoint.startsWith("http") ? endpoint : `${GITLAB_API_BASE}${endpoint}`;

	try {
		const response = await fetch(url, {
			...options,
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
				...options.headers,
			},
		});

		if (!response.ok) {
			if (response.status === 404) {
				return { data: null, status: 404 };
			}

			if (response.status === 429) {
				return {
					data: null,
					status: 429,
					error: "GitLab API rate limit exceeded",
				};
			}

			return {
				data: null,
				status: response.status,
				error: `GitLab API error: ${response.status} ${response.statusText}`,
			};
		}

		const data = (await response.json()) as T;
		return { data, status: response.status };
	} catch (error) {
		return {
			data: null,
			status: 0,
			error: `Network error: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

/**
 * Encode a project path for GitLab API
 * GitLab uses URL-encoded project paths like "group%2Fsubgroup%2Fproject"
 */
function encodeProjectPath(owner: string, repo: string): string {
	return encodeURIComponent(`${owner}/${repo}`);
}

/**
 * GitLab provider implementation
 */
export const gitlabProvider: GitProviderService = {
	name: "gitlab",

	async checkRepoAccess(
		token: string,
		owner: string,
		repo: string,
		username: string,
	): Promise<RepoAccessResult> {
		const projectPath = encodeProjectPath(owner, repo);

		// First, get the project to check visibility
		const projectResult = await gitlabFetch<{
			id: number;
			visibility: string;
		}>(token, `/projects/${projectPath}`);

		if (projectResult.error && projectResult.status !== 404) {
			return {
				accessLevel: "none",
				success: false,
				error: projectResult.error,
			};
		}

		if (!projectResult.data) {
			return {
				accessLevel: "none",
				success: true,
			};
		}

		const projectId = projectResult.data.id;

		// Get the user's ID first
		const userResult = await gitlabFetch<{ id: number }>(
			token,
			`/users?username=${encodeURIComponent(username)}`,
		);

		if (!userResult.data || !Array.isArray(userResult.data) || userResult.data.length === 0) {
			// Can't find user - check if project is public
			if (projectResult.data.visibility === "public") {
				return {
					accessLevel: "read",
					success: true,
				};
			}
			return {
				accessLevel: "none",
				success: true,
			};
		}

		const users = userResult.data as unknown as Array<{ id: number }>;
		const userId = users[0].id;

		// Get the user's access level to this project
		// GET /projects/:id/members/:user_id
		const memberResult = await gitlabFetch<{
			access_level: number;
		}>(token, `/projects/${projectId}/members/${userId}`);

		if (memberResult.data) {
			return {
				accessLevel: mapGitLabAccessLevel(memberResult.data.access_level),
				success: true,
			};
		}

		// Try inherited membership (from groups)
		// GET /projects/:id/members/all/:user_id
		const inheritedResult = await gitlabFetch<{
			access_level: number;
		}>(token, `/projects/${projectId}/members/all/${userId}`);

		if (inheritedResult.data) {
			return {
				accessLevel: mapGitLabAccessLevel(inheritedResult.data.access_level),
				success: true,
			};
		}

		// User is not a member - check if project is public
		if (projectResult.data.visibility === "public") {
			return {
				accessLevel: "read",
				success: true,
			};
		}

		return {
			accessLevel: "none",
			success: true,
		};
	},

	async getRepoOwnership(
		token: string,
		owner: string,
		repo: string,
	): Promise<RepoOwnershipResult> {
		const projectPath = encodeProjectPath(owner, repo);

		// GET /projects/:id
		const { data, error } = await gitlabFetch<{
			namespace: {
				name: string;
				path: string;
				kind: string; // "user" or "group"
			};
			name: string;
			path: string;
			web_url: string;
		}>(token, `/projects/${projectPath}`);

		if (error || !data) {
			return {
				ownership: {
					owner,
					repo,
					isOrg: false,
					provider: "gitlab",
					remoteUrl: `https://gitlab.com/${owner}/${repo}`,
				},
				success: false,
				error: error || "Project not found or inaccessible",
			};
		}

		return {
			ownership: {
				owner: data.namespace.path,
				repo: data.path,
				isOrg: data.namespace.kind === "group",
				provider: "gitlab",
				remoteUrl: data.web_url,
			},
			success: true,
		};
	},

	async checkOrgMembership(
		token: string,
		orgName: string,
		username: string,
	): Promise<OrgMembershipResult> {
		// Get user ID
		const userResult = await gitlabFetch<Array<{ id: number }>>(
			token,
			`/users?username=${encodeURIComponent(username)}`,
		);

		if (!userResult.data || userResult.data.length === 0) {
			return {
				isMember: false,
				role: "none",
				success: false,
				error: "User not found",
			};
		}

		const userId = userResult.data[0].id;

		// Get group membership
		// GET /groups/:id/members/:user_id
		const memberResult = await gitlabFetch<{
			access_level: number;
		}>(token, `/groups/${encodeURIComponent(orgName)}/members/${userId}`);

		if (memberResult.data) {
			return {
				isMember: true,
				role: mapGitLabGroupRole(memberResult.data.access_level),
				success: true,
			};
		}

		// Try inherited membership
		const inheritedResult = await gitlabFetch<{
			access_level: number;
		}>(token, `/groups/${encodeURIComponent(orgName)}/members/all/${userId}`);

		if (inheritedResult.data) {
			return {
				isMember: true,
				role: mapGitLabGroupRole(inheritedResult.data.access_level),
				success: true,
			};
		}

		return {
			isMember: false,
			role: "none",
			success: true,
		};
	},
};

// Register the GitLab provider
registerProvider(gitlabProvider);
