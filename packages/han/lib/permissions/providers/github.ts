/**
 * GitHub Provider Implementation
 *
 * Implements the GitProviderService interface for GitHub.
 * Uses the GitHub REST API to check repository permissions.
 */

import type {
  GitProviderService,
  OrgMembershipResult,
  RepoAccessResult,
  RepoOwnershipResult,
} from '../git-provider.ts';
import { registerProvider } from '../git-provider.ts';
import type { AccessLevel, OrgRole } from '../types.ts';

/**
 * GitHub API base URL
 */
const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Map GitHub permission level to our AccessLevel
 */
function mapGitHubPermission(permission: string): AccessLevel {
  switch (permission.toLowerCase()) {
    case 'admin':
      return 'admin';
    case 'maintain':
      return 'maintain';
    case 'push':
    case 'write':
      return 'write';
    case 'triage':
      return 'triage';
    case 'pull':
    case 'read':
      return 'read';
    default:
      return 'none';
  }
}

/**
 * Map GitHub org role to our OrgRole
 */
function mapGitHubOrgRole(role: string): OrgRole {
  switch (role.toLowerCase()) {
    case 'admin':
      return 'admin';
    case 'member':
      return 'member';
    case 'billing_manager':
      return 'viewer';
    default:
      return 'none';
  }
}

/**
 * Make an authenticated GitHub API request
 */
async function githubFetch<T>(
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T | null; status: number; error?: string }> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${GITHUB_API_BASE}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...options.headers,
      },
    });

    if (!response.ok) {
      // Special handling for 404 - means no access
      if (response.status === 404) {
        return { data: null, status: 404 };
      }

      // Rate limiting
      if (response.status === 403) {
        const remaining = response.headers.get('X-RateLimit-Remaining');
        if (remaining === '0') {
          return {
            data: null,
            status: 403,
            error: 'GitHub API rate limit exceeded',
          };
        }
      }

      return {
        data: null,
        status: response.status,
        error: `GitHub API error: ${response.status} ${response.statusText}`,
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
 * GitHub provider implementation
 */
export const githubProvider: GitProviderService = {
  name: 'github',

  async checkRepoAccess(
    token: string,
    owner: string,
    repo: string,
    username: string
  ): Promise<RepoAccessResult> {
    // First, try to get the user's permission level for this repo
    // GET /repos/{owner}/{repo}/collaborators/{username}/permission
    const { data, status, error } = await githubFetch<{
      permission: string;
      role_name: string;
    }>(token, `/repos/${owner}/${repo}/collaborators/${username}/permission`);

    if (error) {
      return {
        accessLevel: 'none',
        success: false,
        error,
      };
    }

    // 404 means user is not a collaborator - check if repo is public
    if (status === 404 || !data) {
      // Try to access the repo directly - if it's public, user has read access
      const repoResult = await githubFetch<{ private: boolean }>(
        token,
        `/repos/${owner}/${repo}`
      );

      if (repoResult.data && !repoResult.data.private) {
        return {
          accessLevel: 'read',
          success: true,
        };
      }

      return {
        accessLevel: 'none',
        success: true,
      };
    }

    return {
      accessLevel: mapGitHubPermission(data.permission || data.role_name),
      success: true,
    };
  },

  async getRepoOwnership(
    token: string,
    owner: string,
    repo: string
  ): Promise<RepoOwnershipResult> {
    // GET /repos/{owner}/{repo}
    const { data, error } = await githubFetch<{
      owner: {
        login: string;
        type: string;
      };
      name: string;
      html_url: string;
    }>(token, `/repos/${owner}/${repo}`);

    if (error || !data) {
      return {
        ownership: {
          owner,
          repo,
          isOrg: false, // Default assumption
          provider: 'github',
          remoteUrl: `https://github.com/${owner}/${repo}`,
        },
        success: false,
        error: error || 'Repository not found or inaccessible',
      };
    }

    return {
      ownership: {
        owner: data.owner.login,
        repo: data.name,
        isOrg: data.owner.type === 'Organization',
        provider: 'github',
        remoteUrl: data.html_url,
      },
      success: true,
    };
  },

  async checkOrgMembership(
    token: string,
    orgName: string,
    username: string
  ): Promise<OrgMembershipResult> {
    // First check if user is a member
    // GET /orgs/{org}/members/{username}
    const memberCheck = await githubFetch<void>(
      token,
      `/orgs/${orgName}/members/${username}`
    );

    // 204 = is a member, 404 = not a member, 302 = requester is not org member
    if (memberCheck.status === 204) {
      // User is a member, now get their role
      // GET /orgs/{org}/memberships/{username}
      const membershipResult = await githubFetch<{
        role: string;
        state: string;
      }>(token, `/orgs/${orgName}/memberships/${username}`);

      if (membershipResult.data) {
        return {
          isMember: membershipResult.data.state === 'active',
          role: mapGitHubOrgRole(membershipResult.data.role),
          success: true,
        };
      }

      // Fallback - we know they're a member from the first check
      return {
        isMember: true,
        role: 'member',
        success: true,
      };
    }

    if (memberCheck.status === 404) {
      return {
        isMember: false,
        role: 'none',
        success: true,
      };
    }

    // Other errors
    return {
      isMember: false,
      role: 'none',
      success: false,
      error: memberCheck.error || `Unexpected status: ${memberCheck.status}`,
    };
  },
};

// Register the GitHub provider
registerProvider(githubProvider);
