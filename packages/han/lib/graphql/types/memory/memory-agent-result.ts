/**
 * GraphQL MemoryAgentResult type
 *
 * Final result from Memory Agent query.
 */

import { builder } from '../../builder.ts';
import type { Citation } from './citation.ts';
import { CitationType } from './citation.ts';
import { ConfidenceEnum } from './confidence-enum.ts';
import { MemoryLayerEnum } from './memory-layer-enum.ts';

/**
 * Memory Agent result interface
 */
export interface MemoryAgentResult {
  sessionId: string;
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  citations: Citation[];
  searchedLayers: string[];
  success: boolean;
  error?: string;
}

const MemoryAgentResultRef =
  builder.objectRef<MemoryAgentResult>('MemoryAgentResult');

export const MemoryAgentResultType = MemoryAgentResultRef.implement({
  description: 'Final result from Memory Agent query',
  fields: (t) => ({
    sessionId: t.exposeString('sessionId', {
      description: 'Unique ID for this memory query session',
    }),
    answer: t.exposeString('answer', {
      description: 'Synthesized answer from memory',
    }),
    confidence: t.field({
      type: ConfidenceEnum,
      description: 'Confidence in the answer',
      resolve: (r) => r.confidence.toUpperCase() as 'HIGH' | 'MEDIUM' | 'LOW',
    }),
    citations: t.field({
      type: [CitationType],
      description: 'Citations supporting the answer',
      resolve: (r) => r.citations,
    }),
    searchedLayers: t.field({
      type: [MemoryLayerEnum],
      description: 'Memory layers that were searched',
      resolve: (r) =>
        r.searchedLayers.map(
          (l) =>
            l.toUpperCase() as
              | 'RULES'
              | 'SUMMARIES'
              | 'OBSERVATIONS'
              | 'TRANSCRIPTS'
              | 'TEAM'
        ),
    }),
    success: t.exposeBoolean('success', {
      description: 'Whether the query succeeded',
    }),
    error: t.string({
      nullable: true,
      description: 'Error message if query failed',
      resolve: (r) => r.error ?? null,
    }),
  }),
});
