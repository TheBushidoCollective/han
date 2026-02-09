/**
 * Memory Scope Enum
 *
 * Defines the visibility/access scopes for team memory queries.
 */

import { builder } from '../../builder.ts';

/**
 * Memory scope enum type for GraphQL
 */
export const MemoryScopeEnum = builder.enumType('MemoryScope', {
  description: 'Memory access scope levels',
  values: {
    PERSONAL: {
      value: 'personal',
      description: "User's own sessions (always accessible)",
    },
    PROJECT: {
      value: 'project',
      description: 'Sessions in projects user belongs to',
    },
    TEAM: {
      value: 'team',
      description: 'Sessions visible via repo permissions',
    },
    ORG: {
      value: 'org',
      description: 'Aggregated learnings only (no raw data)',
    },
  },
});
