//! Han database layer with SeaORM
//!
//! Provides a dual-database abstraction supporting both SQLite and PostgreSQL
//! through SeaORM entities, migrations, and CRUD operations.

pub mod entities;
pub mod error;
pub mod connection;
pub mod search;
pub mod crud;
pub mod migration;
pub mod aggregates;

pub use connection::{DbConfig, establish_connection};
pub use error::DbError;
