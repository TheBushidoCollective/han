//! Database migration module using SeaORM migrations.

pub mod m20260215_000001_initial;

use sea_orm_migration::prelude::*;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![Box::new(m20260215_000001_initial::Migration)]
    }
}
