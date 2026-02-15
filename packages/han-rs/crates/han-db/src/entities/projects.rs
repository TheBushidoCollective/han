//! Entity: projects (worktrees, subdirs within a repo)

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "projects")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub repo_id: Option<String>,
    #[sea_orm(unique)]
    pub slug: String,
    pub path: String,
    pub relative_path: Option<String>,
    pub name: String,
    pub is_worktree: Option<i32>,
    pub source_config_dir: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::repos::Entity",
        from = "Column::RepoId",
        to = "super::repos::Column::Id"
    )]
    Repo,
    #[sea_orm(has_many = "super::sessions::Entity")]
    Sessions,
}

impl Related<super::repos::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Repo.def()
    }
}

impl Related<super::sessions::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Sessions.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
