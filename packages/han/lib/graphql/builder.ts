/**
 * Pothos Schema Builder configuration
 *
 * Sets up the GraphQL schema builder with Relay plugin for:
 * - Node interface (global object identification)
 * - Connections (cursor-based pagination)
 * - Global IDs in {Typename}_{ID} format
 *
 * @defer directive is added manually in schema.ts for GraphQL Yoga incremental delivery
 */

import SchemaBuilder from "@pothos/core";
import RelayPlugin from "@pothos/plugin-relay";
import type { AuthContext } from "../auth/types.ts";
import type { DataSource, DataSourceMode } from "../data/index.ts";
import type { PermissionService } from "../permissions/index.ts";
import type { GraphQLLoaders } from "./loaders.ts";
import {
	decodeGlobalId,
	encodeGlobalId,
	resolveNode,
} from "./node-registry.ts";

/**
 * User role for access control
 */
export type UserRole = "ic" | "manager" | "admin";

/**
 * User information extracted from request headers or auth
 */
export interface UserContext {
	/** User ID */
	id: string;
	/** User display name */
	displayName?: string;
	/** User role */
	role: UserRole;
	/** Organization ID the user belongs to */
	orgId?: string;
	/** Project IDs the user has access to */
	projectIds?: string[];
}

/**
 * Context type for GraphQL resolvers
 *
 * Includes DataLoaders for efficient batching and caching.
 * Loaders are created per-request to ensure proper isolation.
 */
export interface GraphQLContext {
	/** Request object for headers, etc. */
	request?: Request;
	/** DataLoaders for batching database access */
	loaders: GraphQLLoaders;
	/** User information for access control */
	user?: UserContext;
	/** Authentication context (user and session from JWT) */
	auth?: AuthContext;
	/** Data source for database access (local SQLite or hosted PostgreSQL) */
	dataSource: DataSource;
	/** Current mode (local or hosted) */
	mode: DataSourceMode;
	/** Permission service for access control (only in hosted mode) */
	permissions?: PermissionService;
}

/**
 * Pothos schema builder with Relay plugin
 *
 * Using simple type config - types are defined inline in each file
 * Global IDs use {Typename}_{ID} format (not base64)
 *
 * Note: @defer directive is added manually in schema.ts for GraphQL Yoga
 */
export const builder = new SchemaBuilder<{
	Context: GraphQLContext;
	DefaultEdgesNullability: false;
	DefaultNodeNullability: false;
	Scalars: {
		DateTime: {
			Input: Date | string | number;
			Output: Date | string | number;
		};
		BigInt: {
			Input: bigint | number | string;
			Output: bigint | number | string;
		};
	};
}>({
	plugins: [RelayPlugin],
	relay: {
		clientMutationId: "omit",
		cursorType: "String",
		// Custom global ID encoding: {Typename}:{ID} (colon-delimited)
		encodeGlobalID: (typename: string, id: string | number | bigint) =>
			encodeGlobalId(typename, String(id)),
		decodeGlobalID: (globalId: string) => {
			const parsed = decodeGlobalId(globalId);
			if (!parsed) {
				throw new Error(`Invalid global ID format: ${globalId}`);
			}
			return { typename: parsed.typename, id: parsed.id };
		},
		// Custom node resolver using our node registry
		nodeQueryOptions: {
			description: "Fetch any node by its global ID",
			resolve: async (
				_root: unknown,
				args: { id: string | { id: string; typename: string } },
			) => {
				// Handle both raw string ID and decoded {id, typename} object
				const globalId =
					typeof args.id === "string"
						? args.id
						: encodeGlobalId(args.id.typename, args.id.id);
				const result = await resolveNode(globalId);
				return result?.value ?? null;
			},
		},
		// Disable nodes on connection (we use our own pagination)
		nodesOnConnection: false,
	},
});

// Re-export for use in types
export { encodeGlobalId, decodeGlobalId, resolveNode };

// Add DateTime scalar
builder.scalarType("DateTime", {
	serialize: (value) => {
		if (value instanceof Date) {
			return value.toISOString();
		}
		if (typeof value === "number") {
			return new Date(value).toISOString();
		}
		return String(value);
	},
	parseValue: (value) => {
		if (typeof value === "string" || typeof value === "number") {
			return new Date(value);
		}
		throw new Error("DateTime must be a string or number");
	},
});

// Add BigInt scalar for large numbers (token counts can exceed 32-bit Int)
builder.scalarType("BigInt", {
	serialize: (value) => {
		// Serialize as string to avoid JavaScript precision loss
		return String(value);
	},
	parseValue: (value) => {
		if (typeof value === "bigint") {
			return value;
		}
		if (typeof value === "number") {
			return BigInt(Math.floor(value));
		}
		if (typeof value === "string") {
			return BigInt(value);
		}
		throw new Error("BigInt must be a bigint, number, or string");
	},
});

// Initialize query type
builder.queryType({});
