/**
 * GraphQL Project type
 *
 * Represents a project with its worktrees and sessions.
 * Implements the Node interface for Relay global ID support.
 */

import { getPluginsForProject } from '../../api/plugins.ts';
import {
  getProjectGroups,
  type ProjectGroup,
  type WorktreeInfo,
} from '../../api/sessions.ts';
import { builder } from '../builder.ts';
import { encodeGlobalId, registerNodeLoader } from '../node-registry.ts';
import { PluginType } from './plugin.ts';
// Import session connection type - safe because session-connection.ts doesn't import from here
import { SessionConnectionType } from './session-connection.ts';
import { WorktreeType } from './worktree.ts';

/**
 * Project type ref - exported so session.ts can reference it without circular import
 */
export const ProjectRef = builder.objectRef<ProjectGroup>('Project');

/**
 * Project type implementation with global ID
 */
export const ProjectType = ProjectRef.implement({
  description: 'A project with sessions',
  fields: (t) => ({
    id: t.id({
      description: 'Global ID (Project_{projectId})',
      resolve: (project) => encodeGlobalId('Project', project.projectId),
    }),
    projectId: t.exposeString('projectId', {
      description:
        'Encoded directory path from ~/.claude/projects (e.g., -Volumes-dev-src-...)',
    }),
    repoId: t.exposeString('repoId', {
      description: 'Git remote-based identifier (e.g., github-com-org-repo)',
    }),
    slug: t.exposeString('projectId', {
      description: 'URL-safe slug for routing (same as projectId)',
    }),
    name: t.exposeString('displayName', {
      description: 'Display name for the project',
    }),
    worktrees: t.field({
      type: [WorktreeType],
      description: 'All worktrees for this project',
      resolve: (project) => project.worktrees,
    }),
    totalSessions: t.exposeInt('totalSessions', {
      description: 'Total sessions across all worktrees',
    }),
    lastActivity: t.field({
      type: 'DateTime',
      nullable: true,
      description: 'Most recent session timestamp',
      resolve: (project) => project.lastActivity ?? null,
    }),
    plugins: t.field({
      type: [PluginType],
      description:
        'Plugins installed at project or local scope for this project',
      resolve: (project) => {
        // Use the first worktree's path as the project root
        const mainWorktree = project.worktrees.find(
          (w: WorktreeInfo) => !w.isWorktree
        );
        const projectPath = mainWorktree?.path || project.worktrees[0]?.path;
        if (!projectPath) return [];
        return getPluginsForProject(projectPath);
      },
    }),
    repo: t.field({
      type: ProjectRef,
      description: 'The repository containing this project',
      resolve: (project) => {
        // In the current model, Repo and Project map 1:1
        // since ProjectGroup is already organized by git root
        return project;
      },
    }),
    sessions: t.field({
      type: SessionConnectionType,
      args: {
        first: t.arg.int({
          description: 'Number of sessions to fetch from the start',
        }),
        after: t.arg.string({
          description: 'Cursor to fetch sessions after',
        }),
        last: t.arg.int({
          description: 'Number of sessions to fetch from the end',
        }),
        before: t.arg.string({
          description: 'Cursor to fetch sessions before',
        }),
      },
      description: 'Sessions in this project',
      resolve: async (project, args) => {
        // Dynamic import to avoid circular dependency
        const { getSessionsConnection } = await import('./session.ts');
        return getSessionsConnection({
          first: args.first,
          after: args.after,
          last: args.last,
          before: args.before,
          projectId: project.projectId,
        });
      },
    }),
  }),
});

/**
 * Get all projects
 */
export function getAllProjects(): ProjectGroup[] {
  return getProjectGroups();
}

/**
 * Get a single project by ID
 * Supports both canonical projectDir (git root encoded) and legacy subdirectory paths
 */
export function getProjectById(projectId: string): ProjectGroup | null {
  const projects = getProjectGroups();

  // First try direct match on projectId (canonical)
  const directMatch = projects.find((p) => p.projectId === projectId);
  if (directMatch) {
    return directMatch;
  }

  // If not found, try matching by repoId (git remote-based ID)
  // This handles cases where someone navigates using a subdirectory path
  const repoMatch = projects.find((p) => p.repoId === projectId);
  if (repoMatch) {
    return repoMatch;
  }

  // Also check if any worktree path matches when encoded
  for (const project of projects) {
    for (const worktree of project.worktrees) {
      // Encode the worktree path to compare
      const encodedWorktreePath = worktree.path
        .replace(/\//g, '-')
        .replace(/\./g, '-');
      if (encodedWorktreePath === projectId) {
        return project;
      }

      // Also check subdirectories
      if (worktree.subdirs) {
        for (const subdir of worktree.subdirs) {
          const encodedSubdirPath = subdir.path
            .replace(/\//g, '-')
            .replace(/\./g, '-');
          if (encodedSubdirPath === projectId) {
            return project;
          }
        }
      }
    }
  }

  return null;
}

// Register node loader for Project type
registerNodeLoader('Project', getProjectById);
