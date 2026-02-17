//! Han JSONL transcript indexer and file watcher
//!
//! This crate provides the indexing pipeline that reads Claude Code JSONL
//! transcript files and populates the database via `han-db`. It also includes
//! a file system watcher for incremental indexing.
//!
//! # Modules
//!
//! - [`parser`] - Memory-mapped JSONL line reading
//! - [`sentiment`] - VADER sentiment analysis with frustration detection
//! - [`task_timeline`] - Task time range lookup for associating messages with tasks
//! - [`processor`] - Main indexing pipeline (JSONL → database)
//! - [`watcher`] - File system watcher for incremental indexing
//! - [`types`] - Shared types used across modules

pub mod parser;
pub mod processor;
pub mod sentiment;
pub mod task_timeline;
pub mod types;
pub mod watcher;

// Re-export primary public API
pub use parser::{jsonl_count_lines, jsonl_read_page, jsonl_read_reverse, JsonlLine, PaginatedResult};
pub use processor::{
    full_scan_and_index, handle_file_event, index_project_directory, index_session_file,
};
pub use sentiment::{analyze_sentiment, FrustrationLevel, SentimentLevel, SentimentResult};
pub use task_timeline::{TaskTimeRange, TaskTimeline};
pub use types::{FileEventType, IndexResult, MessageType, SessionFileType};
pub use watcher::{FileEvent, WatcherService};
