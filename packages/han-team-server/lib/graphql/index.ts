/**
 * GraphQL Module Index
 *
 * Re-exports all GraphQL-related modules for the Han Team Server.
 *
 * @description This module provides the public API for the GraphQL layer:
 * - `createGraphQLHandler`: Factory function for creating the Yoga handler
 * - `schema`: The executable GraphQL schema
 * - `builder`: The Pothos schema builder (for extending the schema)
 * - Types: All GraphQL type definitions
 */

// Handler factory
export { createGraphQLHandler } from "./handler.ts";
export type { GraphQLHandlerConfig } from "./handler.ts";

// Schema
export { schema } from "./schema.ts";

// Builder and context types
export { builder } from "./builder.ts";
export type { GraphQLContext, UserContext, UserRole } from "./builder.ts";

// All types
export * from "./types/index.ts";
