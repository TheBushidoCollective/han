/**
 * GraphQL MemoryAgentProgressType enum
 *
 * Type of progress update from Memory Agent.
 */

import { builder } from '../../builder.ts';

export const MemoryAgentProgressTypeEnum = builder.enumType(
  'MemoryAgentProgressType',
  {
    values: [
      'SEARCHING',
      'FOUND',
      'SYNTHESIZING',
      'COMPLETE',
      'ERROR',
    ] as const,
    description: 'Type of progress update from Memory Agent',
  }
);
