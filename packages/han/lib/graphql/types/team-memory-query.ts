/**
 * Team Memory GraphQL Query Types
 *
 * Adds teamMemory and orgLearnings queries to the GraphQL schema.
 */

import {
  getOrgLearnings,
  type OrgLearningsResult,
} from '../../memory/org-learnings.ts';
import type { UserPermissionContext } from '../../memory/permission-filter.ts';
import {
  getTeamMemoryLayers,
  queryTeamMemory,
  type TeamMemoryResult,
} from '../../memory/team-memory-query.ts';
import { builder } from '../builder.ts';
import {
  ConfidenceEnum,
  MemoryLayerInfoType,
  MemoryScopeEnum,
  OrgLearningsResultType,
  TeamMemoryResultType,
} from './memory/index.ts';

/**
 * Team memory query input
 */
const TeamMemoryQueryInput = builder.inputType('TeamMemoryQueryInput', {
  description: 'Input for team memory query',
  fields: (t) => ({
    question: t.string({
      required: true,
      description: 'The question to research in team memory',
    }),
    scope: t.field({
      type: MemoryScopeEnum,
      required: false,
      description: 'Memory scope to search (default: TEAM)',
    }),
    limit: t.int({
      required: false,
      description: 'Maximum results to return (default: 20)',
    }),
    useCache: t.boolean({
      required: false,
      description: 'Whether to use cached results (default: true)',
    }),
    projectPath: t.string({
      required: false,
      description: 'Project path for context-aware search',
    }),
  }),
});

/**
 * User context input for authentication
 * In a real deployment, this would come from the auth token
 */
const UserContextInput = builder.inputType('UserContextInput', {
  description: 'User context for permission checking',
  fields: (t) => ({
    userId: t.string({
      required: true,
      description: 'User identifier',
    }),
    orgId: t.string({
      required: false,
      description: 'Organization identifier',
    }),
    email: t.string({
      required: false,
      description: 'User email for matching git authors',
    }),
  }),
});

/**
 * Org learnings query input
 */
const OrgLearningsQueryInput = builder.inputType('OrgLearningsQueryInput', {
  description: 'Input for org learnings query',
  fields: (t) => ({
    limit: t.int({
      required: false,
      description: 'Maximum learnings to return (default: 50)',
    }),
    domain: t.string({
      required: false,
      description: 'Filter by domain (e.g., api, testing)',
    }),
    minConfidence: t.field({
      type: ConfidenceEnum,
      required: false,
      description: 'Minimum confidence level to include',
    }),
    useCache: t.boolean({
      required: false,
      description: 'Whether to use cached results (default: true)',
    }),
  }),
});

/**
 * Add teamMemory query to schema
 */
builder.queryField('teamMemory', (t) =>
  t.field({
    type: TeamMemoryResultType,
    args: {
      input: t.arg({ type: TeamMemoryQueryInput, required: true }),
      userContext: t.arg({ type: UserContextInput, required: true }),
    },
    description: 'Query team memory with permission filtering',
    resolve: async (_parent, args): Promise<TeamMemoryResult> => {
      const { input, userContext } = args;

      // Build user permission context
      const context: UserPermissionContext = {
        userId: userContext.userId,
        orgId: userContext.orgId ?? undefined,
        email: userContext.email ?? undefined,
        // In a real deployment, these would come from the auth system
        accessibleProjects: [],
        accessibleRepos: [],
      };

      // Query team memory
      const result = await queryTeamMemory({
        question: input.question,
        context,
        scope:
          (input.scope as 'personal' | 'project' | 'team' | 'org') ?? 'team',
        limit: input.limit ?? 20,
        useCache: input.useCache ?? true,
        projectPath: input.projectPath ?? undefined,
      });

      return result;
    },
  })
);

/**
 * Add orgLearnings query to schema
 */
builder.queryField('orgLearnings', (t) =>
  t.field({
    type: OrgLearningsResultType,
    args: {
      input: t.arg({ type: OrgLearningsQueryInput, required: false }),
      userContext: t.arg({ type: UserContextInput, required: true }),
    },
    description: 'Get aggregated learnings across the organization',
    resolve: async (_parent, args): Promise<OrgLearningsResult> => {
      const { input, userContext } = args;

      // Build user permission context
      const context: UserPermissionContext = {
        userId: userContext.userId,
        orgId: userContext.orgId ?? undefined,
        email: userContext.email ?? undefined,
        accessibleProjects: [],
        accessibleRepos: [],
      };

      // Get org learnings
      const result = await getOrgLearnings(context, {
        limit: input?.limit ?? 50,
        domain: input?.domain ?? undefined,
        minConfidence: input?.minConfidence as
          | 'high'
          | 'medium'
          | 'low'
          | undefined,
        useCache: input?.useCache ?? true,
      });

      return result;
    },
  })
);

/**
 * Add teamMemoryLayers query to schema
 */
builder.queryField('teamMemoryLayers', (t) =>
  t.field({
    type: [MemoryLayerInfoType],
    args: {
      userContext: t.arg({ type: UserContextInput, required: true }),
    },
    description: 'Get available memory layers for the user',
    resolve: async (_parent, args) => {
      const { userContext } = args;

      // Build user permission context
      const context: UserPermissionContext = {
        userId: userContext.userId,
        orgId: userContext.orgId ?? undefined,
        email: userContext.email ?? undefined,
        accessibleProjects: [],
        accessibleRepos: [],
      };

      return getTeamMemoryLayers(context);
    },
  })
);

// Export types to prevent tree-shaking
export { TeamMemoryQueryInput, UserContextInput, OrgLearningsQueryInput };
