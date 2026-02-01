/**
 * PostgreSQL Client for Hosted Mode
 *
 * Sets up Drizzle ORM connection to PostgreSQL.
 * Configuration is loaded from environment variables.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.ts";

// =============================================================================
// Configuration
// =============================================================================

/**
 * PostgreSQL connection configuration from environment variables
 */
export interface PostgresConfig {
	host: string;
	port: number;
	database: string;
	user: string;
	password: string;
	ssl?: boolean | "require" | "prefer";
	maxConnections?: number;
}

/**
 * Get PostgreSQL configuration from environment variables
 *
 * Required env vars:
 * - POSTGRES_HOST
 * - POSTGRES_DB
 * - POSTGRES_USER
 * - POSTGRES_PASSWORD
 *
 * Optional env vars:
 * - POSTGRES_PORT (default: 5432)
 * - POSTGRES_SSL (default: false)
 * - POSTGRES_MAX_CONNECTIONS (default: 10)
 */
export function getPostgresConfig(): PostgresConfig {
	const host = process.env.POSTGRES_HOST;
	const database = process.env.POSTGRES_DB;
	const user = process.env.POSTGRES_USER;
	const password = process.env.POSTGRES_PASSWORD;

	if (!host || !database || !user || !password) {
		throw new Error(
			"Missing required PostgreSQL environment variables: POSTGRES_HOST, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD",
		);
	}

	const port = process.env.POSTGRES_PORT
		? Number.parseInt(process.env.POSTGRES_PORT, 10)
		: 5432;

	const ssl = process.env.POSTGRES_SSL
		? process.env.POSTGRES_SSL === "true" || process.env.POSTGRES_SSL
		: false;

	const maxConnections = process.env.POSTGRES_MAX_CONNECTIONS
		? Number.parseInt(process.env.POSTGRES_MAX_CONNECTIONS, 10)
		: 10;

	return {
		host,
		port,
		database,
		user,
		password,
		ssl: ssl as PostgresConfig["ssl"],
		maxConnections,
	};
}

// =============================================================================
// Database Client
// =============================================================================

/**
 * PostgreSQL client type
 */
export type PostgresClient = ReturnType<typeof postgres>;

/**
 * Drizzle database instance type
 */
export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

// Singleton instances
let _sql: PostgresClient | null = null;
let _db: DrizzleDb | null = null;

/**
 * Create and return the PostgreSQL client
 * Uses singleton pattern to reuse connections
 */
export function getPostgresClient(): PostgresClient {
	if (!_sql) {
		const config = getPostgresConfig();
		// SSL configuration - always validate certificates in production
		// POSTGRES_SSL_REJECT_UNAUTHORIZED=false is ONLY allowed in non-production environments
		const isProduction = process.env.NODE_ENV === "production";
		const disableValidation =
			!isProduction &&
			process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED === "false";

		if (disableValidation) {
			console.warn(
				"[postgres] WARNING: SSL certificate validation disabled. " +
					"This is acceptable for development with self-signed certificates, " +
					"but should NEVER be used in production.",
			);
		}

		const sslConfig = config.ssl
			? {
					// In production, ALWAYS validate certificates regardless of env var
					rejectUnauthorized: isProduction ? true : !disableValidation,
				}
			: false;

		_sql = postgres({
			host: config.host,
			port: config.port,
			database: config.database,
			username: config.user,
			password: config.password,
			ssl: sslConfig,
			max: config.maxConnections,
		});
	}
	return _sql;
}

/**
 * Get the Drizzle database instance
 * Uses singleton pattern for connection reuse
 */
export function getDb(): DrizzleDb {
	if (!_db) {
		const sql = getPostgresClient();
		_db = drizzle(sql, { schema });
	}
	return _db;
}

/**
 * Close the database connection
 * Call this on application shutdown
 */
export async function closeDb(): Promise<void> {
	if (_sql) {
		await _sql.end();
		_sql = null;
		_db = null;
	}
}

/**
 * Reset the database singleton (for testing)
 * @internal
 */
export function _resetDb(): void {
	_sql = null;
	_db = null;
}

// =============================================================================
// Multi-Tenant Context
// =============================================================================

/**
 * Tenant context for multi-tenant queries
 * This should be set from the authenticated user's session
 */
export interface TenantContext {
	organizationId: string;
	userId?: string;
	teamId?: string;
}

/**
 * AsyncLocalStorage for request-scoped tenant context
 * This ensures proper isolation between concurrent requests in multi-tenant scenarios.
 * Each request has its own context that cannot leak to other requests.
 */
const tenantStorage = new AsyncLocalStorage<TenantContext>();

/**
 * Set the current tenant context
 *
 * @deprecated REMOVED - Use withTenantContext() instead for proper async isolation.
 * This method now throws an error to prevent accidental misuse.
 */
export function setTenantContext(_context: TenantContext): void {
	throw new Error(
		"setTenantContext() is deprecated and has been removed. " +
			"Use withTenantContext(context, async () => { ... }) instead to ensure " +
			"proper tenant isolation in concurrent request scenarios.",
	);
}

/**
 * Get the current tenant context
 * Throws if no tenant context is set
 */
export function getTenantContext(): TenantContext {
	const context = tenantStorage.getStore();
	if (!context) {
		throw new Error(
			"No tenant context set. Wrap your request handler with withTenantContext().",
		);
	}
	return context;
}

/**
 * Clear the current tenant context
 *
 * @deprecated REMOVED - Use withTenantContext() instead.
 * AsyncLocalStorage automatically clears context when the async scope exits.
 * This method now throws an error to prevent accidental misuse.
 */
export function clearTenantContext(): void {
	throw new Error(
		"clearTenantContext() is deprecated and has been removed. " +
			"Use withTenantContext(context, async () => { ... }) instead. " +
			"The context is automatically cleaned up when the async scope exits.",
	);
}

/**
 * Execute a function with a specific tenant context
 * This is the recommended way to handle tenant isolation.
 *
 * Uses AsyncLocalStorage to ensure the context is:
 * - Isolated to this specific async execution chain
 * - Automatically propagated to all nested async calls
 * - Automatically cleaned up when the function completes
 * - Cannot leak to concurrent requests
 *
 * @example
 * ```typescript
 * app.use(async (req, res, next) => {
 *   const tenant = await authenticateAndGetTenant(req);
 *   await withTenantContext(tenant, async () => {
 *     return next();
 *   });
 * });
 * ```
 */
export async function withTenantContext<T>(
	context: TenantContext,
	fn: () => Promise<T>,
): Promise<T> {
	return tenantStorage.run(context, fn);
}
