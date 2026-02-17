//! Entity: hook_executions (track every hook run for metrics)

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "hook_executions")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub orchestration_id: Option<String>,
    pub session_id: Option<String>,
    pub task_id: Option<String>,
    pub hook_type: String,
    pub hook_name: String,
    pub hook_source: Option<String>,
    pub directory: Option<String>,
    pub duration_ms: i32,
    pub exit_code: i32,
    pub passed: i32,
    #[sea_orm(column_type = "Text", nullable)]
    pub output: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub error: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub if_changed: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub command: Option<String>,
    pub executed_at: String,
    pub status: Option<String>,
    pub consecutive_failures: Option<i32>,
    pub max_attempts: Option<i32>,
    pub pid: Option<i32>,
    pub plugin_root: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::orchestrations::Entity",
        from = "Column::OrchestrationId",
        to = "super::orchestrations::Column::Id"
    )]
    Orchestration,
    #[sea_orm(
        belongs_to = "super::sessions::Entity",
        from = "Column::SessionId",
        to = "super::sessions::Column::Id"
    )]
    Session,
}

impl Related<super::orchestrations::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Orchestration.def()
    }
}

impl Related<super::sessions::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Session.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
