/**
 * PostgreSQL Client for Hosted Mode
 *
 * Sets up Drizzle ORM connection to PostgreSQL.
 * Configuration is loaded from environment variables.
 */

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
		_sql = postgres({
			host: config.host,
			port: config.port,
			database: config.database,
			username: config.user,
			password: config.password,
			ssl: config.ssl ? { rejectUnauthorized: false } : false,
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
 * Thread-local storage for tenant context
 * In a real implementation, this would use AsyncLocalStorage
 */
let _currentTenant: TenantContext | null = null;

/**
 * Set the current tenant context
 * Call this at the start of each request after authentication
 */
export function setTenantContext(context: TenantContext): void {
	_currentTenant = context;
}

/**
 * Get the current tenant context
 * Throws if no tenant context is set
 */
export function getTenantContext(): TenantContext {
	if (!_currentTenant) {
		throw new Error(
			"No tenant context set. Call setTenantContext() first.",
		);
	}
	return _currentTenant;
}

/**
 * Clear the current tenant context
 * Call this at the end of each request
 */
export function clearTenantContext(): void {
	_currentTenant = null;
}

/**
 * Execute a function with a specific tenant context
 * Automatically clears the context when done
 */
export async function withTenantContext<T>(
	context: TenantContext,
	fn: () => Promise<T>,
): Promise<T> {
	const previousContext = _currentTenant;
	try {
		setTenantContext(context);
		return await fn();
	} finally {
		_currentTenant = previousContext;
	}
}
