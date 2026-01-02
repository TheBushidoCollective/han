import { LayoutProvider } from 'recyclerlistview/web';
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

// Create a layout provider for session lists
export function createSessionListLayout(width: number) {
  return new LayoutProvider(
    () => ViewTypes.SESSION_ROW,
    (_type, dim) => {
      dim.width = width;
      dim.height = ItemHeights.SESSION_ROW;
    }
  );
}

// Create a layout provider for project cards (grid)
export function createProjectGridLayout(width: number, columns = 2) {
  const cardWidth = Math.floor((width - 16 * (columns - 1)) / columns);
  return new LayoutProvider(
    () => ViewTypes.PROJECT_CARD,
    (_type, dim) => {
      dim.width = cardWidth;
      dim.height = ItemHeights.PROJECT_CARD;
    }
  );
}

// Create a layout provider for message list (variable height)
export function createMessageListLayout(
  width: number,
  getMessageHeight: (index: number) => number
) {
  return new LayoutProvider(
    () => ViewTypes.MESSAGE_ITEM,
    (_type, dim, index) => {
      dim.width = width;
      dim.height = getMessageHeight(index);
    }
  );
}
