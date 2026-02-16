//! Encryption key entity for per-team DEK management.

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "encryption_keys")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub owner_type: String,
    pub owner_id: String,
    pub version: i32,
    #[sea_orm(column_type = "Text")]
    pub wrapped_dek: String,
    pub wrap_nonce: String,
    pub kek_salt: String,
    pub algorithm: String,
    pub active: bool,
    pub created_at: String,
    pub rotated_at: Option<String>,
    pub expires_at: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
