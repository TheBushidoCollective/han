//! Session GraphQL type.

use async_graphql::*;
use han_db::entities::messages;
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder};

use crate::connection::PageInfo;
use crate::node::encode_global_id;
use crate::types::messages::{MessageConnection, build_message_connection};
use crate::types::native_task::NativeTask;

/// Session data for GraphQL resolution.
#[derive(Debug, Clone)]
pub struct SessionData {
    pub session_id: String,
    pub project_dir: String,
    pub project_id: Option<String>,
    pub project_name: String,
    pub project_path: String,
    pub date: String,
    pub slug: Option<String>,
    pub summary: Option<String>,
    pub message_count: i32,
    pub started_at: Option<String>,
    pub updated_at: Option<String>,
    pub git_branch: Option<String>,
    pub version: Option<String>,
    pub worktree_name: Option<String>,
    pub source_config_dir: Option<String>,
    pub status: Option<String>,
}

/// Session GraphQL type.
#[Object]
impl SessionData {
    /// Session global ID in format Session:{projectDir}:{sessionId}.
    async fn id(&self) -> ID {
        let composite = if self.project_dir.is_empty() {
            self.session_id.clone()
        } else {
            format!("{}:{}", self.project_dir, self.session_id)
        };
        encode_global_id("Session", &composite)
    }

    /// Session ID.
    async fn session_id(&self) -> &str {
        &self.session_id
    }

    /// Human-readable session name.
    async fn slug(&self) -> Option<&str> {
        self.slug.as_deref()
    }

    /// Display name (slug or sessionId).
    async fn name(&self) -> &str {
        self.slug.as_deref().unwrap_or(&self.session_id)
    }

    /// Session date.
    async fn date(&self) -> &str {
        &self.date
    }

    /// Project name.
    async fn project_name(&self) -> &str {
        &self.project_name
    }

    /// Full project path.
    async fn project_path(&self) -> &str {
        &self.project_path
    }

    /// Canonical project ID for grouping.
    async fn project_id(&self) -> Option<&str> {
        self.project_id.as_deref()
    }

    /// Encoded project directory for URL routing.
    async fn project_slug(&self) -> Option<&str> {
        if self.project_dir.is_empty() {
            None
        } else {
            Some(&self.project_dir)
        }
    }

    /// Worktree name if part of multi-worktree project.
    async fn worktree_name(&self) -> Option<&str> {
        self.worktree_name.as_deref()
    }

    /// First user message as summary.
    async fn summary(&self) -> Option<&str> {
        self.summary.as_deref()
    }

    /// Number of messages.
    async fn message_count(&self) -> i32 {
        self.message_count
    }

    /// Session start time.
    async fn started_at(&self) -> Option<&str> {
        self.started_at.as_deref()
    }

    /// When the session was last updated.
    async fn updated_at(&self) -> Option<&str> {
        self.updated_at.as_deref()
    }

    /// Git branch active during session.
    async fn git_branch(&self) -> Option<&str> {
        self.git_branch.as_deref()
    }

    /// Claude Code version.
    async fn version(&self) -> Option<&str> {
        self.version.as_deref()
    }

    /// Which CLAUDE_CONFIG_DIR this session originated from.
    async fn source_config_dir(&self) -> Option<&str> {
        self.source_config_dir.as_deref()
    }

    /// Paginated messages in this session.
    async fn messages(
        &self,
        ctx: &Context<'_>,
        first: Option<i32>,
        after: Option<String>,
        last: Option<i32>,
        before: Option<String>,
    ) -> Result<MessageConnection> {
        let db = ctx.data::<DatabaseConnection>()?;
        let msgs = messages::Entity::find()
            .filter(messages::Column::SessionId.eq(&self.session_id))
            .order_by_desc(messages::Column::Timestamp)
            .all(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?;

        Ok(build_message_connection(
            &msgs,
            &self.project_dir,
            first,
            after,
            last,
            before,
        ))
    }

    /// Native tasks (Claude Code's built-in task system).
    async fn native_tasks(&self, ctx: &Context<'_>) -> Result<Vec<NativeTask>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let tasks = han_db::entities::native_tasks::Entity::find()
            .filter(han_db::entities::native_tasks::Column::SessionId.eq(&self.session_id))
            .order_by_asc(han_db::entities::native_tasks::Column::CreatedAt)
            .all(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?;

        Ok(tasks.into_iter().map(NativeTask::from).collect())
    }
}

/// Session edge for connections.
#[derive(Debug, Clone, SimpleObject)]
pub struct SessionEdge {
    pub node: SessionData,
    pub cursor: String,
}

/// Session connection with pagination.
#[derive(Debug, Clone, SimpleObject)]
pub struct SessionConnection {
    pub edges: Vec<SessionEdge>,
    pub page_info: PageInfo,
    pub total_count: i32,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_session(id: &str, date: &str) -> SessionData {
        SessionData {
            session_id: id.into(),
            project_dir: "/project".into(),
            project_id: Some("proj-1".into()),
            project_name: "test-project".into(),
            project_path: "/project".into(),
            date: date.into(),
            slug: Some(format!("slug-{id}")),
            summary: Some("test summary".into()),
            message_count: 10,
            started_at: Some("2024-01-01T00:00:00Z".into()),
            updated_at: Some("2024-01-01T01:00:00Z".into()),
            git_branch: Some("main".into()),
            version: Some("1.0.0".into()),
            worktree_name: None,
            source_config_dir: None,
            status: Some("active".into()),
        }
    }

    #[test]
    fn test_build_session_connection_empty() {
        let conn = build_session_connection(vec![], None, None, None, None);
        assert_eq!(conn.total_count, 0);
        assert!(conn.edges.is_empty());
        assert!(!conn.page_info.has_next_page);
        assert!(!conn.page_info.has_previous_page);
    }

    #[test]
    fn test_build_session_connection_all() {
        let sessions: Vec<_> = (0..5).map(|i| make_session(&format!("s{i}"), "2024-01-01")).collect();
        let conn = build_session_connection(sessions, None, None, None, None);
        assert_eq!(conn.total_count, 5);
        assert_eq!(conn.edges.len(), 5);
        assert!(!conn.page_info.has_next_page);
        assert!(!conn.page_info.has_previous_page);
    }

    #[test]
    fn test_build_session_connection_first() {
        let sessions: Vec<_> = (0..5).map(|i| make_session(&format!("s{i}"), "2024-01-01")).collect();
        let conn = build_session_connection(sessions, Some(2), None, None, None);
        assert_eq!(conn.edges.len(), 2);
        assert_eq!(conn.total_count, 5);
        assert!(conn.page_info.has_next_page);
        assert!(!conn.page_info.has_previous_page);
    }

    #[test]
    fn test_build_session_connection_last() {
        let sessions: Vec<_> = (0..5).map(|i| make_session(&format!("s{i}"), "2024-01-01")).collect();
        let conn = build_session_connection(sessions, None, None, Some(2), None);
        assert_eq!(conn.edges.len(), 2);
        assert_eq!(conn.total_count, 5);
        assert!(!conn.page_info.has_next_page);
        assert!(conn.page_info.has_previous_page);
    }

    #[test]
    fn test_build_session_connection_cursors_set() {
        let sessions: Vec<_> = (0..3).map(|i| make_session(&format!("s{i}"), "2024-01-01")).collect();
        let conn = build_session_connection(sessions, None, None, None, None);
        assert!(conn.page_info.start_cursor.is_some());
        assert!(conn.page_info.end_cursor.is_some());
        assert_ne!(conn.page_info.start_cursor, conn.page_info.end_cursor);
    }

    #[test]
    fn test_build_session_connection_after_cursor() {
        let sessions: Vec<_> = (0..5).map(|i| make_session(&format!("s{i}"), "2024-01-01")).collect();
        // Get the cursor of the first edge
        let full = build_session_connection(sessions.clone(), None, None, None, None);
        let after = full.edges[1].cursor.clone();

        let conn = build_session_connection(sessions, None, Some(after), None, None);
        assert_eq!(conn.edges.len(), 3); // s2, s3, s4
    }
}

/// Build a SessionConnection from database models.
pub fn build_session_connection(
    sessions: Vec<SessionData>,
    first: Option<i32>,
    after: Option<String>,
    last: Option<i32>,
    before: Option<String>,
) -> SessionConnection {
    let total_count = sessions.len() as i32;

    let all_edges: Vec<SessionEdge> = sessions
        .into_iter()
        .map(|s| {
            let cursor = crate::node::encode_session_cursor(&s.session_id, &s.date);
            SessionEdge { node: s, cursor }
        })
        .collect();

    // Apply pagination
    let start_idx = if let Some(ref after_cursor) = after {
        all_edges.iter().position(|e| e.cursor == *after_cursor).map(|i| i + 1).unwrap_or(0)
    } else {
        0
    };

    let end_idx = if let Some(ref before_cursor) = before {
        all_edges.iter().position(|e| e.cursor == *before_cursor).unwrap_or(all_edges.len())
    } else {
        all_edges.len()
    };

    let mut slice = &all_edges[start_idx..end_idx];
    let has_previous_page;
    let has_next_page;

    if let Some(f) = first {
        let f = f as usize;
        has_previous_page = start_idx > 0;
        if slice.len() > f {
            slice = &slice[..f];
            has_next_page = true;
        } else {
            has_next_page = end_idx < all_edges.len();
        }
    } else if let Some(l) = last {
        let l = l as usize;
        has_next_page = end_idx < all_edges.len();
        if slice.len() > l {
            slice = &slice[slice.len() - l..];
            has_previous_page = true;
        } else {
            has_previous_page = start_idx > 0;
        }
    } else {
        has_previous_page = start_idx > 0;
        has_next_page = end_idx < all_edges.len();
    }

    let edges: Vec<SessionEdge> = slice.to_vec();
    let start_cursor = edges.first().map(|e| e.cursor.clone());
    let end_cursor = edges.last().map(|e| e.cursor.clone());

    SessionConnection {
        edges,
        page_info: PageInfo {
            has_next_page,
            has_previous_page,
            start_cursor,
            end_cursor,
        },
        total_count,
    }
}
