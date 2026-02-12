/**
 * Granularity Enum
 *
 * Time period granularity for aggregation.
 */

import { builder } from '../../builder.ts';

export const GranularityEnum = builder.enumType('Granularity', {
  description: 'Time period granularity for aggregation',
  values: {
    DAY: { value: 'day' },
    WEEK: { value: 'week' },
    MONTH: { value: 'month' },
  } as const,
});
