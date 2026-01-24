import { ViewTypes } from '../components/organisms/index.ts';

// Standard row heights for different view types
// SESSION_ROW: Base (padding 24px) + title row (24px) + middle row (28px) + stats row (28px) = ~104px
// Added extra padding for comfortable spacing
export const ItemHeights = {
  SESSION_ROW: 110, // Increased to accommodate task/todo info
  SESSION_ROW_MINIMAL: 85, // When no task/todo is shown
  PROJECT_CARD: 140, // Increased for better spacing
  MESSAGE_ITEM: 100, // Variable, this is minimum
  PLUGIN_CARD: 120, // Increased for better spacing
  LOADING: 48,
} as const;

/**
 * Calculate session item height based on content
 * - Has active task or todo: full height with description row
 * - Has summary: full height with summary row
 * - Minimal: just title and stats
 */
export function getSessionItemHeight(session: {
  currentTask?: { status?: string | null } | null;
  currentTodo?: unknown;
  summary?: string | null;
}): number {
  const hasActiveTask = session.currentTask?.status === 'ACTIVE';
  const hasActiveTodo = session.currentTodo && !hasActiveTask;
  const hasSummary = session.summary && !hasActiveTask && !hasActiveTodo;

  // Return full height if there's content to show in the middle row
  if (hasActiveTask || hasActiveTodo || hasSummary) {
    return ItemHeights.SESSION_ROW;
  }

  return ItemHeights.SESSION_ROW_MINIMAL;
}

/**
 * Get item type for FlashList recycling optimization
 */
export function getItemType(
  _item: unknown,
  _index: number
): (typeof ViewTypes)[keyof typeof ViewTypes] {
  return ViewTypes.SESSION_ROW;
}

/**
 * Get message item type for FlashList
 */
export function getMessageItemType(
  _item: unknown,
  _index: number
): (typeof ViewTypes)[keyof typeof ViewTypes] {
  return ViewTypes.MESSAGE_ITEM;
}
