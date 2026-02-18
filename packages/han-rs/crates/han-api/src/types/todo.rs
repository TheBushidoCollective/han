//! Todo GraphQL types.

use async_graphql::*;
use crate::connection::PageInfo;

/// Todo item from Claude Code's TodoWrite tool.
#[derive(Debug, Clone, SimpleObject)]
pub struct Todo {
    pub id: Option<ID>,
    pub content: Option<String>,
    pub status: Option<crate::types::enums::TodoStatus>,
    pub active_form: Option<String>,
}

/// Todo edge for connections.
#[derive(Debug, Clone, SimpleObject)]
pub struct TodoEdge {
    pub node: Todo,
    pub cursor: String,
}

/// Todo connection with pagination.
#[derive(Debug, Clone, SimpleObject)]
pub struct TodoConnection {
    pub edges: Vec<TodoEdge>,
    pub page_info: PageInfo,
    pub total_count: i32,
}

/// Summary counts of todos by status.
#[derive(Debug, Clone, SimpleObject)]
pub struct TodoCounts {
    pub total: Option<i32>,
    pub pending: Option<i32>,
    pub in_progress: Option<i32>,
    pub completed: Option<i32>,
}

impl Default for TodoCounts {
    fn default() -> Self {
        Self {
            total: Some(0),
            pending: Some(0),
            in_progress: Some(0),
            completed: Some(0),
        }
    }
}

impl Default for TodoConnection {
    fn default() -> Self {
        Self {
            edges: vec![],
            page_info: PageInfo {
                has_next_page: false,
                has_previous_page: false,
                start_cursor: None,
                end_cursor: None,
            },
            total_count: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn todo_counts_default() {
        let tc = TodoCounts::default();
        assert_eq!(tc.total, Some(0));
        assert_eq!(tc.pending, Some(0));
    }

    #[test]
    fn todo_connection_default() {
        let tc = TodoConnection::default();
        assert_eq!(tc.total_count, 0);
        assert!(tc.edges.is_empty());
    }
}
