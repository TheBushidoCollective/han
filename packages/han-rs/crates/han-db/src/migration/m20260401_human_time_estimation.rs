//! Migration: Add human_time_ms to messages and indexer_version to han_metadata.
//!
//! - `human_time_ms` stores per-message human-equivalent time in milliseconds
//! - `indexer_version` in han_metadata enables auto-reindex when estimation logic changes
//! - Resets last_indexed_line on all sessions and session_files to force re-indexing

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Add human_time_ms column to messages
        manager
            .alter_table(
                Table::alter()
                    .table(Messages::Table)
                    .add_column(ColumnDef::new(Messages::HumanTimeMs).integer().null())
                    .to_owned(),
            )
            .await?;

        // Force full re-index so human_time_ms gets populated for existing messages
        let db = manager.get_connection();
        db.execute_unprepared("UPDATE sessions SET last_indexed_line = 0")
            .await?;
        db.execute_unprepared("UPDATE session_files SET last_indexed_line = 0")
            .await?;

        // Seed indexer_version in han_metadata (used for future reindex triggers).
        // SQLite and Postgres spell the upsert and the UTC timestamp differently.
        // updated_at is a string column, so both forms store "YYYY-MM-DD HH:MM:SS" UTC.
        let seed_sql = match db.get_database_backend() {
            sea_orm::DatabaseBackend::Sqlite => {
                "INSERT OR REPLACE INTO han_metadata (key, value, updated_at) \
                 VALUES ('indexer_version', '1', datetime('now'))"
            }
            _ => {
                "INSERT INTO han_metadata (key, value, updated_at) \
                 VALUES ('indexer_version', '1', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')) \
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at"
            }
        };
        db.execute_unprepared(seed_sql).await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Remove indexer_version
        let db = manager.get_connection();
        db.execute_unprepared("DELETE FROM han_metadata WHERE key = 'indexer_version'")
            .await?;

        // SQLite 3.35+ supports ALTER TABLE DROP COLUMN
        manager
            .alter_table(
                Table::alter()
                    .table(Messages::Table)
                    .drop_column(Messages::HumanTimeMs)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}

#[derive(DeriveIden)]
enum Messages {
    Table,
    HumanTimeMs,
}
