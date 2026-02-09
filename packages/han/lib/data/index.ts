/**
 * Data Abstraction Layer
 *
 * This module provides the DataSource interface for abstracting over
 * SQLite (local mode) and PostgreSQL (hosted mode).
 *
 * Usage:
 *   import { DataSource, LocalDataSource, getLocalDataSource } from '../data';
 *   import { HostedDataSource, createHostedDataSource } from '../data';
 *
 * All GraphQL resolvers should use context.dataSource instead of
 * importing from db/index.ts directly.
 */

// Hosted implementation (PostgreSQL via Drizzle ORM)
export {
  clearTenantContext,
  closeDb,
  createHostedDataSource,
  type DrizzleDb,
  getDb,
  getPostgresConfig,
  getTenantContext,
  HostedDataSource,
  type PostgresConfig,
  setTenantContext,
  type TenantContext,
  withTenantContext,
} from './hosted/index.ts';
// Re-export schema for migrations
export * as hostedSchema from './hosted/schema/index.ts';
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
} from './interfaces.ts';
// Local implementation (SQLite via han-native)
export {
  _resetLocalDataSource,
  getLocalDataSource,
  LocalDataSource,
} from './local/index.ts';
