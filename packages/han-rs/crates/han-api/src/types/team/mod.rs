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
