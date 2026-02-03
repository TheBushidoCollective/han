/**
 * GraphQL MemoryQuery type
 *
 * Memory query interface for viewer.memory field.
 */

import { queryMemoryAgent } from '../../../memory/memory-agent.ts';
import { builder } from '../../builder.ts';
import { getAllRules, RuleType } from '../rule.ts';
import { MemoryLayerEnum } from './memory-layer-enum.ts';
import type { MemorySearchResult } from './memory-search-result.ts';
import { MemorySearchResultType } from './memory-search-result.ts';

/**
 * Memory query data interface
 */
export interface MemoryQueryData {
  _phantom?: never;
}

const MemoryQueryRef = builder.objectRef<MemoryQueryData>('MemoryQuery');

export const MemoryQueryType = MemoryQueryRef.implement({
  description: 'Memory query interface',
  fields: (t) => ({
    search: t.field({
      type: MemorySearchResultType,
      args: {
        query: t.arg.string({ required: true }),
        projectPath: t.arg.string({
          required: true,
          description:
            'Project filesystem path for plugin discovery. Required for context-aware search.',
        }),
        layers: t.arg({ type: [MemoryLayerEnum] }),
      },
      description: 'Search memory with a question (requires project context)',
      resolve: async (_parent, args) => {
        // Use Memory Agent with discovered MCP providers (blueprints, github, etc.)
        // projectPath is required for context-aware plugin discovery
        const result = await queryMemoryAgent({
          question: args.query,
          projectPath: args.projectPath,
        });

        // Map MemoryAgentResponse to MemorySearchResult
        return {
          answer: result.answer,
          source:
            result.searchedLayers.length > 1
              ? 'combined'
              : result.searchedLayers[0] || 'transcripts',
          confidence: result.confidence,
          citations: result.citations.map((c) => ({
            source: c.source,
            excerpt: c.excerpt,
            author: c.author,
            timestamp: c.timestamp,
            layer: c.layer,
          })),
          caveats: result.error ? [result.error] : [],
          layersSearched: result.searchedLayers,
        } as MemorySearchResult;
      },
    }),
    rules: t.field({
      type: [RuleType],
      description: 'All project and user rules across registered projects',
      resolve: () => getAllRules(),
    }),
  }),
});
