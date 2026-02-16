/**
 * Privacy Filter for Data Synchronization
 *
 * Determines whether a repository/session is eligible for sync
 * based on ownership (personal vs organization) and configuration.
 */

import {
  getSyncConfig,
  type SyncConfig as HanSyncConfig,
} from '../config/han-settings.ts';
import type { Repo, Session } from '../grpc/data-access.ts';
import {
  DEFAULT_SYNC_CONFIG,
  type SyncConfig,
  type SyncEligibility,
} from './types.ts';

/**
 * Parsed Git remote URL information
 */
interface ParsedRemote {
  host: string;
  owner: string;
  repo: string;
  isSSH: boolean;
}

/**
 * Parse a Git remote URL into its components
 * Supports:
 * - SSH: git@github.com:owner/repo.git
 * - HTTPS: https://github.com/owner/repo.git
 * - HTTPS with auth: https://user@github.com/owner/repo.git
 */
export function parseGitRemote(remote: string): ParsedRemote | null {
  if (!remote) {
    return null;
  }

  // SSH format: git@host:owner/repo.git
  const sshMatch = remote.match(
    /^(?:git@|ssh:\/\/(?:git@)?)([^:/]+)[:/]([^/]+)\/([^/]+?)(?:\.git)?$/
  );
  if (sshMatch) {
    return {
      host: sshMatch[1],
      owner: sshMatch[2],
      repo: sshMatch[3],
      isSSH: true,
    };
  }

  // HTTPS format: https://[user@]host/owner/repo[.git]
  const httpsMatch = remote.match(
    /^https?:\/\/(?:[^@]+@)?([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?$/
  );
  if (httpsMatch) {
    return {
      host: httpsMatch[1],
      owner: httpsMatch[2],
      repo: httpsMatch[3],
      isSSH: false,
    };
  }

  return null;
}

/**
 * Check if a remote URL matches any pattern in a list
 * Patterns can be:
 * - Exact match: "github.com/org/repo"
 * - Owner wildcard: "github.com/org/\*"
 * - Host wildcard: "github.com/\*\/\*"
 * - Simple substring: "org-name"
 */
export function matchesPattern(remote: string, patterns: string[]): boolean {
  const parsed = parseGitRemote(remote);
  if (!parsed) {
    // Fall back to substring matching for unparseable remotes
    return patterns.some((pattern) =>
      remote.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  const normalizedRemote =
    `${parsed.host}/${parsed.owner}/${parsed.repo}`.toLowerCase();

  for (const pattern of patterns) {
    const normalizedPattern = pattern.toLowerCase().replace(/\.git$/, '');

    // Exact match
    if (normalizedRemote === normalizedPattern) {
      return true;
    }

    // Wildcard patterns
    if (normalizedPattern.includes('*')) {
      const regexPattern = normalizedPattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '[^/]+');
      const regex = new RegExp(`^${regexPattern}$`);
      if (regex.test(normalizedRemote)) {
        return true;
      }
    }

    // Owner-only match (e.g., "mycompany" matches "github.com/mycompany/repo")
    if (
      !normalizedPattern.includes('/') &&
      parsed.owner.toLowerCase() === normalizedPattern
    ) {
      return true;
    }

    // Substring match as fallback
    if (normalizedRemote.includes(normalizedPattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Determine if a repository appears to be personal
 * Heuristics:
 * 1. Owner matches common personal username patterns
 * 2. Single-word owner without org indicators
 * 3. No team/company indicators in path
 */
export function isPersonalRepo(parsed: ParsedRemote): boolean {
  const owner = parsed.owner.toLowerCase();

  // Common organizational indicators
  const orgIndicators = [
    '-org',
    '-inc',
    '-corp',
    '-company',
    '-team',
    '-labs',
    '-studio',
    '-hq',
    'enterprise',
  ];

  // If owner has org indicators, likely not personal
  if (orgIndicators.some((indicator) => owner.includes(indicator))) {
    return false;
  }

  // Common personal username patterns (GitHub, GitLab)
  // Usually personal usernames are short, alphanumeric, possibly with dashes
  // Organizations often have longer, more descriptive names
  const personalPatterns = [
    /^[a-z][a-z0-9]{2,15}$/, // Simple alphanumeric (3-16 chars)
    /^[a-z]+-[a-z]+$/, // firstname-lastname pattern
  ];

  return personalPatterns.some((pattern) => pattern.test(owner));
}

/**
 * Convert HanSyncConfig to full SyncConfig with defaults
 */
function resolveConfig(config?: SyncConfig | HanSyncConfig | null): SyncConfig {
  if (!config) {
    const hanConfig = getSyncConfig();
    if (!hanConfig) {
      return DEFAULT_SYNC_CONFIG;
    }
    return {
      ...DEFAULT_SYNC_CONFIG,
      ...hanConfig,
      enabled: hanConfig.enabled ?? false,
      endpoint: hanConfig.endpoint ?? '',
      apiKey: hanConfig.apiKey ?? '',
      interval: hanConfig.interval ?? 300,
      batchSize: hanConfig.batchSize ?? 1000,
      includePersonal: hanConfig.includePersonal ?? false,
      forceInclude: hanConfig.forceInclude ?? [],
      forceExclude: hanConfig.forceExclude ?? [],
      includeContent: hanConfig.includeContent ?? false,
      compression: hanConfig.compression ?? true,
    };
  }
  // If it's already a full SyncConfig, return it
  if ('endpoint' in config && typeof config.enabled === 'boolean') {
    return config as SyncConfig;
  }
  // It's a HanSyncConfig, merge with defaults
  return {
    ...DEFAULT_SYNC_CONFIG,
    ...config,
    enabled: config.enabled ?? false,
    endpoint: config.endpoint ?? '',
    apiKey: config.apiKey ?? '',
    interval: config.interval ?? 300,
    batchSize: config.batchSize ?? 1000,
    includePersonal: config.includePersonal ?? false,
    forceInclude: config.forceInclude ?? [],
    forceExclude: config.forceExclude ?? [],
    includeContent: config.includeContent ?? false,
    compression: config.compression ?? true,
  };
}

/**
 * Check sync eligibility for a session/repo combination
 */
export function checkSyncEligibility(
  _session: Session,
  repo: Repo | null,
  config?: SyncConfig | HanSyncConfig | null,
  _userId?: string
): SyncEligibility {
  // Get config if not provided
  const syncConfig = resolveConfig(config);

  // No repo means we can't determine eligibility
  if (!repo || !repo.remote) {
    return {
      eligible: false,
      reason: 'No repository information available',
      repoType: 'unknown',
      repoOwner: null,
    };
  }

  // Parse the remote URL
  const parsed = parseGitRemote(repo.remote);
  if (!parsed) {
    return {
      eligible: false,
      reason: `Unable to parse repository remote: ${repo.remote}`,
      repoType: 'unknown',
      repoOwner: null,
    };
  }

  // Check forced exclusions first (highest priority)
  if (syncConfig?.forceExclude?.length) {
    if (matchesPattern(repo.remote, syncConfig.forceExclude)) {
      return {
        eligible: false,
        reason: 'Repository is in force exclude list',
        repoType: isPersonalRepo(parsed) ? 'personal' : 'organization',
        repoOwner: parsed.owner,
      };
    }
  }

  // Check forced inclusions (overrides personal repo check)
  if (syncConfig?.forceInclude?.length) {
    if (matchesPattern(repo.remote, syncConfig.forceInclude)) {
      return {
        eligible: true,
        reason: 'Repository is in force include list',
        repoType: isPersonalRepo(parsed) ? 'personal' : 'organization',
        repoOwner: parsed.owner,
      };
    }
  }

  // Check if personal repo
  const personal = isPersonalRepo(parsed);

  if (personal) {
    // Personal repos are excluded by default
    if (!syncConfig?.includePersonal) {
      return {
        eligible: false,
        reason:
          'Personal repositories are excluded by default. Set includePersonal: true or add to forceInclude to sync.',
        repoType: 'personal',
        repoOwner: parsed.owner,
      };
    }
  }

  // Organization repo or personal with includePersonal enabled
  return {
    eligible: true,
    reason: personal
      ? 'Personal repository included via configuration'
      : 'Organization repository eligible for sync',
    repoType: personal ? 'personal' : 'organization',
    repoOwner: parsed.owner,
  };
}

/**
 * Batch check eligibility for multiple sessions
 */
export function checkBatchEligibility(
  sessions: Array<{ session: Session; repo: Repo | null }>,
  config?: SyncConfig | null,
  userId?: string
): Map<string, SyncEligibility> {
  const results = new Map<string, SyncEligibility>();
  const syncConfig = config ?? getSyncConfig();

  for (const { session, repo } of sessions) {
    results.set(
      session.id,
      checkSyncEligibility(session, repo, syncConfig, userId)
    );
  }

  return results;
}

/**
 * Get a summary of eligibility for a list of sessions
 */
export function getEligibilitySummary(
  eligibility: Map<string, SyncEligibility>
): {
  eligible: number;
  excluded: number;
  personal: number;
  organization: number;
  unknown: number;
  reasons: Record<string, number>;
} {
  const summary = {
    eligible: 0,
    excluded: 0,
    personal: 0,
    organization: 0,
    unknown: 0,
    reasons: {} as Record<string, number>,
  };

  for (const result of eligibility.values()) {
    if (result.eligible) {
      summary.eligible++;
    } else {
      summary.excluded++;
    }

    switch (result.repoType) {
      case 'personal':
        summary.personal++;
        break;
      case 'organization':
        summary.organization++;
        break;
      default:
        summary.unknown++;
    }

    // Track reasons
    summary.reasons[result.reason] = (summary.reasons[result.reason] || 0) + 1;
  }

  return summary;
}
