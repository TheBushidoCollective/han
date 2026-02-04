/**
 * GraphQL MemorySource enum
 *
 * Source of memory search result.
 */

import { builder } from '../../builder.ts';

export const MemorySourceEnum = builder.enumType('MemorySource', {
  values: ['PERSONAL', 'TEAM', 'RULES', 'TRANSCRIPTS', 'COMBINED'] as const,
  description: 'Source of memory search result',
});
