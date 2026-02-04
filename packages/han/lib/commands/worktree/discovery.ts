/**
 * AI-DLC Worktree Discovery
 *
 * Functions for discovering and managing AI-DLC worktrees.
 * Supports both git worktrees and jj workspaces.
 *
 * AI-DLC worktrees follow the naming convention:
 * - Intent worktrees: /tmp/ai-dlc-{intent-slug}/
 * - Unit worktrees: /tmp/ai-dlc-{intent-slug}-{unit-slug}/
 * - Branches: ai-dlc/{intent-slug} or ai-dlc/{intent-slug}/{unit-slug}
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { type GitWorktree, gitWorktreeList } from '../../native.ts';

/**
 * Detect which VCS is being used
 */
export function detectVcs(directory?: string): 'git' | 'jj' | null {
  const cwd = directory || process.cwd();

  try {
    // Check for jj first (it can coexist with git)
    execSync('jj root', { cwd, stdio: 'pipe' });
    return 'jj';
  } catch {
    // Not a jj repo
  }

  try {
    execSync('git rev-parse --git-dir', { cwd, stdio: 'pipe' });
    return 'git';
  } catch {
    // Not a git repo
  }

  return null;
}

/**
 * jj workspace information (equivalent to GitWorktree)
 */
export interface JjWorkspace {
  /** Workspace name */
  name: string;
  /** Absolute path to the workspace */
  path: string;
  /** Current commit/change ID */
  changeId?: string;
  /** Whether this is the default workspace */
  isDefault: boolean;
}

/**
 * List jj workspaces (equivalent to `jj workspace list`)
 */
export function jjWorkspaceList(directory: string): JjWorkspace[] {
  try {
    const output = execSync('jj workspace list', {
      cwd: directory,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
      .toString()
      .trim();

    const workspaces: JjWorkspace[] = [];
    const lines = output.split('\n').filter((l) => l.trim());

    for (const line of lines) {
      // Format: "name: path @ change_id"
      // Or: "default: path @ change_id" (with asterisk for current)
      const match = line.match(/^(\*?\s*)(\S+):\s+(.+?)\s+@\s+(\S+)/);
      if (match) {
        workspaces.push({
          name: match[2],
          path: match[3],
          changeId: match[4],
          isDefault: match[2] === 'default' || match[1].includes('*'),
        });
      }
    }

    return workspaces;
  } catch {
    return [];
  }
}

/**
 * Unit status values
 */
export type UnitStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

/**
 * Information about an AI-DLC intent
 */
export interface AiDlcIntent {
  /** Intent slug (e.g., "vcs-strategy-config") */
  slug: string;
  /** Intent title from frontmatter */
  title?: string;
  /** Intent status (active, completed, abandoned) */
  status: 'active' | 'completed' | 'abandoned';
  /** Workflow name (default, tdd, hypothesis) */
  workflow: string;
  /** Created date */
  created?: string;
  /** Path to intent directory */
  intentDir: string;
}

/**
 * Information about an AI-DLC unit
 */
export interface AiDlcUnit {
  /** Unit name (e.g., "unit-01-core-backend") */
  name: string;
  /** Unit slug without "unit-" prefix */
  slug: string;
  /** Unit status */
  status: UnitStatus;
  /** Dependencies (unit names this depends on) */
  dependsOn: string[];
  /** Branch name for this unit */
  branch?: string;
  /** Path to unit file */
  filePath: string;
}

/**
 * Enhanced worktree information for AI-DLC
 */
export interface AiDlcWorktree extends GitWorktree {
  /** Intent slug if this is an AI-DLC worktree */
  intentSlug?: string;
  /** Unit slug if this is a unit worktree */
  unitSlug?: string;
  /** Whether this worktree is stale (unit completed but worktree exists) */
  isStale: boolean;
  /** Whether this is orphaned (no matching branch) */
  isOrphaned: boolean;
  /** Type of AI-DLC worktree */
  type: 'intent' | 'unit' | 'non-ai-dlc';
}

/**
 * Parse YAML frontmatter from a markdown file
 * Uses han parse yaml for consistency with shell scripts
 */
function parseYamlFromFile(
  filePath: string,
  key: string,
  defaultValue = ''
): string {
  try {
    if (!existsSync(filePath)) return defaultValue;
    const content = readFileSync(filePath, 'utf-8');
    const result = execSync(
      `han parse yaml ${key} -r --default "${defaultValue}"`,
      {
        input: content,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
    return result.toString().trim();
  } catch {
    return defaultValue;
  }
}

/**
 * Parse JSON array from YAML frontmatter
 */
function parseYamlArrayFromFile(filePath: string, key: string): string[] {
  try {
    if (!existsSync(filePath)) return [];
    const content = readFileSync(filePath, 'utf-8');
    const result = execSync(`han parse yaml ${key} --json`, {
      input: content,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(result.toString());
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Find all intents in the .ai-dlc directory
 */
export function findIntents(repoRoot: string): AiDlcIntent[] {
  const aiDlcDir = join(repoRoot, '.ai-dlc');
  if (!existsSync(aiDlcDir)) return [];

  const intents: AiDlcIntent[] = [];

  try {
    const entries = readdirSync(aiDlcDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'settings.yml' || entry.name.startsWith('.')) continue;

      const intentDir = join(aiDlcDir, entry.name);
      const intentFile = join(intentDir, 'intent.md');

      if (!existsSync(intentFile)) continue;

      const status = parseYamlFromFile(intentFile, 'status', 'active');
      const workflow = parseYamlFromFile(intentFile, 'workflow', 'default');
      const title = parseYamlFromFile(intentFile, 'title', '');
      const created = parseYamlFromFile(intentFile, 'created', '');

      intents.push({
        slug: entry.name,
        title: title || undefined,
        status: status as 'active' | 'completed' | 'abandoned',
        workflow,
        created: created || undefined,
        intentDir,
      });
    }
  } catch {
    // Directory read failed
  }

  return intents;
}

/**
 * Find all units for a given intent
 */
export function findUnits(intentDir: string): AiDlcUnit[] {
  if (!existsSync(intentDir)) return [];

  const units: AiDlcUnit[] = [];

  try {
    const entries = readdirSync(intentDir);

    for (const entry of entries) {
      if (!entry.startsWith('unit-') || !entry.endsWith('.md')) continue;

      const filePath = join(intentDir, entry);
      const name = entry.replace('.md', '');
      const slug = name.replace(/^unit-/, '');

      const status = parseYamlFromFile(filePath, 'status', 'pending');
      const dependsOn = parseYamlArrayFromFile(filePath, 'depends_on');
      const branch = parseYamlFromFile(filePath, 'branch', '');

      units.push({
        name,
        slug,
        status: status as UnitStatus,
        dependsOn,
        branch: branch || undefined,
        filePath,
      });
    }
  } catch {
    // Directory read failed
  }

  // Sort by unit number
  return units.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get unit status from a unit file
 */
export function getUnitStatus(unitFilePath: string): UnitStatus {
  return parseYamlFromFile(unitFilePath, 'status', 'pending') as UnitStatus;
}

/**
 * Check if a branch exists in the repository
 */
function branchExists(repoRoot: string, branchName: string): boolean {
  try {
    execSync(`git rev-parse --verify "${branchName}"`, {
      cwd: repoRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse AI-DLC info from a worktree path
 * Returns intent and unit slugs if applicable
 */
function parseAiDlcWorktreePath(worktreePath: string): {
  intentSlug?: string;
  unitSlug?: string;
  type: 'intent' | 'unit' | 'non-ai-dlc';
} {
  const name = basename(worktreePath);

  // Match unit worktrees: ai-dlc-{intent}-{unit}
  // Unit slugs typically have format like "01-setup" (digit prefix)
  const unitMatch = name.match(
    /^ai-dlc-([^-]+-[^-]+(?:-[^0-9][^-]*)*)-(\d+-.+)$/
  );
  if (unitMatch) {
    return {
      intentSlug: unitMatch[1],
      unitSlug: unitMatch[2],
      type: 'unit',
    };
  }

  // Match intent worktrees: ai-dlc-{intent}
  const intentMatch = name.match(/^ai-dlc-(.+)$/);
  if (intentMatch) {
    return {
      intentSlug: intentMatch[1],
      type: 'intent',
    };
  }

  return { type: 'non-ai-dlc' };
}

/**
 * Parse AI-DLC info from a branch name
 */
function parseAiDlcBranch(branchName: string): {
  intentSlug?: string;
  unitSlug?: string;
  isAiDlc: boolean;
} {
  // Match ai-dlc/{intent}/{unit} or ai-dlc/{intent}
  const fullMatch = branchName.match(/^ai-dlc\/([^/]+)\/(.+)$/);
  if (fullMatch) {
    return {
      intentSlug: fullMatch[1],
      unitSlug: fullMatch[2],
      isAiDlc: true,
    };
  }

  const intentMatch = branchName.match(/^ai-dlc\/([^/]+)$/);
  if (intentMatch) {
    return {
      intentSlug: intentMatch[1],
      isAiDlc: true,
    };
  }

  return { isAiDlc: false };
}

/**
 * Discover all AI-DLC worktrees with enhanced metadata
 */
export function discoverAiDlcWorktrees(repoRoot: string): AiDlcWorktree[] {
  const worktrees = gitWorktreeList(repoRoot);
  const intents = findIntents(repoRoot);

  // Build a map of intent slugs to their units
  const intentUnitsMap = new Map<string, AiDlcUnit[]>();
  for (const intent of intents) {
    const units = findUnits(intent.intentDir);
    intentUnitsMap.set(intent.slug, units);
  }

  const results: AiDlcWorktree[] = [];

  for (const wt of worktrees) {
    const pathInfo = parseAiDlcWorktreePath(wt.path);
    const branchInfo = wt.head ? parseAiDlcBranch(wt.head) : { isAiDlc: false };

    // Determine type and slugs from both path and branch
    let type: 'intent' | 'unit' | 'non-ai-dlc' = pathInfo.type;
    const intentSlug = pathInfo.intentSlug || branchInfo.intentSlug;
    const unitSlug = pathInfo.unitSlug || branchInfo.unitSlug;

    // If branch indicates AI-DLC but path doesn't recognize it,
    // it might still be an AI-DLC worktree
    if (branchInfo.isAiDlc && type === 'non-ai-dlc') {
      type = branchInfo.unitSlug ? 'unit' : 'intent';
    }

    // Check if orphaned (branch doesn't exist)
    let isOrphaned = false;
    if (wt.head && branchInfo.isAiDlc && !wt.isMain) {
      isOrphaned = !branchExists(repoRoot, wt.head);
    }

    // Check if stale (unit completed but worktree exists)
    let isStale = false;
    if (type === 'unit' && intentSlug && unitSlug) {
      const units = intentUnitsMap.get(intentSlug);
      if (units) {
        const unit = units.find(
          (u) => u.slug === unitSlug || u.name === `unit-${unitSlug}`
        );
        if (unit && unit.status === 'completed') {
          isStale = true;
        }
      }
    }

    results.push({
      ...wt,
      intentSlug,
      unitSlug,
      type,
      isStale,
      isOrphaned,
    });
  }

  return results;
}

/**
 * Find active worktrees for a specific intent
 */
export function findWorktreesForIntent(
  repoRoot: string,
  intentSlug: string
): AiDlcWorktree[] {
  const allWorktrees = discoverAiDlcWorktrees(repoRoot);
  return allWorktrees.filter(
    (wt) => wt.intentSlug === intentSlug && wt.type !== 'non-ai-dlc'
  );
}

/**
 * Check if there are existing worktrees for any active intent
 */
export function hasExistingWorktrees(repoRoot: string): boolean {
  const worktrees = discoverAiDlcWorktrees(repoRoot);
  return worktrees.some(
    (wt) => wt.type !== 'non-ai-dlc' && !wt.isMain && !wt.isOrphaned
  );
}

/**
 * Get orphaned worktrees (worktree exists but branch doesn't, or stale)
 */
export function findOrphanedWorktrees(repoRoot: string): AiDlcWorktree[] {
  const worktrees = discoverAiDlcWorktrees(repoRoot);
  return worktrees.filter((wt) => (wt.isOrphaned || wt.isStale) && !wt.isMain);
}

/**
 * Result of worktree discovery for /construct command
 */
export interface WorktreeDiscoveryResult {
  /** Whether existing worktrees were found */
  hasExisting: boolean;
  /** Active intent slugs with worktrees */
  activeIntents: string[];
  /** Details of found worktrees */
  worktrees: AiDlcWorktree[];
}

/**
 * Discover worktrees for the /construct command
 * Called when starting from the default branch
 */
export function discoverForConstruct(
  repoRoot: string
): WorktreeDiscoveryResult {
  const worktrees = discoverAiDlcWorktrees(repoRoot);
  const aiDlcWorktrees = worktrees.filter(
    (wt) => wt.type !== 'non-ai-dlc' && !wt.isMain
  );

  // Get unique active intent slugs
  const activeIntents = [
    ...new Set(
      aiDlcWorktrees
        .filter((wt) => wt.intentSlug && !wt.isOrphaned && !wt.isStale)
        .map((wt) => wt.intentSlug as string)
    ),
  ];

  return {
    hasExisting: aiDlcWorktrees.length > 0,
    activeIntents,
    worktrees: aiDlcWorktrees,
  };
}

/**
 * Unified worktree/workspace discovery for both git and jj
 * Returns GitWorktree-compatible objects for both VCS types
 */
export function listWorktrees(repoRoot: string): GitWorktree[] {
  const vcs = detectVcs(repoRoot);

  if (vcs === 'jj') {
    // Convert jj workspaces to GitWorktree format
    const workspaces = jjWorkspaceList(repoRoot);
    return workspaces.map((ws) => ({
      path: ws.path,
      name: ws.name,
      head: ws.changeId,
      isMain: ws.isDefault,
      isLocked: false,
    }));
  }

  if (vcs === 'git') {
    return gitWorktreeList(repoRoot);
  }

  return [];
}

/**
 * Discover AI-DLC worktrees for both git and jj
 * Uses the unified listWorktrees function
 */
export function discoverAiDlcWorktreesUnified(
  repoRoot: string
): AiDlcWorktree[] {
  const vcs = detectVcs(repoRoot);
  const worktrees = listWorktrees(repoRoot);
  const intents = findIntents(repoRoot);

  // Build a map of intent slugs to their units
  const intentUnitsMap = new Map<string, AiDlcUnit[]>();
  for (const intent of intents) {
    const units = findUnits(intent.intentDir);
    intentUnitsMap.set(intent.slug, units);
  }

  const results: AiDlcWorktree[] = [];

  for (const wt of worktrees) {
    const pathInfo = parseAiDlcWorktreePath(wt.path);

    // For jj, we don't have branch names the same way
    // Check if the path matches AI-DLC naming convention
    let branchInfo: {
      intentSlug?: string;
      unitSlug?: string;
      isAiDlc: boolean;
    };
    if (vcs === 'jj') {
      // For jj, determine AI-DLC status from path only
      branchInfo = {
        intentSlug: pathInfo.intentSlug,
        unitSlug: pathInfo.unitSlug,
        isAiDlc: pathInfo.type !== 'non-ai-dlc',
      };
    } else {
      branchInfo = wt.head ? parseAiDlcBranch(wt.head) : { isAiDlc: false };
    }

    // Determine type and slugs from both path and branch
    let type: 'intent' | 'unit' | 'non-ai-dlc' = pathInfo.type;
    const intentSlug = pathInfo.intentSlug || branchInfo.intentSlug;
    const unitSlug = pathInfo.unitSlug || branchInfo.unitSlug;

    // If branch indicates AI-DLC but path doesn't recognize it,
    // it might still be an AI-DLC worktree
    if (branchInfo.isAiDlc && type === 'non-ai-dlc') {
      type = branchInfo.unitSlug ? 'unit' : 'intent';
    }

    // Check if orphaned (branch doesn't exist) - only for git
    let isOrphaned = false;
    if (vcs === 'git' && wt.head && branchInfo.isAiDlc && !wt.isMain) {
      isOrphaned = !branchExists(repoRoot, wt.head);
    }

    // Check if stale (unit completed but worktree exists)
    let isStale = false;
    if (type === 'unit' && intentSlug && unitSlug) {
      const units = intentUnitsMap.get(intentSlug);
      if (units) {
        const unit = units.find(
          (u) => u.slug === unitSlug || u.name === `unit-${unitSlug}`
        );
        if (unit && unit.status === 'completed') {
          isStale = true;
        }
      }
    }

    results.push({
      ...wt,
      intentSlug,
      unitSlug,
      type,
      isStale,
      isOrphaned,
    });
  }

  return results;
}
