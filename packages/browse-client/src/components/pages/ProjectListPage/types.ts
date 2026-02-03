/**
 * Projects Page Types
 *
 * Shared interfaces for projects page components.
 */

export interface Subdir {
	relativePath: string;
	path: string;
	sessionCount: number;
}

export interface Worktree {
	name: string;
	path: string;
	sessionCount: number;
	isWorktree: boolean;
	subdirs: Subdir[] | null;
}

export interface Project {
	id: string;
	projectId: string;
	repoId: string;
	name: string;
	totalSessions: number;
	lastActivity: string | null;
	worktrees: Worktree[];
}

export interface ViewerData {
	viewer: {
		projects: Project[];
	};
}

export type SortOption = "activity" | "sessions" | "name";
