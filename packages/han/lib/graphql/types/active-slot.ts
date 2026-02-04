/**
 * GraphQL ActiveSlot type
 *
 * Information about an active slot.
 */

import { builder } from '../builder.ts';

/**
 * Active slot data
 */
export interface ActiveSlotData {
  slotId: number;
  sessionId: string;
  hookName: string;
  pluginName?: string;
  pid: number;
  heldForMs: number;
}

/**
 * Active slot type ref
 */
const ActiveSlotRef = builder.objectRef<ActiveSlotData>('ActiveSlot');

/**
 * Active slot type implementation
 */
export const ActiveSlotType = ActiveSlotRef.implement({
  description: 'Information about an active slot',
  fields: (t) => ({
    slotId: t.exposeInt('slotId', { description: 'Slot identifier' }),
    sessionId: t.exposeString('sessionId', {
      description: 'Session that owns this slot',
    }),
    hookName: t.exposeString('hookName', {
      description: 'Hook currently running',
    }),
    pluginName: t.exposeString('pluginName', {
      nullable: true,
      description: 'Plugin that owns the hook',
    }),
    pid: t.exposeInt('pid', { description: 'Process ID holding the slot' }),
    heldForMs: t.exposeInt('heldForMs', {
      description: 'How long the slot has been held in milliseconds',
    }),
  }),
});
