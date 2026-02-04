/**
 * Repo Detail Page Types
 *
 * Shared interfaces for repo detail page components.
 */

export interface Worktree {
	name: string;
	path: string;
	sessionCount: number;
}

export interface Plugin {
	id: string;
	name: string;
	marketplace: string;
	scope: "USER" | "PROJECT" | "LOCAL";
	enabled: boolean;
	category: string;
}

export interface Project {
	id: string;
	projectId: string;
	name: string;
	totalSessions: number;
	lastActivity: string | null;
	worktrees: Worktree[];
	plugins: Plugin[];
}

export interface ProjectData {
	project: Project | null;
}
