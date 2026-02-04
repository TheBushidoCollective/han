/**
 * GraphQL HourlyActivity type
 *
 * Activity metrics for an hour of the day.
 */

import { builder } from '../builder.ts';

/**
 * Activity for an hour of the day (0-23)
 */
export interface HourlyActivity {
  hour: number; // 0-23
  sessionCount: number;
  messageCount: number;
}

/**
 * Hourly activity type ref
 */
const HourlyActivityRef = builder.objectRef<HourlyActivity>('HourlyActivity');

/**
 * Hourly activity type implementation
 */
export const HourlyActivityType = HourlyActivityRef.implement({
  description: 'Activity metrics for an hour of the day',
  fields: (t) => ({
    hour: t.exposeInt('hour', {
      description: 'Hour of day (0-23)',
    }),
    sessionCount: t.exposeInt('sessionCount', {
      description: 'Number of sessions started in this hour',
    }),
    messageCount: t.exposeInt('messageCount', {
      description: 'Number of messages sent in this hour',
    }),
  }),
});
