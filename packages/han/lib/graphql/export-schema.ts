/**
 * Export GraphQL Schema as SDL
 *
 * This script outputs the GraphQL schema in SDL format for use with
 * tools like Relay compiler.
 */

import { lexicographicSortSchema, printSchema } from "graphql";
import { schema } from "./schema.ts";

// Sort the schema alphabetically for consistent output
const sortedSchema = lexicographicSortSchema(schema);

// Print the schema in SDL format
console.log(printSchema(sortedSchema));
