//! Entity: messages (individual JSONL entries from sessions)

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "messages")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub session_id: String,
    pub agent_id: Option<String>,
    pub parent_id: Option<String>,
    pub message_type: String,
    pub role: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub content: Option<String>,
    pub tool_name: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub tool_input: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub tool_result: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub raw_json: Option<String>,
    pub timestamp: String,
    pub line_number: i32,
    pub source_file_name: Option<String>,
    pub source_file_type: Option<String>,
    pub sentiment_score: Option<f64>,
    pub sentiment_level: Option<String>,
    pub frustration_score: Option<f64>,
    pub frustration_level: Option<String>,
    pub input_tokens: Option<i32>,
    pub output_tokens: Option<i32>,
    pub cache_read_tokens: Option<i32>,
    pub cache_creation_tokens: Option<i32>,
    pub lines_added: Option<i32>,
    pub lines_removed: Option<i32>,
    pub files_changed: Option<i32>,
    pub indexed_at: Option<String>,
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
