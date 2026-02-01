/**
 * AI-DLC Integrator Logic
 *
 * Handles strategy-aware intent completion:
 * - trunk: Validates auto-merged state on main
 * - intent: Creates single PR and merges on approval
 * - unit/bolt: Verifies all individual PRs were merged (no-op)
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	type ChangeStrategy,
	type VcsConfig,
	findRepoRoot,
	getMergedSettings,
} from "./config.ts";
import {
	autoMerge,
	createPR,
	getCurrentBranch,
	parseBranchName,
} from "./strategies.ts";

/**
 * Integrator result status
 */
export type IntegratorStatus =
	| "completed"
	| "pr_created"
	| "blocked"
	| "skipped";

/**
 * Result from integration operation
 */
export interface IntegrationResult {
	/** Status of the integration */
	status: IntegratorStatus;
	/** Strategy used */
	strategy: ChangeStrategy;
	/** Message describing the result */
	message: string;
	/** PR URL if created */
	prUrl?: string;
	/** Validation errors if blocked */
	errors?: string[];
	/** Cleanup summary */
	cleanup?: {
		branchesDeleted: string[];
		worktreesRemoved: string[];
	};
}

/**
 * Integration context
 */
export interface IntegrationContext {
	/** Intent slug */
	intentSlug: string;
	/** Intent directory path */
	intentDir: string;
	/** Repository root */
	repoRoot: string;
	/** VCS configuration */
	config: VcsConfig;
	/** List of completed units */
	completedUnits: string[];
}

/**
 * Check if all units in the intent are complete
 * @param intentDir - Path to intent directory (.ai-dlc/{intent-slug})
 * @returns true if all units are completed
 */
export function isDagComplete(intentDir: string): boolean {
	try {
		const result = execSync(
			`source "${process.env.CLAUDE_PLUGIN_ROOT}/lib/dag.sh" && is_dag_complete "${intentDir}" && echo "true" || echo "false"`,
			{ shell: "/bin/bash", stdio: "pipe" },
		);
		return result.toString().trim() === "true";
	} catch {
		return false;
	}
}

/**
 * Get list of completed units
 * @param intentDir - Path to intent directory
 * @returns Array of completed unit names
 */
export function getCompletedUnits(intentDir: string): string[] {
	try {
		const result = execSync(
			`source "${process.env.CLAUDE_PLUGIN_ROOT}/lib/dag.sh" && find_completed_units "${intentDir}"`,
			{ shell: "/bin/bash", stdio: "pipe" },
		);
		return result
			.toString()
			.trim()
			.split("\n")
			.filter((u) => u.length > 0);
	} catch {
		return [];
	}
}

/**
 * Run validation hooks (tests, lint, types)
 * @param repoRoot - Repository root directory
 * @returns Object with pass status and any errors
 */
export function runValidationHooks(repoRoot: string): {
	passed: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	// Common validation commands to try
	const validations = [
		{ name: "npm test", command: "npm test --if-present" },
		{ name: "npm lint", command: "npm run lint --if-present" },
		{ name: "npm typecheck", command: "npm run typecheck --if-present" },
	];

	for (const validation of validations) {
		try {
			execSync(validation.command, {
				cwd: repoRoot,
				stdio: "pipe",
				timeout: 300000, // 5 minute timeout
			});
		} catch (error) {
			if (error instanceof Error && "stderr" in error) {
				errors.push(`${validation.name}: ${(error as Error & { stderr: Buffer }).stderr?.toString() || "failed"}`);
			} else {
				errors.push(`${validation.name}: failed`);
			}
		}
	}

	return {
		passed: errors.length === 0,
		errors,
	};
}

/**
 * Verify that branches were merged to base branch
 * @param branches - Branch names to check
 * @param baseBranch - Base branch to check against
 * @param repoRoot - Repository root
 * @returns Object with merged status and unmerged branches
 */
export function verifyBranchesMerged(
	branches: string[],
	baseBranch: string,
	repoRoot: string,
): { allMerged: boolean; unmerged: string[] } {
	const unmerged: string[] = [];

	for (const branch of branches) {
		try {
			// Check if branch is fully merged into base
			execSync(
				`git merge-base --is-ancestor "${branch}" "${baseBranch}"`,
				{ cwd: repoRoot, stdio: "pipe" },
			);
		} catch {
			// Branch not merged
			unmerged.push(branch);
		}
	}

	return {
		allMerged: unmerged.length === 0,
		unmerged,
	};
}

/**
 * Clean up worktrees for completed intent
 * @param intentSlug - Intent slug
 * @param units - List of unit slugs
 * @param repoRoot - Repository root
 * @returns Cleanup summary
 */
export function cleanupWorktrees(
	intentSlug: string,
	units: string[],
	repoRoot: string,
): { worktreesRemoved: string[]; branchesDeleted: string[] } {
	const worktreesRemoved: string[] = [];
	const branchesDeleted: string[] = [];

	// Intent worktree
	const intentWorktree = `/tmp/ai-dlc-${intentSlug}`;
	if (existsSync(intentWorktree)) {
		try {
			execSync(`git worktree remove "${intentWorktree}" --force`, {
				cwd: repoRoot,
				stdio: "pipe",
			});
			worktreesRemoved.push(intentWorktree);
		} catch {
			// May already be removed
		}
	}

	// Unit worktrees
	for (const unit of units) {
		const unitSlug = unit.replace(/^unit-/, "");
		const unitWorktree = `/tmp/ai-dlc-${intentSlug}-${unitSlug}`;
		if (existsSync(unitWorktree)) {
			try {
				execSync(`git worktree remove "${unitWorktree}" --force`, {
					cwd: repoRoot,
					stdio: "pipe",
				});
				worktreesRemoved.push(unitWorktree);
			} catch {
				// May already be removed
			}
		}

		// Delete unit branch
		const unitBranch = `ai-dlc/${intentSlug}/${unitSlug}`;
		try {
			execSync(`git branch -d "${unitBranch}"`, {
				cwd: repoRoot,
				stdio: "pipe",
			});
			branchesDeleted.push(unitBranch);
		} catch {
			// May already be deleted or not fully merged
		}
	}

	return { worktreesRemoved, branchesDeleted };
}

/**
 * Mark intent as complete in intent.md frontmatter
 * @param intentDir - Intent directory path
 */
export function markIntentComplete(intentDir: string): void {
	const intentPath = join(intentDir, "intent.md");
	if (!existsSync(intentPath)) return;

	try {
		const content = readFileSync(intentPath, "utf-8");

		// Update status in frontmatter
		let updated: string;
		if (content.includes("status:")) {
			updated = content.replace(/status:\s*\w+/, "status: completed");
		} else {
			// Add status after first ---
			updated = content.replace(/^---\n/, "---\nstatus: completed\n");
		}

		// Add completed timestamp
		const timestamp = new Date().toISOString();
		if (updated.includes("completed_at:")) {
			updated = updated.replace(
				/completed_at:\s*.*/,
				`completed_at: ${timestamp}`,
			);
		} else {
			updated = updated.replace(
				/^(---\n(?:.*\n)*?)(---)/,
				`$1completed_at: ${timestamp}\n$2`,
			);
		}

		writeFileSync(intentPath, updated);
	} catch {
		// Ignore errors updating intent file
	}
}

/**
 * Build PR description from completed units
 * @param intentDir - Intent directory path
 * @param completedUnits - List of completed unit names
 * @returns PR description markdown
 */
function buildPRDescription(
	intentDir: string,
	completedUnits: string[],
): string {
	let description = "## Summary\n\n";

	// Try to read intent description
	const intentPath = join(intentDir, "intent.md");
	if (existsSync(intentPath)) {
		try {
			const content = readFileSync(intentPath, "utf-8");
			// Extract content after frontmatter
			const match = content.match(/^---[\s\S]*?---\n([\s\S]*)/);
			if (match) {
				const intentContent = match[1].trim().split("\n").slice(0, 5).join("\n");
				description += `${intentContent}\n\n`;
			}
		} catch {
			// Ignore
		}
	}

	description += "## Units Completed\n\n";
	for (const unit of completedUnits) {
		description += `- [x] ${unit}\n`;
	}

	description += "\n---\n\nGenerated by AI-DLC Integrator\n";

	return description;
}

/**
 * Execute trunk strategy integration
 */
async function integrateTrunk(
	context: IntegrationContext,
): Promise<IntegrationResult> {
	const { intentSlug, intentDir, repoRoot, config, completedUnits } = context;

	// Build list of unit branches that should have been merged
	const unitBranches = completedUnits.map((unit) => {
		const unitSlug = unit.replace(/^unit-/, "");
		return `ai-dlc/${intentSlug}/${unitSlug}`;
	});

	// Verify all branches were merged to main
	const mergeCheck = verifyBranchesMerged(
		unitBranches,
		config.default_branch,
		repoRoot,
	);

	if (!mergeCheck.allMerged) {
		return {
			status: "blocked",
			strategy: "trunk",
			message: "Some unit branches were not merged to main",
			errors: mergeCheck.unmerged.map((b) => `Branch not merged: ${b}`),
		};
	}

	// Run validation on main
	const validation = runValidationHooks(repoRoot);
	if (!validation.passed) {
		return {
			status: "blocked",
			strategy: "trunk",
			message: "Validation failed on integrated main branch",
			errors: validation.errors,
		};
	}

	// Clean up
	const cleanup = cleanupWorktrees(intentSlug, completedUnits, repoRoot);

	// Mark complete
	markIntentComplete(intentDir);

	return {
		status: "completed",
		strategy: "trunk",
		message: `Intent '${intentSlug}' completed. All ${completedUnits.length} units merged and validated.`,
		cleanup,
	};
}

/**
 * Execute intent strategy integration
 */
async function integrateIntent(
	context: IntegrationContext,
): Promise<IntegrationResult> {
	const { intentSlug, intentDir, repoRoot, config, completedUnits } = context;

	const intentBranch = `ai-dlc/${intentSlug}`;

	// Ensure we're on the intent branch
	try {
		execSync(`git checkout "${intentBranch}"`, {
			cwd: repoRoot,
			stdio: "pipe",
		});
	} catch (error) {
		return {
			status: "blocked",
			strategy: "intent",
			message: `Failed to checkout intent branch: ${intentBranch}`,
			errors: [`Could not checkout branch: ${(error as Error).message}`],
		};
	}

	// Push the intent branch
	try {
		execSync(`git push -u origin "${intentBranch}"`, {
			cwd: repoRoot,
			stdio: "pipe",
		});
	} catch (error) {
		return {
			status: "blocked",
			strategy: "intent",
			message: "Failed to push intent branch",
			errors: [`Push failed: ${(error as Error).message}`],
		};
	}

	// Create the PR
	const prBody = buildPRDescription(intentDir, completedUnits);
	const prUrl = createPR({
		title: `[AI-DLC] ${intentSlug}`,
		body: prBody,
		baseBranch: config.default_branch,
		repoRoot,
	});

	if (!prUrl) {
		return {
			status: "blocked",
			strategy: "intent",
			message: "Failed to create PR for intent",
			errors: ["PR creation failed - check gh CLI authentication"],
		};
	}

	return {
		status: "pr_created",
		strategy: "intent",
		message: `PR created for intent '${intentSlug}'. Awaiting approval.`,
		prUrl,
	};
}

/**
 * Execute unit/bolt strategy integration (no-op)
 */
async function integrateUnitOrBolt(
	context: IntegrationContext,
): Promise<IntegrationResult> {
	const { intentSlug, intentDir, repoRoot, config, completedUnits } = context;

	// For unit/bolt strategies, each unit already had its own PR
	// We just verify everything is merged and clean up

	// Build list of unit branches
	const unitBranches = completedUnits.map((unit) => {
		const unitSlug = unit.replace(/^unit-/, "");
		return `ai-dlc/${intentSlug}/${unitSlug}`;
	});

	// Check if branches are merged (they should be after individual PR merges)
	const mergeCheck = verifyBranchesMerged(
		unitBranches,
		config.default_branch,
		repoRoot,
	);

	if (!mergeCheck.allMerged) {
		return {
			status: "blocked",
			strategy: config.change_strategy,
			message: "Some unit PRs may not have been merged",
			errors: mergeCheck.unmerged.map((b) => `Branch not merged: ${b}`),
		};
	}

	// Clean up
	const cleanup = cleanupWorktrees(intentSlug, completedUnits, repoRoot);

	// Mark complete
	markIntentComplete(intentDir);

	return {
		status: "completed",
		strategy: config.change_strategy,
		message: `Intent '${intentSlug}' completed. All ${completedUnits.length} unit PRs were merged.`,
		cleanup,
	};
}

/**
 * Execute integration for an intent based on configured strategy
 * @param intentSlug - Intent slug
 * @param intentDir - Intent directory path
 * @param options - Additional options
 * @returns Integration result
 */
export async function integrate(
	intentSlug: string,
	intentDir: string,
	options?: {
		repoRoot?: string;
	},
): Promise<IntegrationResult> {
	const repoRoot = options?.repoRoot || findRepoRoot() || process.cwd();

	// Verify DAG is complete
	if (!isDagComplete(intentDir)) {
		return {
			status: "blocked",
			strategy: "unit", // Default, will be updated
			message: "Cannot integrate: not all units are complete",
			errors: ["DAG is not complete - some units still pending or blocked"],
		};
	}

	// Get configuration
	const config = getMergedSettings({
		intentDir,
		repoRoot,
	});

	// Get completed units
	const completedUnits = getCompletedUnits(intentDir);

	const context: IntegrationContext = {
		intentSlug,
		intentDir,
		repoRoot,
		config,
		completedUnits,
	};

	// Execute strategy-specific integration
	switch (config.change_strategy) {
		case "trunk":
			return integrateTrunk(context);

		case "intent":
			return integrateIntent(context);

		case "unit":
		case "bolt":
			return integrateUnitOrBolt(context);

		default:
			return {
				status: "blocked",
				strategy: config.change_strategy,
				message: `Unknown change strategy: ${config.change_strategy}`,
				errors: [`Invalid strategy: ${config.change_strategy}`],
			};
	}
}

/**
 * Complete integration after PR approval (for intent strategy)
 * @param intentSlug - Intent slug
 * @param intentDir - Intent directory path
 * @param options - Additional options
 * @returns Integration result
 */
export async function completeAfterApproval(
	intentSlug: string,
	intentDir: string,
	options?: {
		repoRoot?: string;
		prNumber?: number;
	},
): Promise<IntegrationResult> {
	const repoRoot = options?.repoRoot || findRepoRoot() || process.cwd();
	const config = getMergedSettings({ intentDir, repoRoot });
	const completedUnits = getCompletedUnits(intentDir);

	if (config.change_strategy !== "intent") {
		return {
			status: "skipped",
			strategy: config.change_strategy,
			message: "completeAfterApproval only applies to intent strategy",
		};
	}

	// Merge the PR using gh CLI
	if (options?.prNumber) {
		try {
			execSync(`gh pr merge ${options.prNumber} --merge`, {
				cwd: repoRoot,
				stdio: "pipe",
			});
		} catch (error) {
			return {
				status: "blocked",
				strategy: "intent",
				message: "Failed to merge PR",
				errors: [`Merge failed: ${(error as Error).message}`],
			};
		}
	}

	// Run final validation
	const validation = runValidationHooks(repoRoot);
	if (!validation.passed) {
		return {
			status: "blocked",
			strategy: "intent",
			message: "Post-merge validation failed",
			errors: validation.errors,
		};
	}

	// Clean up
	const cleanup = cleanupWorktrees(intentSlug, completedUnits, repoRoot);

	// Mark complete
	markIntentComplete(intentDir);

	return {
		status: "completed",
		strategy: "intent",
		message: `Intent '${intentSlug}' completed and merged.`,
		cleanup,
	};
}

/**
 * Check if integrator should run (skip for unit/bolt strategies)
 * @param strategy - Change strategy
 * @returns Object indicating if integrator should run and why
 */
export function shouldRunIntegrator(strategy: ChangeStrategy): {
	shouldRun: boolean;
	reason: string;
} {
	switch (strategy) {
		case "trunk":
			return {
				shouldRun: true,
				reason: "Trunk strategy needs validation of auto-merged state",
			};
		case "intent":
			return {
				shouldRun: true,
				reason: "Intent strategy needs single PR creation",
			};
		case "unit":
		case "bolt":
			return {
				shouldRun: true,
				reason: "Verifying all unit PRs were merged (lightweight check)",
			};
		default:
			return {
				shouldRun: false,
				reason: `Unknown strategy: ${strategy}`,
			};
	}
}
