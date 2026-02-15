//! Hasura-style filter types for GraphQL queries.
//!
//! Provides composable filter inputs that translate to SQL WHERE clauses.

use async_graphql::*;

/// String comparison filter (Hasura-style).
#[derive(Debug, Clone, Default, InputObject)]
pub struct StringFilter {
    /// Exact match.
    #[graphql(name = "_eq")]
    pub eq: Option<String>,
    /// Not equal.
    #[graphql(name = "_neq")]
    pub neq: Option<String>,
    /// In list.
    #[graphql(name = "_in")]
    pub r#in: Option<Vec<String>>,
    /// Not in list.
    #[graphql(name = "_nin")]
    pub nin: Option<Vec<String>>,
    /// LIKE pattern.
    #[graphql(name = "_like")]
    pub like: Option<String>,
    /// NOT LIKE pattern.
    #[graphql(name = "_nlike")]
    pub nlike: Option<String>,
    /// ILIKE pattern (case-insensitive).
    #[graphql(name = "_ilike")]
    pub ilike: Option<String>,
    /// Is null.
    #[graphql(name = "_is_null")]
    pub is_null: Option<bool>,
}

/// Integer comparison filter (Hasura-style).
#[derive(Debug, Clone, Default, InputObject)]
pub struct IntFilter {
    /// Exact match.
    #[graphql(name = "_eq")]
    pub eq: Option<i32>,
    /// Not equal.
    #[graphql(name = "_neq")]
    pub neq: Option<i32>,
    /// Greater than.
    #[graphql(name = "_gt")]
    pub gt: Option<i32>,
    /// Greater than or equal.
    #[graphql(name = "_gte")]
    pub gte: Option<i32>,
    /// Less than.
    #[graphql(name = "_lt")]
    pub lt: Option<i32>,
    /// Less than or equal.
    #[graphql(name = "_lte")]
    pub lte: Option<i32>,
    /// In list.
    #[graphql(name = "_in")]
    pub r#in: Option<Vec<i32>>,
    /// Is null.
    #[graphql(name = "_is_null")]
    pub is_null: Option<bool>,
}

/// DateTime comparison filter (Hasura-style).
#[derive(Debug, Clone, Default, InputObject)]
pub struct DateTimeFilter {
    /// Exact match.
    #[graphql(name = "_eq")]
    pub eq: Option<String>,
    /// Not equal.
    #[graphql(name = "_neq")]
    pub neq: Option<String>,
    /// Greater than.
    #[graphql(name = "_gt")]
    pub gt: Option<String>,
    /// Greater than or equal.
    #[graphql(name = "_gte")]
    pub gte: Option<String>,
    /// Less than.
    #[graphql(name = "_lt")]
    pub lt: Option<String>,
    /// Less than or equal.
    #[graphql(name = "_lte")]
    pub lte: Option<String>,
    /// Is null.
    #[graphql(name = "_is_null")]
    pub is_null: Option<bool>,
}

/// Boolean comparison filter (Hasura-style).
#[derive(Debug, Clone, Default, InputObject)]
pub struct BoolFilter {
    /// Exact match.
    #[graphql(name = "_eq")]
    pub eq: Option<bool>,
}

/// Filter for sessions query.
#[derive(Debug, Clone, Default, InputObject)]
pub struct SessionFilter {
    /// Filter by session ID.
    pub session_id: Option<StringFilter>,
    /// Filter by project ID.
    pub project_id: Option<StringFilter>,
    /// Filter by date.
    pub date: Option<DateTimeFilter>,
    /// Filter by status.
    pub status: Option<StringFilter>,
    /// Logical AND combination.
    #[graphql(name = "_and")]
    pub and: Option<Vec<SessionFilter>>,
    /// Logical OR combination.
    #[graphql(name = "_or")]
    pub or: Option<Vec<SessionFilter>>,
}

/// Filter for messages query.
#[derive(Debug, Clone, Default, InputObject)]
pub struct MessageFilter {
    /// Filter by message type.
    pub message_type: Option<StringFilter>,
    /// Filter by tool name.
    pub tool_name: Option<StringFilter>,
    /// Filter by agent ID.
    pub agent_id: Option<StringFilter>,
    /// Logical AND combination.
    #[graphql(name = "_and")]
    pub and: Option<Vec<MessageFilter>>,
    /// Logical OR combination.
    #[graphql(name = "_or")]
    pub or: Option<Vec<MessageFilter>>,
}

/// Filter for hook executions.
#[derive(Debug, Clone, Default, InputObject)]
pub struct HookExecutionFilter {
    /// Filter by hook type.
    pub hook_type: Option<StringFilter>,
    /// Filter by hook name.
    pub hook_name: Option<StringFilter>,
    /// Filter by passed status.
    pub passed: Option<BoolFilter>,
    /// Filter by duration.
    pub duration_ms: Option<IntFilter>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_string_filter_default() {
        let f = StringFilter::default();
        assert!(f.eq.is_none());
        assert!(f.neq.is_none());
        assert!(f.r#in.is_none());
        assert!(f.like.is_none());
        assert!(f.is_null.is_none());
    }

    #[test]
    fn test_int_filter_default() {
        let f = IntFilter::default();
        assert!(f.eq.is_none());
        assert!(f.gt.is_none());
        assert!(f.lt.is_none());
    }

    #[test]
    fn test_datetime_filter_default() {
        let f = DateTimeFilter::default();
        assert!(f.eq.is_none());
        assert!(f.gt.is_none());
        assert!(f.lte.is_none());
    }

    #[test]
    fn test_bool_filter_default() {
        let f = BoolFilter::default();
        assert!(f.eq.is_none());
    }

    #[test]
    fn test_session_filter_default() {
        let f = SessionFilter::default();
        assert!(f.session_id.is_none());
        assert!(f.project_id.is_none());
        assert!(f.and.is_none());
        assert!(f.or.is_none());
    }

    #[test]
    fn test_message_filter_default() {
        let f = MessageFilter::default();
        assert!(f.message_type.is_none());
        assert!(f.tool_name.is_none());
    }

    #[test]
    fn test_hook_execution_filter_default() {
        let f = HookExecutionFilter::default();
        assert!(f.hook_type.is_none());
        assert!(f.passed.is_none());
    }

    #[test]
    fn test_string_filter_construction() {
        let f = StringFilter {
            eq: Some("test".into()),
            r#in: Some(vec!["a".into(), "b".into()]),
            like: Some("%pattern%".into()),
            ..Default::default()
        };
        assert_eq!(f.eq.unwrap(), "test");
        assert_eq!(f.r#in.unwrap().len(), 2);
        assert_eq!(f.like.unwrap(), "%pattern%");
    }

    #[test]
    fn test_int_filter_construction() {
        let f = IntFilter {
            gt: Some(10),
            lte: Some(100),
            ..Default::default()
        };
        assert_eq!(f.gt.unwrap(), 10);
        assert_eq!(f.lte.unwrap(), 100);
    }

    #[test]
    fn test_session_filter_nested() {
        let f = SessionFilter {
            and: Some(vec![
                SessionFilter {
                    project_id: Some(StringFilter {
                        eq: Some("proj-1".into()),
                        ..Default::default()
                    }),
                    ..Default::default()
                },
                SessionFilter {
                    status: Some(StringFilter {
                        eq: Some("active".into()),
                        ..Default::default()
                    }),
                    ..Default::default()
                },
            ]),
            ..Default::default()
        };
        assert_eq!(f.and.unwrap().len(), 2);
    }
}
