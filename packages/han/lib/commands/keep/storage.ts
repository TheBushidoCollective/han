/**
 * Scoped key-value storage for han keep
 *
 * Storage layout:
 * {claude-config-dir}/han/keep/
 * ├── global/
 * │   └── {key}
 * └── repos/
 *     └── {repo-slug}/
 *         ├── {key}                    # repo-scoped
 *         └── branches/
 *             └── {branch}/
 *                 └── {key}            # branch-scoped
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { getClaudeConfigDir } from '../../config/claude-settings.ts';
import { getGitBranch, getGitRemoteUrl } from '../../bun-utils.ts';

export type Scope = 'global' | 'repo' | 'branch';

/**
 * Options for storage operations
 */
export interface StorageOptions {
  /**
   * Explicit branch name for branch-scoped storage.
   * If not provided, the current branch is auto-detected.
   * Only used when scope is "branch".
   */
  branchName?: string;
}

/**
 * Normalize a git remote URL to a safe directory slug
 * Examples:
 *   git@github.com:user/repo.git -> github.com-user-repo
 *   https://github.com/user/repo.git -> github.com-user-repo
 *   https://github.com/user/repo -> github.com-user-repo
 */
export function normalizeGitRemote(remote: string | null): string {
  if (!remote) {
    return 'unknown';
  }

  // Remove protocol prefix
  let normalized = remote
    .replace(/^git@/, '')
    .replace(/^https?:\/\//, '')
    .replace(/^ssh:\/\//, '');

  // Remove .git suffix
  normalized = normalized.replace(/\.git$/, '');

  // Replace special characters with hyphens
  normalized = normalized
    .replace(/:/g, '-')
    .replace(/\//g, '-')
    .replace(/\./g, '-')
    .replace(/-+/g, '-') // collapse multiple hyphens
    .replace(/^-|-$/g, ''); // trim leading/trailing hyphens

  return normalized || 'unknown';
}

/**
 * Normalize a git branch name to a safe directory name
 * Examples:
 *   feature/my-branch -> feature-my-branch
 *   refs/heads/main -> main
 */
export function normalizeBranchName(branch: string | null): string {
  if (!branch) {
    return 'unknown';
  }

  // Remove refs/heads/ prefix if present
  let normalized = branch.replace(/^refs\/heads\//, '');

  // Replace special characters with hyphens
  normalized = normalized
    .replace(/\//g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'unknown';
}

/**
 * Get the base directory for keep storage
 */
export function getKeepBaseDir(): string {
  const configDir = getClaudeConfigDir();
  return join(configDir, 'han', 'keep');
}

/**
 * Get the storage path for a given scope and key
 */
export function getStoragePath(
  scope: Scope,
  key: string,
  options?: StorageOptions
): string {
  const keepDir = getKeepBaseDir();
  const cwd = process.cwd();

  switch (scope) {
    case 'global':
      return join(keepDir, 'global', key);

    case 'repo': {
      const remote = getGitRemoteUrl(cwd);
      const repoSlug = normalizeGitRemote(remote);
      return join(keepDir, 'repos', repoSlug, key);
    }

    case 'branch': {
      const remote = getGitRemoteUrl(cwd);
      const repoSlug = normalizeGitRemote(remote);
      // Use explicit branch name if provided, else detect current
      const branch = options?.branchName ?? getGitBranch(cwd);
      const branchSlug = normalizeBranchName(branch);
      return join(keepDir, 'repos', repoSlug, 'branches', branchSlug, key);
    }
  }
}

/**
 * Get the directory for listing keys in a scope
 */
export function getScopeDir(scope: Scope, options?: StorageOptions): string {
  const keepDir = getKeepBaseDir();
  const cwd = process.cwd();

  switch (scope) {
    case 'global':
      return join(keepDir, 'global');

    case 'repo': {
      const remote = getGitRemoteUrl(cwd);
      const repoSlug = normalizeGitRemote(remote);
      return join(keepDir, 'repos', repoSlug);
    }

    case 'branch': {
      const remote = getGitRemoteUrl(cwd);
      const repoSlug = normalizeGitRemote(remote);
      // Use explicit branch name if provided, else detect current
      const branch = options?.branchName ?? getGitBranch(cwd);
      const branchSlug = normalizeBranchName(branch);
      return join(keepDir, 'repos', repoSlug, 'branches', branchSlug);
    }
  }
}

/**
 * Save content to scoped storage
 */
export function save(
  scope: Scope,
  key: string,
  content: string,
  options?: StorageOptions
): void {
  const path = getStoragePath(scope, key, options);
  const dir = dirname(path);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(path, content, 'utf-8');
}

/**
 * Load content from scoped storage
 * Returns null if key doesn't exist
 */
export function load(
  scope: Scope,
  key: string,
  options?: StorageOptions
): string | null {
  const path = getStoragePath(scope, key, options);

  if (!existsSync(path)) {
    return null;
  }

  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * List all keys in a scope
 * Returns only files (not directories like "branches")
 */
export function list(scope: Scope, options?: StorageOptions): string[] {
  const dir = getScopeDir(scope, options);

  if (!existsSync(dir)) {
    return [];
  }

  try {
    const entries = readdirSync(dir);
    // Filter out directories (like "branches" in repo scope)
    return entries.filter((entry) => {
      const entryPath = join(dir, entry);
      try {
        return statSync(entryPath).isFile();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

/**
 * Remove a key from scoped storage
 * Returns true if the key existed and was deleted
 */
export function remove(
  scope: Scope,
  key: string,
  options?: StorageOptions
): boolean {
  const path = getStoragePath(scope, key, options);

  if (!existsSync(path)) {
    return false;
  }

  try {
    rmSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear all keys in a scope
 * Returns the number of keys deleted
 */
export function clear(scope: Scope, options?: StorageOptions): number {
  const keys = list(scope, options);
  let deleted = 0;

  for (const key of keys) {
    if (remove(scope, key, options)) {
      deleted++;
    }
  }

  return deleted;
}
