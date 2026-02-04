/**
 * GraphQL MemoryLayer enum
 *
 * Layer in the memory system.
 */

import { builder } from '../../builder.ts';

export const MemoryLayerEnum = builder.enumType('MemoryLayer', {
  values: [
    'RULES',
    'SUMMARIES',
    'OBSERVATIONS',
    'TRANSCRIPTS',
    'TEAM',
  ] as const,
  description: 'Layer in the memory system',
});
