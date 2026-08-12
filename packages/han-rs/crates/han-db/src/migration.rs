//! Database migration module using SeaORM migrations.

pub mod m20260215_000001_initial;
pub mod m20260215_000002_team_entities;
pub mod m20260220_add_session_pr_team;
pub mod m20260222_tool_call_results;
pub mod m20260223_performance_indexes;
pub mod m20260401_human_time_estimation;
pub mod m20260812_session_harness;

use sea_orm::DatabaseConnection;
use sea_orm_migration::prelude::*;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260215_000001_initial::Migration),
            Box::new(m20260215_000002_team_entities::Migration),
            Box::new(m20260220_add_session_pr_team::Migration),
            Box::new(m20260222_tool_call_results::Migration),
            Box::new(m20260223_performance_indexes::Migration),
            Box::new(m20260401_human_time_estimation::Migration),
            Box::new(m20260812_session_harness::Migration),
        ]
    }
}

/// Run all pending migrations.
pub async fn run_migrations(db: &DatabaseConnection) -> Result<(), DbErr> {
    Migrator::up(db, None).await
}
