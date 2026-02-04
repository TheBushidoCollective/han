/**
 * GraphQL Confidence enum
 *
 * Confidence level in search results.
 */

import { builder } from '../../builder.ts';

export const ConfidenceEnum = builder.enumType('Confidence', {
  values: ['HIGH', 'MEDIUM', 'LOW'] as const,
  description: 'Confidence level in search results',
});
