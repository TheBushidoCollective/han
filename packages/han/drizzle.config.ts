/**
 * Drizzle Kit Configuration
 *
 * Used for generating and running PostgreSQL migrations.
 *
 * Usage:
 *   npx drizzle-kit generate  # Generate migration files
 *   npx drizzle-kit push      # Push changes directly (dev only)
 *   npx drizzle-kit studio    # Open Drizzle Studio UI
 */

import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./lib/data/hosted/schema/index.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		host: process.env.POSTGRES_HOST ?? "localhost",
		port: Number.parseInt(process.env.POSTGRES_PORT ?? "5432", 10),
		user: process.env.POSTGRES_USER ?? "postgres",
		password: process.env.POSTGRES_PASSWORD ?? "",
		database: process.env.POSTGRES_DB ?? "han",
		ssl: process.env.POSTGRES_SSL === "true",
	},
	verbose: true,
	strict: true,
});
