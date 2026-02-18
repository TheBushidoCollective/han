//! Message search result GraphQL types.

use async_graphql::*;

/// A search result matching a message in a session.
#[derive(Debug, Clone, SimpleObject)]
pub struct MessageSearchResult {
    pub message_id: Option<String>,
    pub message_index: Option<i32>,
    pub preview: Option<String>,
    pub match_context: Option<String>,
}
