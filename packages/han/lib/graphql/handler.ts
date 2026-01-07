/**
 * GraphQL Handler Export
 *
 * Exports the GraphQL yoga handler for use in Next.js API routes.
 * This allows the browse-client to import and use the GraphQL endpoint.
 *
 * Creates DataLoaders per-request to ensure proper request isolation
 * and efficient batching of database access.
 */

import { makeServer } from "graphql-ws";
import { createYoga } from "graphql-yoga";
import type { GraphQLContext } from "./builder.ts";
import { createLoaders } from "./loaders.ts";
import { schema } from "./schema.ts";

export { schema };

/**
 * Create a GraphQL Yoga instance configured for Next.js
 *
 * Sets up per-request context with fresh DataLoader instances.
 */
export function createGraphQLHandler() {
	return createYoga<GraphQLContext>({
		schema,
		graphqlEndpoint: "/api/graphql",
		graphiql: true,
		cors: {
			origin: "*",
			methods: ["GET", "POST", "OPTIONS"],
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
export { publishMemoryEvent } from "./pubsub.ts";
