/**
 * Data Abstraction Layer
 *
 * This module provides the DataSource interface for abstracting over
 * SQLite (local mode) and PostgreSQL (hosted mode).
 *
 * Usage:
 *   import { DataSource, LocalDataSource, getLocalDataSource } from '../data';
 *
 * All GraphQL resolvers should use context.dataSource instead of
 * importing from db/index.ts directly.
 */

// Interface and types
export type {
	Connection,
	ConnectionArgs,
	DataSource,
	DataSourceMode,
	Edge,
	HookStatsOptions,
	MessageListOptions,
	MessageSearchOptions,
	PageInfo,
	SessionListOptions,
	TaskMetricsOptions,
} from "./interfaces.ts";

// Local implementation
export {
	_resetLocalDataSource,
	getLocalDataSource,
	LocalDataSource,
} from "./local/index.ts";
