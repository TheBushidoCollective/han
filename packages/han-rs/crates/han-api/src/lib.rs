//! Han GraphQL API layer
//!
//! Provides async-graphql schema with Relay connections, DataLoaders,
//! Hasura-style filters, and subscriptions. Shared by coordinator (SQLite)
//! and server (PostgreSQL).

pub mod connection;
pub mod context;
pub mod filters;
pub mod loaders;
pub mod mutation;
pub mod node;
pub mod query;
pub mod schema;
pub mod subscription;
pub mod types;

pub use context::GraphQLContext;
pub use schema::{build_schema, HanSchema};
