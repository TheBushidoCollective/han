/**
 * Projects Page Utilities
 *
 * Helper functions for project display.
 */

import type { Project } from "./types.ts";

/**
 * Count total worktrees (excluding main repo)
 */
export function countWorktrees(project: Project): number {
	return project.worktrees.filter((wt) => wt.isWorktree).length;
}

/**
 * Count total subdirectories across all worktrees
 */
export function countSubdirs(project: Project): number {
	return project.worktrees.reduce(
		(sum, wt) => sum + (wt.subdirs?.length || 0),
		0,
	);
}
