/**
 * Citation Visibility Enum
 *
 * Defines visibility levels for team memory citations.
 */

import { builder } from '../../builder.ts';

/**
 * Citation visibility enum type for GraphQL
 */
export const CitationVisibilityEnum = builder.enumType('CitationVisibility', {
  description: 'Visibility level for a citation',
  values: {
    PUBLIC: {
      value: 'public',
      description: 'Safe to share broadly within the org',
    },
    TEAM: {
      value: 'team',
      description: 'Visible to team members with repo access',
    },
    PRIVATE: {
      value: 'private',
      description: 'Only visible to the session owner',
    },
  },
});
