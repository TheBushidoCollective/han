/**
 * AI-DLC Change Strategies
 *
 * Implements the four change strategies for version control:
 * - trunk: Creates ephemeral branch per unit, auto-merges after validation
 * - bolt: Creates branch per bolt, MR per bolt
 * - unit: Creates branch per unit, MR per unit (default)
 * - intent: Single branch for entire intent, one MR at completion
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
	type ChangeStrategy,
	type VcsConfig,
	detectVcs,
	findRepoRoot,
	getMergedSettings,
} from "./config.ts";

/**
 * Strategy behavior configuration
 */
export interface StrategyBehavior {
	/** Branch naming pattern to use */
	getBranchName: (context: BranchContext) => string;
	/** Whether to create a PR at this point */
	shouldCreatePR: (context: PRContext) => boolean;
	/** Whether to auto-merge after validation passes */
	shouldAutoMerge: (context: MergeContext) => boolean;
	/** Description of the strategy */
	description: string;
}

/**
 * Context for branch name generation
 */
export interface BranchContext {
	/** Intent slug (e.g., 'vcs-strategy-config') */
	intent: string;
	/** Unit slug (e.g., '03-change-strategies') */
	unit: string;
	/** Bolt name (optional, only for bolt strategy) */
	bolt?: string;
}

/**
 * Context for PR creation decision
 */
export interface PRContext {
	/** The change strategy in use */
	strategy: ChangeStrategy;
	/** Whether the current unit is complete */
	unitComplete: boolean;
	/** Whether the current bolt is complete (for bolt strategy) */
	boltComplete?: boolean;
	/** Whether the entire intent is complete */
	intentComplete: boolean;
}

/**
 * Context for auto-merge decision
 */
export interface MergeContext {
	/** The change strategy in use */
	strategy: ChangeStrategy;
	/** Whether validation passed */
	validationPassed: boolean;
	/** Whether the current unit is complete */
	unitComplete: boolean;
	/** VCS configuration (may have auto_merge override) */
	config?: VcsConfig;
}

/**
 * Strategy implementations
 */
export const strategies: Record<ChangeStrategy, StrategyBehavior> = {
	/**
	 * Trunk strategy: Ephemeral branches, auto-merge after each unit
	 * - Branch per unit
	 * - No PRs (direct merge to trunk)
	 * - Auto-merge when unit validation passes
	 */
	trunk: {
		getBranchName: ({ intent, unit }: BranchContext): string => {
			return `ai-dlc/${intent}/${unit}`;
		},
		shouldCreatePR: (_context: PRContext): boolean => {
			// Trunk strategy never creates PRs - it auto-merges directly
			return false;
		},
		shouldAutoMerge: ({ validationPassed, unitComplete }: MergeContext): boolean => {
			// Auto-merge when validation passes and unit is complete
			return validationPassed && unitComplete;
		},
		description:
			"Ephemeral branches with auto-merge to trunk after each unit passes validation",
	},

	/**
	 * Bolt strategy: Granular PRs per bolt
	 * - Branch per bolt (finest granularity)
	 * - PR per bolt
	 * - No auto-merge
	 */
	bolt: {
		getBranchName: ({ intent, unit, bolt }: BranchContext): string => {
			if (bolt) {
				return `ai-dlc/${intent}/${unit}/${bolt}`;
			}
			// Fallback if bolt not provided (shouldn't happen in bolt strategy)
			return `ai-dlc/${intent}/${unit}`;
		},
		shouldCreatePR: ({ boltComplete }: PRContext): boolean => {
			// Create PR when bolt is complete
			return boltComplete ?? false;
		},
		shouldAutoMerge: (_context: MergeContext): boolean => {
			// Bolt strategy requires manual merge review
			return false;
		},
		description: "Fine-grained PRs per bolt, requiring manual review for each",
	},

	/**
	 * Unit strategy (default): Branch and PR per unit
	 * - Branch per unit
	 * - PR per unit
	 * - No auto-merge
	 */
	unit: {
		getBranchName: ({ intent, unit }: BranchContext): string => {
			return `ai-dlc/${intent}/${unit}`;
		},
		shouldCreatePR: ({ unitComplete }: PRContext): boolean => {
			// Create PR when unit is complete
			return unitComplete;
		},
		shouldAutoMerge: (_context: MergeContext): boolean => {
			// Unit strategy requires manual merge review
			return false;
		},
		description: "Standard PRs per unit, balanced granularity for code review",
	},

	/**
	 * Intent strategy: Single branch for entire intent
	 * - One branch for the whole intent
	 * - Single PR when intent is complete
	 * - No auto-merge
	 */
	intent: {
		getBranchName: ({ intent }: BranchContext): string => {
			return `ai-dlc/${intent}`;
		},
		shouldCreatePR: ({ intentComplete }: PRContext): boolean => {
			// Only create PR when entire intent is complete
			return intentComplete;
		},
		shouldAutoMerge: (_context: MergeContext): boolean => {
			// Intent strategy requires manual merge review
			return false;
		},
		description: "Single PR for entire intent, best for cohesive feature work",
	},
};

/**
 * Get the branch name for a given context
 * @param strategy - The change strategy to use
 * @param context - Branch context with intent, unit, and optional bolt
 * @returns The branch name to use
 */
export function getBranchName(
	strategy: ChangeStrategy,
	context: BranchContext,
): string {
	return strategies[strategy].getBranchName(context);
}

/**
 * Determine if a PR should be created at this point
 * @param context - PR decision context
 * @returns true if a PR should be created
 */
export function shouldCreatePR(context: PRContext): boolean {
	return strategies[context.strategy].shouldCreatePR(context);
}

/**
 * Determine if auto-merge should happen
 * @param context - Merge decision context
 * @returns true if auto-merge should occur
 */
export function shouldAutoMerge(context: MergeContext): boolean {
	// Check for explicit override in config
	if (context.config?.auto_merge !== undefined) {
		return context.config.auto_merge && context.validationPassed;
	}
	return strategies[context.strategy].shouldAutoMerge(context);
}

/**
 * Get the strategy behavior for a given strategy
 * @param strategy - The change strategy
 * @returns The strategy behavior object
 */
export function getStrategy(strategy: ChangeStrategy): StrategyBehavior {
	return strategies[strategy];
}

/**
 * Create a branch for the current context
 * Uses the configured VCS (git or jj)
 *
 * @param strategy - The change strategy
 * @param context - Branch context
 * @param options - Additional options
 * @returns The created branch name
 */
export function createBranch(
	strategy: ChangeStrategy,
	context: BranchContext,
	options?: {
		repoRoot?: string;
		baseBranch?: string;
	},
): string {
	const branchName = getBranchName(strategy, context);
	const repoRoot = options?.repoRoot || findRepoRoot() || process.cwd();
	const vcs = detectVcs(repoRoot);
	const config = getMergedSettings({ repoRoot });
	const baseBranch = options?.baseBranch || config.default_branch;

	if (vcs === "jj") {
		// jj uses bookmarks instead of branches
		try {
			execSync(`jj bookmark create "${branchName}" --at @-`, {
				cwd: repoRoot,
				stdio: "pipe",
			});
		} catch {
			// Bookmark might already exist
		}
	} else {
		// git branch creation
		try {
			// Check if branch exists
			execSync(`git rev-parse --verify "${branchName}"`, {
				cwd: repoRoot,
				stdio: "pipe",
			});
			// Branch exists, just check it out
			execSync(`git checkout "${branchName}"`, {
				cwd: repoRoot,
				stdio: "pipe",
			});
		} catch {
			// Branch doesn't exist, create from base
			execSync(`git checkout -b "${branchName}" "${baseBranch}"`, {
				cwd: repoRoot,
				stdio: "pipe",
			});
		}
	}

	return branchName;
}

/**
 * Create a PR/MR for the current branch
 * Uses gh CLI for GitHub
 *
 * @param options - PR creation options
 * @returns PR URL or null if creation failed
 */
export function createPR(options: {
	title: string;
	body: string;
	baseBranch?: string;
	repoRoot?: string;
	draft?: boolean;
}): string | null {
	const repoRoot = options.repoRoot || findRepoRoot() || process.cwd();
	const config = getMergedSettings({ repoRoot });
	const baseBranch = options.baseBranch || config.default_branch;

	try {
		// Push current branch first
		execSync("git push -u origin HEAD", {
			cwd: repoRoot,
			stdio: "pipe",
		});

		// Create PR using gh CLI
		const draftFlag = options.draft ? "--draft" : "";
		const result = execSync(
			`gh pr create --title "${options.title.replace(/"/g, '\\"')}" --body "$(cat <<'EOF'
${options.body}
EOF
)" --base "${baseBranch}" ${draftFlag}`,
			{
				cwd: repoRoot,
				stdio: "pipe",
			},
		);

		return result.toString().trim();
	} catch (error) {
		console.error("Failed to create PR:", error);
		return null;
	}
}

/**
 * Auto-merge the current branch into the base branch
 * Only used for trunk strategy
 *
 * @param options - Merge options
 * @returns true if merge succeeded
 */
export function autoMerge(options?: {
	squash?: boolean;
	repoRoot?: string;
	baseBranch?: string;
}): boolean {
	const repoRoot = options?.repoRoot || findRepoRoot() || process.cwd();
	const config = getMergedSettings({ repoRoot });
	const baseBranch = options?.baseBranch || config.default_branch;
	const squash = options?.squash ?? config.auto_squash ?? false;

	try {
		// Get current branch name
		const currentBranch = execSync("git branch --show-current", {
			cwd: repoRoot,
			stdio: "pipe",
		})
			.toString()
			.trim();

		// Checkout base branch
		execSync(`git checkout "${baseBranch}"`, {
			cwd: repoRoot,
			stdio: "pipe",
		});

		// Pull latest
		execSync(`git pull origin "${baseBranch}"`, {
			cwd: repoRoot,
			stdio: "pipe",
		});

		// Merge the feature branch
		const mergeFlag = squash ? "--squash" : "--no-ff";
		execSync(`git merge ${mergeFlag} "${currentBranch}"`, {
			cwd: repoRoot,
			stdio: "pipe",
		});

		// If squashing, need to commit
		if (squash) {
			execSync(`git commit -m "Merge ${currentBranch} (squashed)"`, {
				cwd: repoRoot,
				stdio: "pipe",
			});
		}

		// Push to remote
		execSync(`git push origin "${baseBranch}"`, {
			cwd: repoRoot,
			stdio: "pipe",
		});

		// Delete the merged branch
		execSync(`git branch -d "${currentBranch}"`, {
			cwd: repoRoot,
			stdio: "pipe",
		});

		// Delete remote branch
		try {
			execSync(`git push origin --delete "${currentBranch}"`, {
				cwd: repoRoot,
				stdio: "pipe",
			});
		} catch {
			// Remote branch might not exist
		}

		return true;
	} catch (error) {
		console.error("Failed to auto-merge:", error);
		return false;
	}
}

/**
 * Parse intent and unit slugs from a branch name
 * @param branchName - The branch name to parse
 * @returns Parsed context or null if not an AI-DLC branch
 */
export function parseBranchName(
	branchName: string,
): BranchContext | null {
	// Match patterns:
	// ai-dlc/{intent}
	// ai-dlc/{intent}/{unit}
	// ai-dlc/{intent}/{unit}/{bolt}
	const match = branchName.match(
		/^ai-dlc\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?$/,
	);

	if (!match) return null;

	return {
		intent: match[1],
		unit: match[2] || "",
		bolt: match[3],
	};
}

/**
 * Get the current branch name
 * @param repoRoot - Repository root directory
 * @returns Current branch name or null
 */
export function getCurrentBranch(repoRoot?: string): string | null {
	const cwd = repoRoot || findRepoRoot() || process.cwd();
	const vcs = detectVcs(cwd);

	try {
		if (vcs === "jj") {
			// jj uses different concept, get the bookmark
			const result = execSync("jj bookmark list --tracked", {
				cwd,
				stdio: "pipe",
			});
			// Parse the output to find current bookmark
			const lines = result.toString().trim().split("\n");
			// Return first bookmark or null
			return lines[0]?.split(/\s+/)[0] || null;
		}
		return execSync("git branch --show-current", {
			cwd,
			stdio: "pipe",
		})
			.toString()
			.trim();
	} catch {
		return null;
	}
}

/**
 * Check if we're on an AI-DLC branch
 * @param repoRoot - Repository root directory
 * @returns true if on an AI-DLC branch
 */
export function isOnAiDlcBranch(repoRoot?: string): boolean {
	const branch = getCurrentBranch(repoRoot);
	return branch ? branch.startsWith("ai-dlc/") : false;
}

/**
 * Get strategy recommendation based on project characteristics
 * @param repoRoot - Repository root directory
 * @returns Recommended strategy and reasoning
 */
export function recommendStrategy(repoRoot?: string): {
	strategy: ChangeStrategy;
	reason: string;
} {
	const cwd = repoRoot || findRepoRoot() || process.cwd();

	// Check for CI configuration
	const hasCI =
		existsSync(join(cwd, ".github/workflows")) ||
		existsSync(join(cwd, ".gitlab-ci.yml")) ||
		existsSync(join(cwd, "Jenkinsfile"));

	// Check for test configuration
	const hasTests =
		existsSync(join(cwd, "jest.config.js")) ||
		existsSync(join(cwd, "vitest.config.ts")) ||
		existsSync(join(cwd, "pytest.ini")) ||
		existsSync(join(cwd, "Cargo.toml"));

	// If CI and tests exist, trunk strategy with auto-merge is viable
	if (hasCI && hasTests) {
		return {
			strategy: "trunk",
			reason:
				"CI and tests detected - trunk strategy with auto-merge recommended for fast iteration",
		};
	}

	// Default to unit strategy for balanced approach
	return {
		strategy: "unit",
		reason:
			"Unit strategy provides good balance of review granularity and merge frequency",
	};
}
