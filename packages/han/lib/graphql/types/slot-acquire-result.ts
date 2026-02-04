/**
 * GraphQL SlotAcquireResult type
 *
 * Result of slot acquisition attempt.
 */

import { builder } from '../builder.ts';

/**
 * Slot acquire result data
 */
export interface SlotAcquireResultData {
  granted: boolean;
  slotId: number;
  waitingCount: number;
}

/**
 * Slot acquire result type ref
 */
const SlotAcquireResultRef =
  builder.objectRef<SlotAcquireResultData>('SlotAcquireResult');

/**
 * Slot acquire result type implementation
 */
export const SlotAcquireResultType = SlotAcquireResultRef.implement({
  description: 'Result of slot acquisition attempt',
  fields: (t) => ({
    granted: t.exposeBoolean('granted', {
      description: 'Whether the slot was granted',
    }),
    slotId: t.exposeInt('slotId', {
      description: 'Slot ID if granted, -1 otherwise',
    }),
    waitingCount: t.exposeInt('waitingCount', {
      description: 'Number of slots currently in use (if not granted)',
    }),
  }),
});
