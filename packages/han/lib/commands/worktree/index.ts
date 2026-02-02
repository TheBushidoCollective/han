/**
 * han worktree - Git worktree management for parallel development
 *
 * Commands:
 *   han worktree add <path> <branch>   Add a new worktree at path for branch
 *   han worktree remove <path>         Remove a worktree
 *   han worktree list                  List all worktrees with AI-DLC status
 *   han worktree prune                 Remove orphaned AI-DLC worktrees
 *   han worktree discover              Discover existing AI-DLC worktrees for an intent
 *
 * This enables parallel subagent isolation by creating separate working directories
 * for different branches without needing to switch branches in the main worktree.
 */
import type { Command } from "commander";
import {
	gitCreateBranch,
	gitWorktreeAdd,
	gitWorktreeRemove,
} from "../../native.ts";
import { registerListCommand } from "./list.ts";
import { registerPruneCommand } from "./prune.ts";
import {
	discoverForConstruct,
	findWorktreesForIntent,
	findIntents,
} from "./discovery.ts";

/**
 * Register han worktree commands
 */
export function registerWorktreeCommands(program: Command): void {
	const worktreeCommand = program
		.command("worktree")
		.description("Git worktree management for parallel development and AI-DLC");

	// han worktree add <path> <branch>
	worktreeCommand
		.command("add <path> <branch>")
		.description("Add a new worktree at path for branch")
		.option("--create-branch", "Create the branch if it doesn't exist")
		.action(async (path: string, branch: string, options) => {
			const cwd = process.cwd();

			try {
				if (options.createBranch) {
					try {
						gitCreateBranch(cwd, branch);
						console.log(`Created branch: ${branch}`);
					} catch {
						// Branch may already exist, that's ok
					}
				}

				gitWorktreeAdd(cwd, path, branch);
				console.log(`Added worktree at ${path} for branch ${branch}`);
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : error}`,
				);
				process.exit(1);
			}
		});

	// han worktree remove <path>
	worktreeCommand
		.command("remove <path>")
		.description("Remove a worktree")
		.option("-f, --force", "Force removal even if worktree is dirty")
		.action(async (path: string, options) => {
			const cwd = process.cwd();

			try {
				gitWorktreeRemove(cwd, path, options.force);
				console.log(`Removed worktree at ${path}`);
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : error}`,
				);
				process.exit(1);
			}
		});

	// Register enhanced list command with AI-DLC support
	registerListCommand(worktreeCommand);

	// Register prune command for cleanup
	registerPruneCommand(worktreeCommand);

	// han worktree discover [intent-slug]
	worktreeCommand
		.command("discover [intent-slug]")
		.description("Discover existing AI-DLC worktrees for resume/construct")
		.option("--json", "Output as JSON")
		.action((intentSlug: string | undefined, options) => {
			const cwd = process.cwd();

			try {
				if (intentSlug) {
					// Find worktrees for specific intent
					const worktrees = findWorktreesForIntent(cwd, intentSlug);

					if (options.json) {
						console.log(
							JSON.stringify({ intentSlug, worktrees }, null, 2),
						);
						return;
					}

					if (worktrees.length === 0) {
						console.log(`No worktrees found for intent: ${intentSlug}`);
						return;
					}

					console.log(`\nWorktrees for intent '${intentSlug}':\n`);
					for (const wt of worktrees) {
						const status: string[] = [];
						if (wt.isStale) status.push("stale");
						if (wt.isOrphaned) status.push("orphaned");
						const statusStr =
							status.length > 0 ? ` [${status.join(", ")}]` : "";

						console.log(`  ${wt.path}${statusStr}`);
						console.log(`    Branch: ${wt.head || "(detached)"}`);
						console.log(`    Type: ${wt.type}`);
						if (wt.unitSlug) console.log(`    Unit: ${wt.unitSlug}`);
						console.log("");
					}
				} else {
					// General discovery for /construct command
					const result = discoverForConstruct(cwd);

					if (options.json) {
						console.log(JSON.stringify(result, null, 2));
						return;
					}

					if (!result.hasExisting) {
						console.log("No existing AI-DLC worktrees found");

						// Check for intents that could be resumed
						const intents = findIntents(cwd);
						const activeIntents = intents.filter(
							(i) => i.status === "active",
						);

						if (activeIntents.length > 0) {
							console.log("\nResumable intents (no active worktrees):\n");
							for (const intent of activeIntents) {
								console.log(`  ${intent.slug}`);
								if (intent.title) console.log(`    Title: ${intent.title}`);
								console.log(`    Workflow: ${intent.workflow}`);
								console.log("");
							}
							console.log(
								"Run `/resume <intent-slug>` to continue work on an intent.",
							);
						}
						return;
					}

					console.log("\n## Existing AI-DLC Worktrees\n");

					if (result.activeIntents.length > 0) {
						console.log("Active intents with worktrees:");
						for (const slug of result.activeIntents) {
							console.log(`  - ${slug}`);
						}
						console.log("");
					}

					// Group by intent
					const byIntent = new Map<string, typeof result.worktrees>();
					for (const wt of result.worktrees) {
						if (!wt.intentSlug) continue;
						const existing = byIntent.get(wt.intentSlug) || [];
						existing.push(wt);
						byIntent.set(wt.intentSlug, existing);
					}

					for (const [slug, worktrees] of byIntent) {
						console.log(`### Intent: ${slug}\n`);
						for (const wt of worktrees) {
							const status: string[] = [];
							if (wt.isStale) status.push("stale");
							if (wt.isOrphaned) status.push("orphaned");
							const statusStr =
								status.length > 0 ? ` [${status.join(", ")}]` : "";

							console.log(`  ${wt.path}${statusStr}`);
							if (wt.unitSlug) console.log(`    Unit: ${wt.unitSlug}`);
						}
						console.log("");
					}

					// Show options
					console.log("## Options\n");
					console.log(
						"1. **Resume**: Run `/resume <intent-slug>` to continue existing work",
					);
					console.log(
						"2. **Fresh Start**: Run `/elaborate` to start a new intent",
					);
					console.log(
						"3. **List Details**: Run `han worktree list --ai-dlc` for full status",
					);

					const orphanedCount = result.worktrees.filter(
						(wt) => wt.isOrphaned || wt.isStale,
					).length;
					if (orphanedCount > 0) {
						console.log(
							`\nNote: ${orphanedCount} worktree(s) are orphaned/stale. Run \`han worktree prune\` to clean up.`,
						);
					}
				}
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : error}`,
				);
				process.exit(1);
			}
		});
}
