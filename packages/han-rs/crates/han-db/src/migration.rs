//! Database migration module using SeaORM migrations.

pub mod m20260215_000001_initial;
pub mod m20260215_000002_team_entities;

use sea_orm::DatabaseConnection;
use sea_orm_migration::prelude::*;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260215_000001_initial::Migration),
            Box::new(m20260215_000002_team_entities::Migration),
        ]
    }
}

/// Run all pending migrations.
pub async fn run_migrations(db: &DatabaseConnection) -> Result<(), DbErr> {
    Migrator::up(db, None).await
}
