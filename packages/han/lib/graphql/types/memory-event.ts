/**
 * GraphQL MemoryEvent type
 *
 * Event emitted when memory changes, used for subscriptions.
 */

import { builder } from '../builder.ts';
import { EventActionEnum } from './enums/event-action.ts';
import { MemoryEventTypeEnum } from './enums/memory-event-type.ts';

/**
 * Memory event payload interface
 */
export interface MemoryEventPayload {
  type: 'session' | 'summary' | 'rule' | 'observation' | 'reload';
  action: 'created' | 'updated' | 'deleted';
  path: string;
  timestamp: number;
}

/**
 * Memory event type ref
 */
const MemoryEventRef = builder.objectRef<MemoryEventPayload>('MemoryEvent');

/**
 * Memory event type implementation
 */
export const MemoryEventType = MemoryEventRef.implement({
  description: 'Event emitted when memory changes',
  fields: (t) => ({
    type: t.field({
      type: MemoryEventTypeEnum,
      description: 'Type of memory that changed',
      resolve: (e) => e.type,
    }),
    action: t.field({
      type: EventActionEnum,
      description: 'What action occurred',
      resolve: (e) => e.action,
    }),
    path: t.string({
      description: 'Path to the affected file',
      resolve: (e) => e.path,
    }),
    timestamp: t.string({
      description: 'ISO timestamp when the event occurred',
      resolve: (e) => new Date(e.timestamp).toISOString(),
    }),
  }),
});
