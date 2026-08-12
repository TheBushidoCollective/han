//! Entity: sessions (agent sessions from any supported harness)

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// Harness recorded for sessions with no explicit value.
///
/// Claude Code was the only harness han indexed before harness tracking
/// existed, so it is both the migration backfill value and the fallback any
/// reader uses.
pub const DEFAULT_HARNESS: &str = "claude-code";

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "sessions")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub project_id: Option<String>,
    pub status: Option<String>,
    pub slug: Option<String>,
    pub transcript_path: Option<String>,
    pub source_config_dir: Option<String>,
    pub last_indexed_line: Option<i32>,
    pub pr_number: Option<i32>,
    pub pr_url: Option<String>,
    pub team_name: Option<String>,
    /// Coding agent that produced this session: `claude-code`, `omp`,
    /// `opencode`, `gemini-cli`, `kiro`, `codex`, or `antigravity`.
    ///
    /// NULL means the row predates harness tracking, which only Claude Code
    /// could have produced. Readers resolve NULL to `claude-code`.
    pub harness: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::projects::Entity",
        from = "Column::ProjectId",
        to = "super::projects::Column::Id"
    )]
    Project,
    #[sea_orm(has_many = "super::session_files::Entity")]
    SessionFiles,
    #[sea_orm(has_many = "super::messages::Entity")]
    Messages,
    #[sea_orm(has_one = "super::session_summaries::Entity")]
    SessionSummary,
    #[sea_orm(has_one = "super::session_compacts::Entity")]
    SessionCompact,
    #[sea_orm(has_one = "super::session_todos::Entity")]
    SessionTodos,
    #[sea_orm(has_many = "super::native_tasks::Entity")]
    NativeTasks,
    #[sea_orm(has_many = "super::tasks::Entity")]
    Tasks,
    #[sea_orm(has_many = "super::orchestrations::Entity")]
    Orchestrations,
    #[sea_orm(has_many = "super::hook_executions::Entity")]
    HookExecutions,
    #[sea_orm(has_many = "super::frustration_events::Entity")]
    FrustrationEvents,
    #[sea_orm(has_many = "super::session_file_changes::Entity")]
    SessionFileChanges,
    #[sea_orm(has_many = "super::session_file_validations::Entity")]
    SessionFileValidations,
    #[sea_orm(has_many = "super::async_hook_queue::Entity")]
    AsyncHookQueue,
    #[sea_orm(has_one = "super::generated_session_summaries::Entity")]
    GeneratedSessionSummary,
}

impl Related<super::projects::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Project.def()
    }
}

impl Related<super::messages::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Messages.def()
    }
}

impl Related<super::session_files::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::SessionFiles.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
