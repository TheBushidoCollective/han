//! Synced session entity - encrypted session data from local coordinators.

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "synced_sessions")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    #[sea_orm(unique)]
    pub session_id: String,
    pub user_id: String,
    pub team_id: Option<String>,
    pub project_path: String,
    #[sea_orm(column_type = "Text")]
    pub encrypted_messages: String,
    #[sea_orm(column_type = "Text", nullable)]
    pub encrypted_summary: Option<String>,
    pub message_count: i32,
    #[sea_orm(column_type = "Text", nullable)]
    pub metadata: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::users::Entity",
        from = "Column::UserId",
        to = "super::users::Column::Id"
    )]
    User,
}

impl Related<super::users::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::User.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
