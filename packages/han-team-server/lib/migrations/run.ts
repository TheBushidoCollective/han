/**
 * Database Migration Runner for Han Team Platform
 *
 * Runs SQL migrations in order, tracking applied migrations
 * in a _migrations table.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const { Pool } = pg;

interface Migration {
  name: string;
  path: string;
  version: number;
}

/**
 * Run all pending migrations
 */
async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Ensure migrations table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        version INTEGER NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get already applied migrations
    const { rows: applied } = await pool.query(
      "SELECT name FROM _migrations ORDER BY version"
    );
    const appliedNames = new Set(applied.map((r) => r.name));

    // Find migration files
    const migrationsDir = join(import.meta.dirname, "../../migrations");
    const files = await readdir(migrationsDir).catch(() => []);

    // Parse and sort migrations
    const migrations: Migration[] = files
      .filter((f) => f.endsWith(".sql") && /^\d+_/.test(f))
      .map((f) => ({
        name: f.replace(".sql", ""),
        path: join(migrationsDir, f),
        version: parseInt(f.split("_")[0], 10),
      }))
      .sort((a, b) => a.version - b.version);

    // Find pending migrations
    const pending = migrations.filter((m) => !appliedNames.has(m.name));

    if (pending.length === 0) {
      console.log("No pending migrations");
      return;
    }

    console.log(`Found ${pending.length} pending migration(s)`);

    // Run each migration in a transaction
    for (const migration of pending) {
      console.log(`Applying migration: ${migration.name}`);

      const sql = await readFile(migration.path, "utf-8");
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // Run the migration SQL
        await client.query(sql);

        // Record the migration
        await client.query(
          "INSERT INTO _migrations (name, version) VALUES ($1, $2)",
          [migration.name, migration.version]
        );

        await client.query("COMMIT");
        console.log(`  Applied: ${migration.name}`);
      } catch (error) {
        await client.query("ROLLBACK");
        console.error(`  Failed: ${migration.name}`);
        throw error;
      } finally {
        client.release();
      }
    }

    console.log("All migrations applied successfully");
  } finally {
    await pool.end();
  }
}

// Run if called directly
runMigrations().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
