//! Entity: pending_hooks (for --check mode orchestrations)

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "pending_hooks")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub orchestration_id: String,
    pub plugin: String,
    pub hook_name: String,
    pub directory: String,
    #[sea_orm(column_type = "Text", nullable)]
    pub if_changed: Option<String>,
    #[sea_orm(column_type = "Text")]
    pub command: String,
    pub queued_at: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::orchestrations::Entity",
        from = "Column::OrchestrationId",
        to = "super::orchestrations::Column::Id"
    )]
    Orchestration,
}

impl Related<super::orchestrations::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Orchestration.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
