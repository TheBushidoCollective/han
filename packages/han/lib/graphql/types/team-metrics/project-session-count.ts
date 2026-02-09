/**
 * ProjectSessionCount Type
 *
 * Session and task metrics aggregated by project.
 */

import { builder } from '../../builder.ts';

export interface ProjectSessionCount {
  projectId: string;
  projectName: string;
  sessionCount: number;
  taskCount: number;
  successRate: number;
}

const ProjectSessionCountRef = builder.objectRef<ProjectSessionCount>(
  'ProjectSessionCount'
);

export const ProjectSessionCountType = ProjectSessionCountRef.implement({
  description: 'Session and task metrics aggregated by project',
  fields: (t) => ({
    projectId: t.exposeString('projectId', {
      description: 'Unique project identifier',
    }),
    projectName: t.exposeString('projectName', {
      description: 'Human-readable project name',
    }),
    sessionCount: t.exposeInt('sessionCount', {
      description: 'Number of sessions in this project',
    }),
    taskCount: t.exposeInt('taskCount', {
      description: 'Number of tasks in this project',
    }),
    successRate: t.exposeFloat('successRate', {
      description: 'Task success rate (0-1)',
    }),
  }),
});
