/**
 * Pothos Schema Builder Configuration
 *
 * Sets up the GraphQL schema builder for the Han Team Server with:
 * - Type-safe schema building via Pothos
 * - Relay plugin for global IDs and connections
 * - Context type for authentication and data access
 *
 * @description The builder is the foundation for all GraphQL types in the team server.
 * It provides type-safe schema construction with automatic TypeScript inference.
 */

import SchemaBuilder from "@pothos/core";
import RelayPlugin from "@pothos/plugin-relay";
import type { Pool } from "pg";

/**
 * User role for access control within the team platform.
 *
 * @description Roles determine what actions a user can perform:
 * - `admin`: Full organization administration capabilities
 * - `manager`: Team management and metrics viewing
 * - `member`: Regular team member with session access
 * - `viewer`: Read-only access to sessions and analytics
 */
export type UserRole = "admin" | "manager" | "member" | "viewer";

/**
 * Authentication context for the current user.
 *
 * @description Populated from JWT token or session cookie during request processing.
 * Contains user identity and authorization information for access control.
 */
export interface UserContext {
  /** Unique user identifier */
  id: string;
  /** User's email address */
  email: string;
  /** User's display name */
  name?: string;
  /** User's role within their organization */
  role: UserRole;
  /** Organization ID the user belongs to */
  orgId: string;
  /** Team IDs the user has access to */
  teamIds?: string[];
}

/**
 * GraphQL resolver context.
 *
 * @description Provides access to database connections, authentication state,
 * and utility services for all GraphQL resolvers. Created fresh for each request.
 */
export interface GraphQLContext {
  /** PostgreSQL connection pool for database queries */
  db: Pool;
  /** Authenticated user context, undefined if not authenticated */
  user?: UserContext;
  /** Current environment for conditional behavior */
  env: "development" | "staging" | "production";
}

/**
 * Pothos schema builder with Relay plugin.
 *
 * @description The builder provides:
 * - Type-safe field definitions with automatic TypeScript inference
 * - Global object identification via Relay Node interface
 * - Cursor-based pagination via Relay connections
 * - Custom scalar types for DateTime
 *
 * Global IDs use {Typename}:{ID} format for consistency with the local coordinator.
 */
export const builder = new SchemaBuilder<{
  Context: GraphQLContext;
  DefaultEdgesNullability: false;
  DefaultNodeNullability: false;
  Scalars: {
    DateTime: {
      Input: Date | string;
      Output: Date | string;
    };
  };
}>({
  plugins: [RelayPlugin],
  relay: {
    clientMutationId: "omit",
    cursorType: "String",
    // Global ID format: {Typename}:{ID}
    encodeGlobalID: (typename: string, id: string | number | bigint) =>
      `${typename}:${String(id)}`,
    decodeGlobalID: (globalId: string) => {
      const [typename, ...rest] = globalId.split(":");
      const id = rest.join(":"); // Handle IDs that contain colons
      if (!typename || !id) {
        throw new Error(`Invalid global ID format: ${globalId}`);
      }
      return { typename, id };
    },
    // Node resolution is handled in schema.ts after all types are registered
    nodesOnConnection: false,
  },
});

/**
 * DateTime scalar for timestamp fields.
 *
 * @description Handles serialization and parsing of dates:
 * - Serializes Date objects to ISO 8601 strings
 * - Parses ISO 8601 strings back to Date objects
 * - Accepts both Date objects and strings as input
 */
builder.scalarType("DateTime", {
  description:
    "ISO 8601 formatted date-time string (e.g., '2025-01-31T12:00:00Z')",
  serialize: (value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return String(value);
  },
  parseValue: (value) => {
    if (typeof value === "string") {
      return new Date(value);
    }
    throw new Error("DateTime must be an ISO 8601 string");
  },
});

// Initialize the query type (fields added in schema.ts)
builder.queryType({
  description: "Root query type for the Han Team Server GraphQL API",
});

// Initialize the mutation type (fields added in schema.ts)
builder.mutationType({
  description: "Root mutation type for modifying team server data",
});
