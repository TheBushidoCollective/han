/**
 * GraphQL Handler for Hono
 *
 * Creates a GraphQL Yoga instance configured for the Han Team Server.
 *
 * @description This module provides:
 * - GraphQL endpoint handling for Hono
 * - GraphQL Playground/GraphiQL in non-production environments
 * - Introspection control based on environment
 * - Authentication context extraction
 * - Error masking for production
 * - Query depth limiting for DoS protection
 *
 * The handler integrates with Hono's middleware system and extracts
 * authentication context from request headers.
 *
 * @security
 * - Query depth is limited to 10 levels to prevent deeply nested queries
 * - Introspection is disabled in production
 * - Error messages are masked in production
 *
 * TODO (HIGH-4): Add batching attack protection - limit number of queries per request
 * TODO (CRITICAL-2): Add query complexity analysis (@escape.tech/graphql-armor-cost-limit)
 * TODO (HIGH-5): Add field suggestions blocking in production (@escape.tech/graphql-armor-block-field-suggestions)
 * TODO (HIGH-6): Implement DataLoaders for N+1 query prevention
 */

import type {
  DefinitionNode,
  OperationDefinitionNode,
  SelectionNode,
  FieldNode,
} from "graphql";
import { createYoga, type YogaServerOptions } from "graphql-yoga";
import { useDepthLimit } from "@envelop/depth-limit";
import type { Pool } from "pg";
import { schema } from "./schema.ts";
import type { GraphQLContext, UserContext, UserRole } from "./builder.ts";

/**
 * Maximum query depth allowed.
 * Prevents deeply nested queries that could cause performance issues.
 */
const MAX_QUERY_DEPTH = 10;

/**
 * Environment configuration for the GraphQL handler.
 */
export interface GraphQLHandlerConfig {
  /** PostgreSQL connection pool */
  db: Pool;
  /** Current environment */
  env: "development" | "staging" | "production";
  /** Optional base path for GraphQL endpoint */
  graphqlEndpoint?: string;
}

/**
 * Extract user context from JWT claims or session headers.
 *
 * @description In production, this would validate JWT tokens.
 * For development, it extracts from headers set by auth middleware.
 *
 * @param request - The incoming HTTP request
 * @returns User context if authenticated, undefined otherwise
 */
function extractUserContext(request: Request): UserContext | undefined {
  // Check for user ID header (set by auth middleware)
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return undefined;
  }

  // Extract email (required for context)
  const email = request.headers.get("x-user-email");
  if (!email) {
    return undefined;
  }

  // Extract role, default to 'member'
  const roleHeader = request.headers.get("x-user-role");
  const validRoles: UserRole[] = ["admin", "manager", "member", "viewer"];
  const role: UserRole = validRoles.includes(roleHeader as UserRole)
    ? (roleHeader as UserRole)
    : "member";

  // Extract organization ID (required in production)
  const orgId = request.headers.get("x-org-id");
  if (!orgId) {
    return undefined;
  }

  // Extract team IDs (comma-separated)
  const teamIdsHeader = request.headers.get("x-team-ids");
  const teamIds = teamIdsHeader
    ? teamIdsHeader.split(",").map((id) => id.trim())
    : undefined;

  return {
    id: userId,
    email,
    name: request.headers.get("x-user-name") || undefined,
    role,
    orgId,
    teamIds,
  };
}

/**
 * Create a GraphQL Yoga handler configured for the Han Team Server.
 *
 * @description The handler provides:
 * - Full GraphQL execution with the team server schema
 * - GraphQL Playground at the endpoint (GET requests) in dev/staging
 * - Introspection queries in dev/staging only
 * - Error masking in production (hides internal error details)
 * - Per-request context with authentication
 *
 * @param config - Handler configuration
 * @returns Yoga server instance compatible with Hono
 *
 * @example
 * ```typescript
 * import { Hono } from "hono";
 * import { createGraphQLHandler } from "./graphql/handler.ts";
 *
 * const app = new Hono();
 * const yoga = createGraphQLHandler({ db, env: "development" });
 *
 * app.use("/graphql", async (c) => yoga.handle(c.req.raw));
 * ```
 */
export function createGraphQLHandler(config: GraphQLHandlerConfig) {
  const { db, env, graphqlEndpoint = "/graphql" } = config;

  // Determine if we're in production
  const isProduction = env === "production";

  // Build plugins array with security protections
  const plugins = [
    // Query depth limiting - prevents DoS via deeply nested queries
    useDepthLimit({
      maxDepth: MAX_QUERY_DEPTH,
    }),
  ];

  // Add introspection blocking in production
  if (isProduction) {
    plugins.push({
      onExecute({ args }: { args: { document: { definitions: readonly DefinitionNode[] } } }) {
        // Block introspection queries in production
        const isIntrospection = args.document.definitions.some(
          (def: DefinitionNode) =>
            def.kind === "OperationDefinition" &&
            (def as OperationDefinitionNode).selectionSet.selections.some(
              (sel: SelectionNode) =>
                sel.kind === "Field" && (sel as FieldNode).name.value.startsWith("__")
            )
        );
        if (isIntrospection) {
          throw new Error("Introspection is disabled in production");
        }
      },
    });
  }

  // Configure Yoga options based on environment
  const yogaOptions: YogaServerOptions<GraphQLContext, GraphQLContext> = {
    schema,
    graphqlEndpoint,
    plugins,

    // Enable GraphiQL/Playground in non-production
    // GraphiQL is the interactive IDE served at GET /graphql
    graphiql: !isProduction && {
      title: "Han Team Server GraphQL API",
      defaultQuery: `# Welcome to the Han Team Server GraphQL API!
#
# This is an interactive GraphQL IDE where you can:
# - Explore the schema using the docs panel on the right
# - Write and execute queries
# - View query history
#
# Try this query to get started:

query GetApiInfo {
  apiInfo {
    version
    environment
    introspectionEnabled
    features
  }
}

# Once authenticated, you can query your profile:
# query WhoAmI {
#   me {
#     id
#     email
#     name
#   }
# }
`,
    },

    // Mask errors in production to prevent information leakage
    maskedErrors: isProduction,

    // Create context for each request
    context: ({ request }): GraphQLContext => ({
      db,
      env,
      user: extractUserContext(request),
    }),

    // CORS configuration
    cors: {
      origin: isProduction
        ? ["https://team.han.guru", "https://han.guru"]
        : "*",
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
    },
  };

  return createYoga(yogaOptions);
}

/**
 * Re-export schema for use in other modules (e.g., schema export script).
 */
export { schema };
