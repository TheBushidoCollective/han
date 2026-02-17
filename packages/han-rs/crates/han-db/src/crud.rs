//! CRUD operations for Han's database layer (SeaORM).
//!
//! Provides async database operations for all entities.

pub mod repos;
pub mod projects;
pub mod sessions;
pub mod config_dirs;
pub mod session_files;
pub mod session_summaries;
pub mod session_compacts;
pub mod session_todos;
pub mod generated_summaries;
pub mod native_tasks;
pub mod messages;
pub mod tasks;
pub mod hooks;
pub mod frustration;
pub mod file_changes;
pub mod file_validations;
pub mod orchestrations;
pub mod async_hooks;
