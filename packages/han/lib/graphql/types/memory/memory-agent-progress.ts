/**
 * GraphQL MemoryAgentProgress type
 *
 * Progress update from Memory Agent during search.
 */

import { builder } from '../../builder.ts';
import { MemoryAgentProgressTypeEnum } from './memory-agent-progress-type-enum.ts';

/**
 * Memory Agent progress interface
 */
export interface MemoryAgentProgress {
  sessionId: string;
  type: 'searching' | 'found' | 'synthesizing' | 'complete' | 'error';
  layer?: string;
  content: string;
  resultCount?: number;
  timestamp: number;
}

const MemoryAgentProgressRef = builder.objectRef<MemoryAgentProgress>(
  'MemoryAgentProgress'
);

export const MemoryAgentProgressType = MemoryAgentProgressRef.implement({
  description: 'Progress update from Memory Agent during search',
  fields: (t) => ({
    sessionId: t.exposeString('sessionId', {
      description: 'Unique ID for this memory query session',
    }),
    type: t.field({
      type: MemoryAgentProgressTypeEnum,
      description: 'Type of progress update',
      resolve: (p) =>
        p.type.toUpperCase() as
          | 'SEARCHING'
          | 'FOUND'
          | 'SYNTHESIZING'
          | 'COMPLETE'
          | 'ERROR',
    }),
    layer: t.string({
      nullable: true,
      description: 'Memory layer being searched',
      resolve: (p) => p.layer ?? null,
    }),
    content: t.exposeString('content', {
      description: 'Progress message or content',
    }),
    resultCount: t.int({
      nullable: true,
      description: 'Number of results found (if applicable)',
      resolve: (p) => p.resultCount ?? null,
    }),
    timestamp: t.field({
      type: 'DateTime',
      description: 'When this progress update occurred',
      resolve: (p) => p.timestamp,
    }),
  }),
});
