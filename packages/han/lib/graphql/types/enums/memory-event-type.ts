/**
 * GraphQL MemoryEventType enum
 *
 * Type of memory that changed in an event.
 */

import { builder } from '../../builder.ts';

/**
 * Memory event type enum
 */
export const MemoryEventTypeEnum = builder.enumType('MemoryEventType', {
  description: 'Type of memory that changed',
  values: {
    SESSION: { value: 'session' },
    SUMMARY: { value: 'summary' },
    RULE: { value: 'rule' },
    OBSERVATION: { value: 'observation' },
    RELOAD: { value: 'reload' },
  } as const,
});
