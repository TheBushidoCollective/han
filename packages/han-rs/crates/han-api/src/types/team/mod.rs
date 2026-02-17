//! Team GraphQL types (for hosted mode).

use async_graphql::*;
use crate::node::encode_global_id;

/// User data (hosted mode).
#[derive(Debug, Clone)]
pub struct User {
    pub user_id: String,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub role: String,
}

#[Object]
impl User {
    async fn id(&self) -> ID { encode_global_id("User", &self.user_id) }
    async fn display_name(&self) -> Option<&str> { self.display_name.as_deref() }
    async fn email(&self) -> Option<&str> { self.email.as_deref() }
    async fn role(&self) -> &str { &self.role }
}

/// Organization data (hosted mode).
#[derive(Debug, Clone)]
pub struct Org {
    pub org_id: String,
    pub name: String,
    pub slug: Option<String>,
}

#[Object]
impl Org {
    async fn id(&self) -> ID { encode_global_id("Org", &self.org_id) }
    async fn name(&self) -> &str { &self.name }
    async fn slug(&self) -> Option<&str> { self.slug.as_deref() }
}

/// Team member data (hosted mode).
#[derive(Debug, Clone)]
pub struct TeamMember {
    pub user_id: String,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub role: String,
    pub joined_at: Option<String>,
}

#[Object]
impl TeamMember {
    async fn id(&self) -> ID { encode_global_id("TeamMember", &self.user_id) }
    async fn display_name(&self) -> Option<&str> { self.display_name.as_deref() }
    async fn email(&self) -> Option<&str> { self.email.as_deref() }
    async fn role(&self) -> &str { &self.role }
    async fn joined_at(&self) -> Option<&str> { self.joined_at.as_deref() }
}

/// Team metrics data.
#[derive(Debug, Clone, SimpleObject)]
pub struct TeamMetrics {
    pub total_sessions: i32,
    pub total_messages: i32,
    pub active_users: i32,
    pub avg_session_duration_secs: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::node::encode_global_id;

    #[test]
    fn user_construction_all_fields() {
        let u = User {
            user_id: "u-1".into(),
            display_name: Some("Alice".into()),
            email: Some("alice@example.com".into()),
            role: "admin".into(),
        };
        assert_eq!(u.user_id, "u-1");
        assert_eq!(u.display_name, Some("Alice".into()));
        assert_eq!(u.email, Some("alice@example.com".into()));
        assert_eq!(u.role, "admin");
    }

    #[test]
    fn user_construction_optional_none() {
        let u = User {
            user_id: "u-2".into(),
            display_name: None,
            email: None,
            role: "member".into(),
        };
        assert!(u.display_name.is_none());
        assert!(u.email.is_none());
    }

    #[test]
    fn user_global_id_format() {
        let id = encode_global_id("User", "u-1");
        assert_eq!(id.as_str(), "User:u-1");
    }

    #[test]
    fn user_clone() {
        let u = User {
            user_id: "u-1".into(),
            display_name: Some("Bob".into()),
            email: Some("bob@example.com".into()),
            role: "member".into(),
        };
        let u2 = u.clone();
        assert_eq!(u.user_id, u2.user_id);
        assert_eq!(u.display_name, u2.display_name);
    }

    #[test]
    fn user_debug() {
        let u = User {
            user_id: "u-1".into(),
            display_name: Some("Alice".into()),
            email: None,
            role: "admin".into(),
        };
        let debug = format!("{:?}", u);
        assert!(debug.contains("User"));
        assert!(debug.contains("u-1"));
    }

    #[test]
    fn org_construction_all_fields() {
        let o = Org {
            org_id: "org-1".into(),
            name: "Test Org".into(),
            slug: Some("test-org".into()),
        };
        assert_eq!(o.org_id, "org-1");
        assert_eq!(o.name, "Test Org");
        assert_eq!(o.slug, Some("test-org".into()));
    }

    #[test]
    fn org_construction_slug_none() {
        let o = Org {
            org_id: "org-2".into(),
            name: "No Slug Org".into(),
            slug: None,
        };
        assert!(o.slug.is_none());
    }

    #[test]
    fn org_global_id_format() {
        let id = encode_global_id("Org", "org-1");
        assert_eq!(id.as_str(), "Org:org-1");
    }

    #[test]
    fn team_member_construction_all_fields() {
        let tm = TeamMember {
            user_id: "tm-1".into(),
            display_name: Some("Charlie".into()),
            email: Some("charlie@example.com".into()),
            role: "lead".into(),
            joined_at: Some("2024-01-15T00:00:00Z".into()),
        };
        assert_eq!(tm.user_id, "tm-1");
        assert_eq!(tm.display_name, Some("Charlie".into()));
        assert_eq!(tm.email, Some("charlie@example.com".into()));
        assert_eq!(tm.role, "lead");
        assert_eq!(tm.joined_at, Some("2024-01-15T00:00:00Z".into()));
    }

    #[test]
    fn team_member_construction_optional_none() {
        let tm = TeamMember {
            user_id: "tm-2".into(),
            display_name: None,
            email: None,
            role: "member".into(),
            joined_at: None,
        };
        assert!(tm.display_name.is_none());
        assert!(tm.email.is_none());
        assert!(tm.joined_at.is_none());
    }

    #[test]
    fn team_member_global_id_format() {
        let id = encode_global_id("TeamMember", "tm-1");
        assert_eq!(id.as_str(), "TeamMember:tm-1");
    }

    #[test]
    fn team_member_clone() {
        let tm = TeamMember {
            user_id: "tm-1".into(),
            display_name: Some("Charlie".into()),
            email: Some("charlie@example.com".into()),
            role: "lead".into(),
            joined_at: Some("2024-01-15T00:00:00Z".into()),
        };
        let tm2 = tm.clone();
        assert_eq!(tm.user_id, tm2.user_id);
        assert_eq!(tm.joined_at, tm2.joined_at);
    }

    #[test]
    fn team_metrics_construction() {
        let m = TeamMetrics {
            total_sessions: 100,
            total_messages: 5000,
            active_users: 12,
            avg_session_duration_secs: 1800.5,
        };
        assert_eq!(m.total_sessions, 100);
        assert_eq!(m.total_messages, 5000);
        assert_eq!(m.active_users, 12);
        assert!((m.avg_session_duration_secs - 1800.5).abs() < f64::EPSILON);
    }

    #[test]
    fn team_metrics_clone() {
        let m = TeamMetrics {
            total_sessions: 50,
            total_messages: 2500,
            active_users: 8,
            avg_session_duration_secs: 900.0,
        };
        let m2 = m.clone();
        assert_eq!(m.total_sessions, m2.total_sessions);
        assert_eq!(m.active_users, m2.active_users);
    }
}
