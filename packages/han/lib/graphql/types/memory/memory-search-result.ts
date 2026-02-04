/**
 * GraphQL MemorySearchResult type
 *
 * Result from memory search.
 */

import { builder } from '../../builder.ts';
import type { Citation } from './citation.ts';
import { CitationType } from './citation.ts';
import { ConfidenceEnum } from './confidence-enum.ts';
import { MemoryLayerEnum } from './memory-layer-enum.ts';
import { MemorySourceEnum } from './memory-source-enum.ts';

/**
 * Memory search result interface
 */
export interface MemorySearchResult {
  answer: string;
  source: string;
  confidence: string;
  citations: Citation[];
  caveats: string[];
  layersSearched?: string[];
}

const MemorySearchResultRef =
  builder.objectRef<MemorySearchResult>('MemorySearchResult');

export const MemorySearchResultType = MemorySearchResultRef.implement({
  description: 'Result from memory search',
  fields: (t) => ({
    answer: t.exposeString('answer', {
      description: 'Answer synthesized from memory',
    }),
    source: t.field({
      type: MemorySourceEnum,
      description: 'Primary source of the answer',
      resolve: (r) =>
        r.source.toUpperCase() as
          | 'PERSONAL'
          | 'TEAM'
          | 'RULES'
          | 'TRANSCRIPTS'
          | 'COMBINED',
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
    caveats: t.stringList({
      description: 'Caveats or notes about the results',
      resolve: (r) => r.caveats,
    }),
    layersSearched: t.field({
      type: [MemoryLayerEnum],
      description: 'Which memory layers were searched',
      resolve: (r) => {
        return (r.layersSearched || []).map(
          (l) =>
            l.toUpperCase() as
              | 'RULES'
              | 'SUMMARIES'
              | 'OBSERVATIONS'
              | 'TRANSCRIPTS'
              | 'TEAM'
        );
      },
    }),
  }),
});
