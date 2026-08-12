//! Migration: Create tool_call_results table.
//!
//! Pre-computed index of tool result data extracted during JSONL indexing.
//! Replaces the expensive LIKE-on-raw_json DataLoader with O(1) PK lookups.

use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(ToolCallResults::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(ToolCallResults::ToolCallId)
                            .string()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(ToolCallResults::SessionId)
                            .string()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(ToolCallResults::MessageId)
                            .string()
                            .not_null(),
                    )
                    .col(ColumnDef::new(ToolCallResults::Content).text().not_null())
                    .col(
                        ColumnDef::new(ToolCallResults::IsError)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .col(
                        ColumnDef::new(ToolCallResults::HasImage)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_tool_call_results_session_id")
                    .table(ToolCallResults::Table)
                    .col(ToolCallResults::SessionId)
                    .to_owned(),
            )
            .await?;

        // Force re-index of all sessions so tool_call_results gets populated
        let db = manager.get_connection();
        db.execute_unprepared("UPDATE sessions SET last_indexed_line = 0")
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(ToolCallResults::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum ToolCallResults {
    Table,
    ToolCallId,
    SessionId,
    MessageId,
    Content,
    IsError,
    HasImage,
}
