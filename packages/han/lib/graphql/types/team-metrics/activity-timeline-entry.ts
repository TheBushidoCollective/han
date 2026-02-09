/**
 * ActivityTimelineEntry Type
 *
 * Single data point in the activity timeline.
 */

import { builder } from '../../builder.ts';

export interface ActivityTimelineEntry {
  period: string;
  sessionCount: number;
  messageCount: number;
  taskCount: number;
}

const ActivityTimelineEntryRef = builder.objectRef<ActivityTimelineEntry>(
  'ActivityTimelineEntry'
);

export const ActivityTimelineEntryType = ActivityTimelineEntryRef.implement({
  description: 'Single data point in the activity timeline',
  fields: (t) => ({
    period: t.exposeString('period', {
      description: 'Time period label',
    }),
    sessionCount: t.exposeInt('sessionCount', {
      description: 'Sessions started in this period',
    }),
    messageCount: t.exposeInt('messageCount', {
      description: 'Messages exchanged in this period',
    }),
    taskCount: t.exposeInt('taskCount', {
      description: 'Tasks created in this period',
    }),
  }),
});
