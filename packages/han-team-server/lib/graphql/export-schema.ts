/**
 * Export GraphQL Schema as SDL
 *
 * Outputs the GraphQL schema in SDL (Schema Definition Language) format.
 * This is useful for:
 * - Code generation (e.g., client types)
 * - Schema validation and comparison
 * - Documentation generation
 * - Integration with tools like GraphQL Inspector
 *
 * @description Run this script to print the schema to stdout:
 * ```bash
 * bun run lib/graphql/export-schema.ts > schema.graphql
 * ```
 *
 * The output is lexicographically sorted for consistent diffs.
 */

import { lexicographicSortSchema, printSchema } from "graphql";
import { schema } from "./schema.ts";

// Sort the schema alphabetically for consistent output across runs
const sortedSchema = lexicographicSortSchema(schema);

// Print the schema in SDL format to stdout
console.log(printSchema(sortedSchema));
