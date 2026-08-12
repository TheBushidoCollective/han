//! Migration: Create the pre-aggregated dashboard tables.
//!
//! `han-indexer` writes `daily_aggregates`, `hourly_aggregates` and
//! `global_aggregates` after every index pass, and `han-api` reads them for the
//! unscoped dashboard queries. No migration ever created them, so the writes
//! failed (their errors were discarded) and the reads failed with
//! "no such table: daily_aggregates". That left the Activity, Code Changes,
//! Model Usage and Time of Day panels loading forever.
//!
//! Column names and types match the writer in `processor.rs::update_aggregates`
//! and every reader in `query.rs`. `date`, `hour` and `id` are primary keys
//! because the writer relies on `INSERT OR REPLACE` collapsing onto them.
//!
//! Creating the tables is all this migration does. Backfilling them from
//! `messages` takes roughly 45 seconds on a database of ~900k rows, long enough
//! to blow the coordinator's startup health budget, so
//! `han_indexer::backfill_aggregates_if_empty` fills them in the background once
//! the server is listening.

use sea_orm::Statement;
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();

        db.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS daily_aggregates (
                date TEXT NOT NULL PRIMARY KEY,
                session_count INTEGER NOT NULL DEFAULT 0,
                message_count INTEGER NOT NULL DEFAULT 0,
                input_tokens INTEGER NOT NULL DEFAULT 0,
                output_tokens INTEGER NOT NULL DEFAULT 0,
                cache_read_tokens INTEGER NOT NULL DEFAULT 0,
                lines_added INTEGER NOT NULL DEFAULT 0,
                lines_removed INTEGER NOT NULL DEFAULT 0,
                files_changed INTEGER NOT NULL DEFAULT 0
            )",
        )
        .await?;

        db.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS hourly_aggregates (
                hour INTEGER NOT NULL PRIMARY KEY,
                session_count INTEGER NOT NULL DEFAULT 0,
                message_count INTEGER NOT NULL DEFAULT 0,
                input_tokens INTEGER NOT NULL DEFAULT 0,
                output_tokens INTEGER NOT NULL DEFAULT 0,
                cache_read_tokens INTEGER NOT NULL DEFAULT 0
            )",
        )
        .await?;

        db.execute_unprepared(
            "CREATE TABLE IF NOT EXISTS global_aggregates (
                id INTEGER NOT NULL PRIMARY KEY,
                total_sessions INTEGER NOT NULL DEFAULT 0,
                total_messages INTEGER NOT NULL DEFAULT 0,
                total_input_tokens INTEGER NOT NULL DEFAULT 0,
                total_output_tokens INTEGER NOT NULL DEFAULT 0,
                total_cache_read_tokens INTEGER NOT NULL DEFAULT 0,
                total_tasks INTEGER NOT NULL DEFAULT 0,
                total_completed_tasks INTEGER NOT NULL DEFAULT 0,
                last_updated TEXT
            )",
        )
        .await?;

        // Legacy databases were created by hand-written SQL before the SeaORM
        // migrations existed, and `m20260215_000001_initial` was recorded as
        // applied without ever running. Those `messages` tables are missing the
        // three change-tracking columns the entity declares and every activity
        // query sums, so add them when absent. Historical rows stay NULL, which
        // reads as 0; the indexer populates them going forward.
        let existing: Vec<String> = db
            .query_all(Statement::from_string(
                manager.get_database_backend(),
                "SELECT name FROM pragma_table_info('messages')".to_string(),
            ))
            .await?
            .into_iter()
            .filter_map(|row| row.try_get_by_index::<String>(0).ok())
            .collect();

        for column in ["lines_added", "lines_removed", "files_changed"] {
            if !existing.iter().any(|name| name == column) {
                db.execute_unprepared(&format!("ALTER TABLE messages ADD COLUMN {column} INTEGER"))
                    .await?;
            }
        }

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        db.execute_unprepared("DROP TABLE IF EXISTS global_aggregates")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS hourly_aggregates")
            .await?;
        db.execute_unprepared("DROP TABLE IF EXISTS daily_aggregates")
            .await?;
        Ok(())
    }
}
