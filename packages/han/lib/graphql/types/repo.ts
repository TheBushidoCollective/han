/**
 * GraphQL Repo type
 *
 * Represents a git repository containing projects and sessions.
 * Implements the Node interface for Relay global ID support.
 *
 * In the current model, Repo and Project map 1:1 since ProjectGroup
 * is already organized by git root. This type provides the proper
 * hierarchy: Repo > Project > Session.
 */

import type { ProjectGroup } from "../../api/sessions.ts";
import { getGitRemoteUrl } from "../../native.ts";
import { builder } from "../builder.ts";
import { registerNodeLoader } from "../node-registry.ts";
import { getAllProjects, ProjectType } from "./project.ts";
// Import session connection type - safe because session-connection.ts doesn't import from here
import { SessionConnectionType } from "./session-connection.ts";

/**
 * Repo type ref - uses ProjectGroup as underlying data
 * since repos and projects currently map 1:1
 */
const RepoRef = builder.objectRef<ProjectGroup>("Repo");

/**
 * Repo type implementation with global ID
 * Implements Node interface for Relay global object identification
 */
export const RepoType = RepoRef.implement({
	description: "A git repository containing projects and sessions",
	interfaces: [builder.nodeInterfaceRef()],
	isTypeOf: (obj): obj is ProjectGroup => {
		// Check if this is a ProjectGroup object (used by both Repo and Project)
		// Return true for any valid ProjectGroup when accessed as a Repo
		return (
			obj !== null &&
			typeof obj === "object" &&
			"repoId" in obj &&
			typeof (obj as ProjectGroup).repoId === "string"
		);
	},
	fields: (t) => ({
		id: t.globalID({
			nullable: false,
			// Use repoId (git remote-based) for Repo global ID
			resolve: (repo) => ({ id: repo.repoId, type: "Repo" as const }),
		}),
		repoId: t.exposeString("repoId", {
			description:
				"Git remote-based repository identifier (e.g., github-com-org-repo)",
		}),
		name: t.exposeString("displayName", {
			description: "Display name for the repository",
		}),
		path: t.string({
			description: "Path to the repository root",
			resolve: (repo) => {
				// Get path from the main worktree
				const mainWorktree = repo.worktrees.find((w) => !w.isWorktree);
				return mainWorktree?.path || repo.worktrees[0]?.path || "";
			},
		}),
		totalSessions: t.exposeInt("totalSessions", {
			description: "Total sessions across all projects in this repo",
		}),
		lastActivity: t.field({
			type: "DateTime",
			nullable: true,
			description: "Most recent session timestamp",
			resolve: (repo) => repo.lastActivity ?? null,
		}),
		projects: t.field({
			type: [ProjectType],
			description: "All projects (worktrees) belonging to this repository",
			resolve: async (repo, _args, context) => {
				// Get the git root path from the repo's main worktree
				const mainWorktree = repo.worktrees.find((w) => !w.isWorktree);
				const repoPath = mainWorktree?.path || repo.worktrees[0]?.path;

				if (!repoPath) {
					return [];
				}

				// Get git remote for this path to look up database repo
				const remote = getGitRemoteUrl(repoPath);

				if (!remote) {
					return [];
				}

				// Look up database repo by remote URL using dataSource
				const dbRepo = await context.dataSource.repos.getByRemote(remote);

				if (!dbRepo || !dbRepo.id) {
					return [];
				}

				// Get all projects for this database repo UUID using dataSource
				const projectList = await context.dataSource.projects.list(dbRepo.id);

				// Convert database Project objects to ProjectGroup format
				return projectList.map(
					(p): ProjectGroup => ({
						projectId: p.slug,
						repoId: dbRepo.id || "",
						displayName: p.name,
						worktrees: [
							{
								name: p.name,
								path: p.path,
								sessionCount: 0,
								isWorktree: p.isWorktree,
								subdirs: undefined,
							},
						],
						totalSessions: 0,
						lastActivity: undefined,
					}),
				);
			},
		}),
		sessions: t.field({
			type: SessionConnectionType,
			args: {
				first: t.arg.int({
					description: "Number of sessions to fetch from the start",
				}),
				after: t.arg.string({
					description: "Cursor to fetch sessions after",
				}),
				last: t.arg.int({
					description: "Number of sessions to fetch from the end",
				}),
				before: t.arg.string({
					description: "Cursor to fetch sessions before",
				}),
			},
			description: "All sessions in this repository",
			resolve: async (repo, args) => {
				// Dynamic import to avoid circular dependency
				const { getSessionsConnection } = await import("./session.ts");
				// Use repoId (git remote-based) to filter sessions by repo
				return getSessionsConnection({
					first: args.first,
					after: args.after,
					last: args.last,
					before: args.before,
					projectId: repo.repoId,
				});
			},
		}),
	}),
});

/**
 * Get all repos (currently maps 1:1 with projects)
 */
export function getAllRepos(): ProjectGroup[] {
	return getAllProjects();
}

/**
 * Get a repo by its ID
 * Supports both repoId (git remote-based) and projectId (folder-based)
 */
export function getRepoById(id: string): ProjectGroup | null {
	const projects = getAllProjects();

	// First try matching by repoId (git remote-based ID)
	const repoMatch = projects.find((p) => p.repoId === id);
	if (repoMatch) {
		return repoMatch;
	}

	// Also try matching by projectId (folder-based ID)
	// This handles navigation from /projects/:projectId/memory
	const projectMatch = projects.find((p) => p.projectId === id);
	if (projectMatch) {
		return projectMatch;
	}

	return null;
}

// Register node loader for Repo type
registerNodeLoader("Repo", getRepoById);
