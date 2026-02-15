//! Entity: orchestrations (groups related hook executions)

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "orchestrations")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub session_id: Option<String>,
    pub hook_type: String,
    pub project_root: String,
    pub status: String,
    pub total_hooks: i32,
    pub completed_hooks: i32,
    pub failed_hooks: i32,
    pub deferred_hooks: i32,
    pub created_at: String,
    pub completed_at: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::sessions::Entity",
        from = "Column::SessionId",
        to = "super::sessions::Column::Id"
    )]
    Session,
    #[sea_orm(has_many = "super::hook_executions::Entity")]
    HookExecutions,
    #[sea_orm(has_many = "super::pending_hooks::Entity")]
    PendingHooks,
}

impl Related<super::sessions::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Session.def()
    }
}

impl Related<super::hook_executions::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::HookExecutions.def()
    }
}

impl Related<super::pending_hooks::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::PendingHooks.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
