//! Entity: tasks (metrics tracking)

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "tasks")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub session_id: Option<String>,
    #[sea_orm(unique)]
    pub task_id: String,
    pub description: String,
    pub task_type: String,
    pub outcome: Option<String>,
    pub confidence: Option<f64>,
    #[sea_orm(column_type = "Text", nullable)]
    pub notes: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub files_modified: Option<String>,
    pub tests_added: Option<i32>,
    pub started_at: String,
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
}

impl Related<super::sessions::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Session.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
