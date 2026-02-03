/**
 * GraphQL Worktree type
 *
 * Represents a git worktree within a project.
 */

import type { WorktreeInfo } from '../../api/sessions.ts';
import { builder } from '../builder.ts';
import { SubdirType } from './subdir.ts';

/**
 * Worktree type ref
 */
const WorktreeRef = builder.objectRef<WorktreeInfo>('Worktree');

/**
 * Worktree type implementation
 */
export const WorktreeType = WorktreeRef.implement({
  description: 'A git worktree within a project',
  fields: (t) => ({
    name: t.exposeString('name', { description: 'Worktree name' }),
    path: t.exposeString('path', { description: 'Full path to worktree' }),
    sessionCount: t.exposeInt('sessionCount', {
      description: 'Number of sessions at this worktree root',
    }),
    isWorktree: t.exposeBoolean('isWorktree', {
      description: 'Whether this is a linked worktree (vs main repo)',
    }),
    subdirs: t.field({
      type: [SubdirType],
      nullable: true,
      description: 'Subdirectories with sessions within this worktree',
      resolve: (worktree) => worktree.subdirs || null,
    }),
  }),
});
