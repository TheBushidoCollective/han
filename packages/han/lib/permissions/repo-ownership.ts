/**
 * Repository Ownership Detection
 *
 * Parses git remote URLs to extract owner, repo, and provider information.
 * Supports various URL formats from GitHub, GitLab, and Bitbucket.
 */

import type { GitProvider, RepoOwnership } from './types.ts';

/**
 * Patterns for parsing git remote URLs
 *
 * Supported formats:
 * - git@github.com:owner/repo.git
 * - https://github.com/owner/repo.git
 * - https://github.com/owner/repo
 * - ssh://git@github.com/owner/repo.git
 * - git://github.com/owner/repo.git
 */
const REMOTE_PATTERNS: Array<{
  provider: GitProvider;
  patterns: RegExp[];
}> = [
  {
    provider: 'github',
    patterns: [
      // SSH: git@github.com:owner/repo.git
      /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/,
      // HTTPS: https://github.com/owner/repo.git
      /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/,
      // SSH with protocol: ssh://git@github.com/owner/repo.git
      /^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/,
      // Git protocol: git://github.com/owner/repo.git
      /^git:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/,
    ],
  },
  {
    provider: 'gitlab',
    patterns: [
      // SSH: git@gitlab.com:owner/repo.git (also supports groups: owner/subgroup/repo)
      /^git@gitlab\.com:([^/]+(?:\/[^/]+)*)\/([^/]+?)(?:\.git)?$/,
      // HTTPS: https://gitlab.com/owner/repo.git
      /^https?:\/\/gitlab\.com\/([^/]+(?:\/[^/]+)*)\/([^/]+?)(?:\.git)?$/,
      // SSH with protocol
      /^ssh:\/\/git@gitlab\.com\/([^/]+(?:\/[^/]+)*)\/([^/]+?)(?:\.git)?$/,
    ],
  },
  {
    provider: 'bitbucket',
    patterns: [
      // SSH: git@bitbucket.org:owner/repo.git
      /^git@bitbucket\.org:([^/]+)\/([^/]+?)(?:\.git)?$/,
      // HTTPS: https://bitbucket.org/owner/repo.git
      /^https?:\/\/bitbucket\.org\/([^/]+)\/([^/]+?)(?:\.git)?$/,
    ],
  },
];

/**
 * Parse a git remote URL and extract ownership information
 *
 * @param remoteUrl - Git remote URL (SSH or HTTPS format)
 * @returns Parsed ownership info or null if URL format is not recognized
 */
export function parseRemoteUrl(remoteUrl: string): RepoOwnership | null {
  const trimmedUrl = remoteUrl.trim();

  for (const { provider, patterns } of REMOTE_PATTERNS) {
    for (const pattern of patterns) {
      const match = trimmedUrl.match(pattern);
      if (match) {
        const owner = match[1];
        const repo = match[2];

        return {
          owner,
          repo,
          isOrg: false, // Will be determined by API call
          provider,
          remoteUrl: trimmedUrl,
        };
      }
    }
  }

  return null;
}

/**
 * Check if a repository owner is likely a personal account (not an org)
 *
 * This is a heuristic - actual determination requires an API call.
 * Returns true if the owner name matches common personal account patterns.
 *
 * @param owner - Repository owner name
 * @param currentUsername - The current user's username (if known)
 */
export function isLikelyPersonalRepo(
  owner: string,
  currentUsername?: string
): boolean {
  // If the owner matches the current user, it's definitely personal
  if (
    currentUsername &&
    owner.toLowerCase() === currentUsername.toLowerCase()
  ) {
    return true;
  }

  // Common organization naming patterns (not personal)
  const orgPatterns = [
    /^[a-z]+-(?:inc|corp|labs|io|ai|dev|hq|team|org|co)$/i,
    /^the[a-z]+$/i, // thecompany, theteam, etc.
    /^[a-z]+(?:hq|labs|inc)$/i,
  ];

  for (const pattern of orgPatterns) {
    if (pattern.test(owner)) {
      return false;
    }
  }

  // Default to "might be personal" - API call will determine for sure
  return true;
}

/**
 * Normalize a repository identifier to a consistent format
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Normalized repo ID in "owner/repo" format (lowercase)
 */
export function normalizeRepoId(owner: string, repo: string): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

/**
 * Extract provider from a remote URL without full parsing
 *
 * @param remoteUrl - Git remote URL
 * @returns The git provider or "unknown"
 */
export function getProviderFromUrl(remoteUrl: string): GitProvider {
  const url = remoteUrl.toLowerCase();

  if (url.includes('github.com')) {
    return 'github';
  }
  if (url.includes('gitlab.com')) {
    return 'gitlab';
  }
  if (url.includes('bitbucket.org')) {
    return 'bitbucket';
  }

  return 'unknown';
}

/**
 * Build a repository URL from ownership info
 *
 * @param ownership - Repository ownership information
 * @param format - URL format to generate ("https" | "ssh")
 * @returns The formatted URL
 */
export function buildRepoUrl(
  ownership: RepoOwnership,
  format: 'https' | 'ssh' = 'https'
): string {
  const { owner, repo, provider } = ownership;

  switch (provider) {
    case 'github':
      return format === 'ssh'
        ? `git@github.com:${owner}/${repo}.git`
        : `https://github.com/${owner}/${repo}`;

    case 'gitlab':
      return format === 'ssh'
        ? `git@gitlab.com:${owner}/${repo}.git`
        : `https://gitlab.com/${owner}/${repo}`;

    case 'bitbucket':
      return format === 'ssh'
        ? `git@bitbucket.org:${owner}/${repo}.git`
        : `https://bitbucket.org/${owner}/${repo}`;

    default:
      return ownership.remoteUrl;
  }
}
