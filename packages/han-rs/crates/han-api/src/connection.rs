//! Generic Relay Connection types for cursor-based pagination.
//!
//! Provides `Connection<T>`, `Edge<T>`, and `PageInfo` that work with
//! any async-graphql `OutputType`.

use async_graphql::*;

/// Relay PageInfo for pagination metadata.
#[derive(Debug, Clone, SimpleObject)]
pub struct PageInfo {
    /// Whether there are more items after the last edge.
    pub has_next_page: bool,
    /// Whether there are more items before the first edge.
    pub has_previous_page: bool,
    /// Cursor of the first edge.
    pub start_cursor: Option<String>,
    /// Cursor of the last edge.
    pub end_cursor: Option<String>,
}

/// A generic edge in a connection.
#[derive(Debug, Clone)]
pub struct Edge<T: Send + Sync> {
    /// The item at this edge.
    pub node: T,
    /// Cursor for this edge.
    pub cursor: String,
}

#[Object]
impl<T: OutputType + Send + Sync> Edge<T> {
    /// The item at this edge.
    async fn node(&self) -> &T {
        &self.node
    }

    /// Cursor for this edge.
    async fn cursor(&self) -> &str {
        &self.cursor
    }
}

/// A generic Relay connection with edges and page info.
#[derive(Debug, Clone)]
pub struct Connection<T: Send + Sync> {
    /// List of edges.
    pub edges: Vec<Edge<T>>,
    /// Pagination information.
    pub page_info: PageInfo,
    /// Total number of items matching the query.
    pub total_count: i32,
}

#[Object]
impl<T: OutputType + Send + Sync> Connection<T> {
    /// List of edges in this connection.
    async fn edges(&self) -> &[Edge<T>] {
        &self.edges
    }

    /// Pagination information.
    async fn page_info(&self) -> &PageInfo {
        &self.page_info
    }

    /// Total number of items matching the query.
    async fn total_count(&self) -> i32 {
        self.total_count
    }
}

/// Pagination arguments for cursor-based connections.
#[derive(Debug, Clone, Default, InputObject)]
pub struct ConnectionArgs {
    /// Number of items to fetch from the start.
    pub first: Option<i32>,
    /// Cursor to fetch items after.
    pub after: Option<String>,
    /// Number of items to fetch from the end.
    pub last: Option<i32>,
    /// Cursor to fetch items before.
    pub before: Option<String>,
}

/// Apply cursor-based pagination to a slice of items.
///
/// The `cursor_fn` generates a cursor string for each item.
/// Items should already be in the desired sort order.
pub fn apply_connection_args<T: Clone + Send + Sync>(
    items: &[T],
    args: &ConnectionArgs,
    cursor_fn: impl Fn(&T) -> String,
) -> Connection<T> {
    let total_count = items.len() as i32;

    if items.is_empty() {
        return Connection {
            edges: vec![],
            page_info: PageInfo {
                has_next_page: false,
                has_previous_page: false,
                start_cursor: None,
                end_cursor: None,
            },
            total_count: 0,
        };
    }

    // Build edges with cursors
    let all_edges: Vec<Edge<T>> = items
        .iter()
        .map(|item| Edge {
            cursor: cursor_fn(item),
            node: item.clone(),
        })
        .collect();

    // Apply after cursor
    let start_idx = if let Some(ref after) = args.after {
        all_edges
            .iter()
            .position(|e| e.cursor == *after)
            .map(|i| i + 1)
            .unwrap_or(0)
    } else {
        0
    };

    // Apply before cursor
    let end_idx = if let Some(ref before) = args.before {
        all_edges
            .iter()
            .position(|e| e.cursor == *before)
            .unwrap_or(all_edges.len())
    } else {
        all_edges.len()
    };

    let mut slice = &all_edges[start_idx..end_idx];

    // Apply first/last
    let has_previous_page;
    let has_next_page;

    if let Some(first) = args.first {
        let first = first as usize;
        has_previous_page = start_idx > 0;
        if slice.len() > first {
            slice = &slice[..first];
            has_next_page = true;
        } else {
            has_next_page = end_idx < all_edges.len();
        }
    } else if let Some(last) = args.last {
        let last = last as usize;
        has_next_page = end_idx < all_edges.len();
        if slice.len() > last {
            slice = &slice[slice.len() - last..];
            has_previous_page = true;
        } else {
            has_previous_page = start_idx > 0;
        }
    } else {
        has_previous_page = start_idx > 0;
        has_next_page = end_idx < all_edges.len();
    }

    let edges: Vec<Edge<T>> = slice.to_vec();
    let start_cursor = edges.first().map(|e| e.cursor.clone());
    let end_cursor = edges.last().map(|e| e.cursor.clone());

    Connection {
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

// Clone is derived via #[derive(Clone)] on Edge<T> above

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_connection() {
        let items: Vec<String> = vec![];
        let args = ConnectionArgs::default();
        let conn = apply_connection_args(&items, &args, |s| s.clone());
        assert_eq!(conn.total_count, 0);
        assert!(conn.edges.is_empty());
        assert!(!conn.page_info.has_next_page);
        assert!(!conn.page_info.has_previous_page);
    }

    #[test]
    fn test_first_pagination() {
        let items: Vec<String> = (0..10).map(|i| format!("item{i}")).collect();
        let args = ConnectionArgs {
            first: Some(3),
            ..Default::default()
        };
        let conn = apply_connection_args(&items, &args, |s| s.clone());
        assert_eq!(conn.total_count, 10);
        assert_eq!(conn.edges.len(), 3);
        assert_eq!(conn.edges[0].node, "item0");
        assert!(conn.page_info.has_next_page);
        assert!(!conn.page_info.has_previous_page);
    }

    #[test]
    fn test_after_cursor() {
        let items: Vec<String> = (0..5).map(|i| format!("item{i}")).collect();
        let args = ConnectionArgs {
            first: Some(2),
            after: Some("item1".to_string()),
            ..Default::default()
        };
        let conn = apply_connection_args(&items, &args, |s| s.clone());
        assert_eq!(conn.edges.len(), 2);
        assert_eq!(conn.edges[0].node, "item2");
        assert_eq!(conn.edges[1].node, "item3");
    }
}
