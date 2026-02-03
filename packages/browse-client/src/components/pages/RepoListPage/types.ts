/**
 * Type definitions for RepoListPage
 */

export interface Repo {
	id: string;
	repoId: string;
	name: string;
	path: string;
	totalSessions: number;
	lastActivity: string | null;
}

export type SortOption = "activity" | "sessions" | "name";
