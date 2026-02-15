//! Memory-related GraphQL types.

use async_graphql::*;
use crate::types::enums::{Confidence, MemoryAgentProgressType};

/// Memory query type (namespace for memory operations).
#[derive(Debug, Clone, SimpleObject)]
pub struct MemoryQuery {
    /// Placeholder - actual memory search is done via dedicated fields.
    pub placeholder: Option<bool>,
}

/// Memory search result.
#[derive(Debug, Clone, SimpleObject)]
pub struct MemorySearchResult {
    pub content: String,
    pub path: String,
    pub score: f64,
    pub domain: Option<String>,
}

/// Memory agent progress update.
#[derive(Debug, Clone, SimpleObject)]
pub struct MemoryAgentProgress {
    pub session_id: String,
    #[graphql(name = "type")]
    pub progress_type: MemoryAgentProgressType,
    pub layer: Option<String>,
    pub content: String,
    pub result_count: Option<i32>,
    pub timestamp: f64,
}

/// Memory agent final result.
#[derive(Debug, Clone, SimpleObject)]
pub struct MemoryAgentResult {
    pub session_id: String,
    pub answer: String,
    pub confidence: Confidence,
    pub citations: Vec<Citation>,
    pub searched_layers: Vec<String>,
    pub success: bool,
    pub error: Option<String>,
}

/// Citation in memory agent results.
#[derive(Debug, Clone, SimpleObject)]
pub struct Citation {
    pub source: String,
    pub excerpt: String,
    pub author: Option<String>,
    pub timestamp: Option<f64>,
    pub browse_url: Option<String>,
}
