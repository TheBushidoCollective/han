//! Entity: frustration_events (user frustration tracking)

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "frustration_events")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub session_id: Option<String>,
    pub task_id: Option<String>,
    pub frustration_level: String,
    pub frustration_score: f64,
    #[sea_orm(column_type = "Text")]
    pub user_message: String,
    #[sea_orm(column_type = "Text", nullable)]
    pub detected_signals: Option<String>,
    #[sea_orm(column_type = "Text", nullable)]
    pub context: Option<String>,
    pub recorded_at: String,
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
