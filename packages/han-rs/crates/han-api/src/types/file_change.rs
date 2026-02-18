//! File change GraphQL types.

use async_graphql::*;
use crate::connection::PageInfo;

/// A file change recorded during a session.
#[derive(Debug, Clone, SimpleObject)]
pub struct FileChange {
    pub id: Option<String>,
    pub file_path: Option<String>,
    pub action: Option<crate::types::enums::FileChangeAction>,
    pub tool_name: Option<String>,
    pub recorded_at: Option<String>,
    pub session_id: Option<String>,
    pub is_validated: Option<bool>,
    pub file_hash_before: Option<String>,
    pub file_hash_after: Option<String>,
    pub validations: Option<Vec<FileValidation>>,
    pub missing_validations: Option<Vec<FileValidation>>,
}

/// File validation record.
#[derive(Debug, Clone, SimpleObject)]
pub struct FileValidation {
    pub id: Option<String>,
    pub plugin_name: Option<String>,
    pub hook_name: Option<String>,
    pub validated_at: Option<String>,
    pub directory: Option<String>,
}

/// File change edge.
#[derive(Debug, Clone, SimpleObject)]
pub struct FileChangeEdge {
    pub node: FileChange,
    pub cursor: String,
}

/// File change connection.
#[derive(Debug, Clone, SimpleObject)]
pub struct FileChangeConnection {
    pub edges: Vec<FileChangeEdge>,
    pub page_info: PageInfo,
    pub total_count: i32,
}

impl Default for FileChangeConnection {
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
    fn file_change_connection_default() {
        let fc = FileChangeConnection::default();
        assert_eq!(fc.total_count, 0);
        assert!(fc.edges.is_empty());
    }
}
