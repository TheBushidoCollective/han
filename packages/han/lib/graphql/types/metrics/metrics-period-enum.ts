/**
 * GraphQL MetricsPeriod enum
 *
 * Time period for metrics queries.
 */

import { builder } from '../../builder.ts';

export const MetricsPeriodEnum = builder.enumType('MetricsPeriod', {
  values: ['DAY', 'WEEK', 'MONTH'] as const,
  description: 'Time period for metrics queries',
});
