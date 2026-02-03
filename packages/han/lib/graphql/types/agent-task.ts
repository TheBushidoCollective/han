/**
 * GraphQL AgentTask type
 *
 * Represents a subagent task spawned by a Task tool call.
 * Lightweight type to avoid circular dependencies with SessionType.
 */

import type { SessionDetail } from '../../api/sessions.ts';
import { builder } from '../builder.ts';

/**
 * Agent task data - subset of SessionDetail
 */
export interface AgentTaskData {
  agentId: string;
  sessionId: string; // Parent session ID
  startedAt?: string;
  endedAt?: string;
  project: string;
  projectPath: string;
  messageCount: number;
}

export const AgentTaskType = builder
  .objectRef<AgentTaskData>('AgentTask')
  .implement({
    description: 'A subagent task spawned by a Task tool call',
    fields: (t) => ({
      agentId: t.exposeString('agentId', {
        description: 'Unique ID of the agent task',
      }),
      sessionId: t.exposeString('sessionId', {
        description: 'Parent session ID that spawned this agent',
      }),
      startedAt: t.string({
        nullable: true,
        description: 'When the agent task started',
        resolve: (task) => task.startedAt ?? null,
      }),
      endedAt: t.string({
        nullable: true,
        description: 'When the agent task ended',
        resolve: (task) => task.endedAt ?? null,
      }),
      project: t.exposeString('project', {
        description: 'Project name',
      }),
      projectPath: t.exposeString('projectPath', {
        description: 'Full path to the project',
      }),
      messageCount: t.exposeInt('messageCount', {
        description: 'Number of messages in the agent task',
      }),
    }),
  });

/**
 * Convert SessionDetail to AgentTaskData
 */
export function toAgentTaskData(
  detail: SessionDetail,
  parentSessionId: string
): AgentTaskData {
  return {
    agentId: detail.sessionId,
    sessionId: parentSessionId,
    startedAt: detail.startedAt,
    endedAt: detail.endedAt,
    project: detail.project,
    projectPath: detail.projectPath,
    messageCount: detail.messages?.length ?? 0,
  };
}
