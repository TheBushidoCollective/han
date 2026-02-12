/**
 * GraphQL Handler Export
 *
 * Exports the GraphQL yoga handler for use in Next.js API routes.
 * This allows the browse-client to import and use the GraphQL endpoint.
 *
 * Creates DataLoaders per-request to ensure proper request isolation
 * and efficient batching of database access.
 */

import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { makeServer } from 'graphql-ws';
import { createYoga } from 'graphql-yoga';
import type { GraphQLContext, UserContext, UserRole } from './builder.ts';
import { createLoaders } from './loaders.ts';
import { schema } from './schema.ts';

/**
 * Extract user context from request headers
 * In production, this would validate JWT tokens or session cookies
 */
function _extractUserContext(request: Request): UserContext | undefined {
  // Check for user ID header (set by auth middleware in production)
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return undefined;
  }

  // Extract role from header, default to 'ic'
  const roleHeader = request.headers.get('x-user-role');
  const role: UserRole =
    roleHeader === 'manager' || roleHeader === 'admin' ? roleHeader : 'ic';

  // Extract organization ID
  const orgId = request.headers.get('x-org-id') || undefined;

  // Extract project access list (comma-separated)
  const projectIdsHeader = request.headers.get('x-project-ids');
  const projectIds = projectIdsHeader
    ? projectIdsHeader.split(',').map((id) => id.trim())
    : undefined;

  return {
    id: userId,
    displayName: request.headers.get('x-user-name') || undefined,
    role,
    orgId,
    projectIds,
  };
}

export { schema };

/**
 * Create a GraphQL Yoga instance configured for Next.js
 *
 * Sets up per-request context with fresh DataLoader instances.
 * Enables @defer and @stream directives for incremental delivery.
 */
export function createGraphQLHandler() {
  return createYoga<GraphQLContext>({
    schema,
    graphqlEndpoint: '/api/graphql',
    graphiql: true,
    plugins: [
      useDeferStream(), // Enable @defer and @stream directives
    ],
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'OPTIONS'],
    },
    context: ({ request }) => ({
      request,
      loaders: createLoaders(),
    }),
  });
}

/**
 * Create a WebSocket server for GraphQL subscriptions
 */
export function createGraphQLWebSocketServer() {
  return makeServer({ schema });
}

/**
 * Re-export pubsub for broadcasting events
 */
export { publishMemoryEvent } from './pubsub.ts';
