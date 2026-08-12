//! Migration: Add the harness dimension to sessions.
//!
//! han indexes sessions from more than one coding agent. Until now every
//! session row was implicitly Claude Code, so there was no way to tell a
//! Claude Code session apart from one bridged from omp, OpenCode, Gemini CLI,
//! Kiro, Codex, or Antigravity.
//!
//! New column: harness
//! New index: idx_sessions_harness
//!
//! Existing rows are backfilled to `claude-code`, since Claude Code was the
//! only harness han could index before this. The column stays nullable so a
//! writer may omit it, but no row is left NULL: a filter on the raw column and
//! a read through the API must agree, and leaving legacy rows NULL would mean
//! `harness = 'claude-code'` silently skipped every session recorded before
//! today.

use crate::entities::sessions::DEFAULT_HARNESS;
use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Sessions::Table)
                    .add_column(ColumnDef::new(Sessions::Harness).string().null())
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_sessions_harness")
                    .table(Sessions::Table)
                    .col(Sessions::Harness)
                    .to_owned(),
            )
            .await?;

        // Backfill. Every pre-existing session came from Claude Code.
        manager
            .exec_stmt(
                Query::update()
                    .table(Sessions::Table)
                    .value(Sessions::Harness, DEFAULT_HARNESS)
                    .and_where(Expr::col(Sessions::Harness).is_null())
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_index(
                Index::drop()
                    .name("idx_sessions_harness")
                    .table(Sessions::Table)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Sessions::Table)
                    .drop_column(Sessions::Harness)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}

#[derive(DeriveIden)]
enum Sessions {
    Table,
    Harness,
}
