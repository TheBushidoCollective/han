//! Han database layer with SeaORM
//!
//! Provides a dual-database abstraction supporting both SQLite and PostgreSQL
//! through SeaORM entities, migrations, and CRUD operations.

pub mod aggregates;
pub mod connection;
pub mod crud;
pub mod entities;
pub mod error;
pub mod migration;
pub mod search;

pub use connection::{establish_connection, DbConfig};
pub use error::DbError;
