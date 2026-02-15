//! Entity: native_tasks (from Claude Code's TaskCreate/TaskUpdate tools)

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "native_tasks")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub session_id: String,
    pub message_id: String,
    pub subject: String,
    #[sea_orm(column_type = "Text", nullable)]
    pub description: Option<String>,
    pub status: String,
    pub active_form: Option<String>,
    pub owner: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub blocks: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub blocked_by: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
    pub line_number: i32,
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
