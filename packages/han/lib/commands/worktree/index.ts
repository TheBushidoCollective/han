/**
 * han worktree - Git worktree management for parallel development
 *
 * Commands:
 *   han worktree add <path> <branch>   Add a new worktree at path for branch
 *   han worktree remove <path>         Remove a worktree
 *   han worktree list                  List all worktrees
 *
 * This enables parallel subagent isolation by creating separate working directories
 * for different branches without needing to switch branches in the main worktree.
 */
import type { Command } from "commander";
import {
	gitCreateBranch,
	gitWorktreeAdd,
	gitWorktreeList,
	gitWorktreeRemove,
} from "../../../../han-native";

/**
 * Register han worktree commands
 */
export function registerWorktreeCommands(program: Command): void {
	const worktreeCommand = program
		.command("worktree")
		.description("Git worktree management for parallel development");

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

	// han worktree list
	worktreeCommand
		.command("list")
		.description("List all worktrees")
		.option("--json", "Output as JSON")
		.action(async (options) => {
			const cwd = process.cwd();

			try {
				const worktrees = gitWorktreeList(cwd);

				if (options.json) {
					console.log(JSON.stringify(worktrees, null, 2));
				} else {
					if (worktrees.length === 0) {
						console.log("No worktrees found");
						return;
					}

					for (const wt of worktrees) {
						const lockStatus = wt.isLocked ? " [locked]" : "";
						const mainStatus = wt.isMain ? " (main)" : "";
						console.log(
							`${wt.path} ${wt.head || "(detached)"}${mainStatus}${lockStatus}`,
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
