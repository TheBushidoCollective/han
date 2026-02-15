//! Entity: generated_session_summaries (LLM-analyzed, searchable)

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "generated_session_summaries")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    #[sea_orm(unique)]
    pub session_id: String,
    #[sea_orm(column_type = "Text")]
    pub summary_text: String,
    #[sea_orm(column_type = "Text")]
    pub topics: String,
    #[sea_orm(column_type = "Text", nullable)]
    pub files_modified: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub tools_used: Option<String>,
    pub outcome: Option<String>,
    pub message_count: Option<i32>,
    pub duration_seconds: Option<i32>,
    pub created_at: String,
    pub updated_at: String,
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
