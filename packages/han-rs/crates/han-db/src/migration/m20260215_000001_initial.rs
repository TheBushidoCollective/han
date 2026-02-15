//! Initial migration: creates all tables, indexes, FTS5 virtual tables, and triggers.

use sea_orm_migration::prelude::*;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20260215_000001_initial"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // -- han_metadata
        manager
            .create_table(
                Table::create()
                    .table(HanMetadata::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(HanMetadata::Key).string().primary_key())
                    .col(ColumnDef::new(HanMetadata::Value).string().not_null())
                    .col(ColumnDef::new(HanMetadata::UpdatedAt).string().not_null())
                    .to_owned(),
            )
            .await?;

        // -- repos
        manager
            .create_table(
                Table::create()
                    .table(Repos::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Repos::Id).string().primary_key())
                    .col(ColumnDef::new(Repos::Remote).string().not_null().unique_key())
                    .col(ColumnDef::new(Repos::Name).string().not_null())
                    .col(ColumnDef::new(Repos::DefaultBranch).string().null())
                    .col(ColumnDef::new(Repos::CreatedAt).string().not_null())
                    .col(ColumnDef::new(Repos::UpdatedAt).string().not_null())
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_repos_remote")
                    .table(Repos::Table)
                    .col(Repos::Remote)
                    .to_owned(),
            )
            .await?;

        // -- config_dirs
        manager
            .create_table(
                Table::create()
                    .table(ConfigDirs::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(ConfigDirs::Id).string().primary_key())
                    .col(ColumnDef::new(ConfigDirs::Path).string().not_null().unique_key())
                    .col(ColumnDef::new(ConfigDirs::Name).string().null())
                    .col(ColumnDef::new(ConfigDirs::RegisteredAt).string().not_null())
                    .col(ColumnDef::new(ConfigDirs::LastIndexedAt).string().null())
                    .col(ColumnDef::new(ConfigDirs::SessionCount).integer().null().default(0))
                    .col(ColumnDef::new(ConfigDirs::IsDefault).integer().not_null().default(0))
                    .to_owned(),
            )
            .await?;

        // -- projects
        manager
            .create_table(
                Table::create()
                    .table(Projects::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Projects::Id).string().primary_key())
                    .col(ColumnDef::new(Projects::RepoId).string().null())
                    .col(ColumnDef::new(Projects::Slug).string().not_null().unique_key())
                    .col(ColumnDef::new(Projects::Path).string().not_null())
                    .col(ColumnDef::new(Projects::RelativePath).string().null())
                    .col(ColumnDef::new(Projects::Name).string().not_null())
                    .col(ColumnDef::new(Projects::IsWorktree).integer().null().default(0))
                    .col(ColumnDef::new(Projects::SourceConfigDir).string().null())
                    .col(ColumnDef::new(Projects::CreatedAt).string().not_null())
                    .col(ColumnDef::new(Projects::UpdatedAt).string().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .from(Projects::Table, Projects::RepoId)
                            .to(Repos::Table, Repos::Id),
                    )
                    .to_owned(),
            )
            .await?;

        for (name, col) in [
            ("idx_projects_slug", Projects::Slug),
            ("idx_projects_path", Projects::Path),
            ("idx_projects_repo", Projects::RepoId),
            ("idx_projects_source", Projects::SourceConfigDir),
        ] {
            manager
                .create_index(
                    Index::create()
                        .if_not_exists()
                        .name(name)
                        .table(Projects::Table)
                        .col(col)
                        .to_owned(),
                )
                .await?;
        }

        // -- sessions
        manager
            .create_table(
                Table::create()
                    .table(Sessions::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Sessions::Id).string().primary_key())
                    .col(ColumnDef::new(Sessions::ProjectId).string().null())
                    .col(ColumnDef::new(Sessions::Status).string().null().default("active"))
                    .col(ColumnDef::new(Sessions::Slug).string().null())
                    .col(ColumnDef::new(Sessions::TranscriptPath).string().null())
                    .col(ColumnDef::new(Sessions::SourceConfigDir).string().null())
                    .col(ColumnDef::new(Sessions::LastIndexedLine).integer().null().default(0))
                    .foreign_key(
                        ForeignKey::create()
                            .from(Sessions::Table, Sessions::ProjectId)
                            .to(Projects::Table, Projects::Id),
                    )
                    .to_owned(),
            )
            .await?;

        for (name, col) in [
            ("idx_sessions_project", Sessions::ProjectId),
            ("idx_sessions_status", Sessions::Status),
            ("idx_sessions_source", Sessions::SourceConfigDir),
        ] {
            manager
                .create_index(
                    Index::create()
                        .if_not_exists()
                        .name(name)
                        .table(Sessions::Table)
                        .col(col)
                        .to_owned(),
                )
                .await?;
        }

        // -- session_files
        manager
            .create_table(
                Table::create()
                    .table(SessionFiles::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(SessionFiles::Id).string().primary_key())
                    .col(ColumnDef::new(SessionFiles::SessionId).string().not_null())
                    .col(ColumnDef::new(SessionFiles::FileType).string().not_null())
                    .col(ColumnDef::new(SessionFiles::FilePath).string().not_null().unique_key())
                    .col(ColumnDef::new(SessionFiles::AgentId).string().null())
                    .col(ColumnDef::new(SessionFiles::LastIndexedLine).integer().null().default(0))
                    .col(ColumnDef::new(SessionFiles::LastIndexedAt).string().null())
                    .col(ColumnDef::new(SessionFiles::CreatedAt).string().not_null())
                    .foreign_key(
                        ForeignKey::create()
                            .from(SessionFiles::Table, SessionFiles::SessionId)
                            .to(Sessions::Table, Sessions::Id),
                    )
                    .to_owned(),
            )
            .await?;

        for (name, col) in [
            ("idx_session_files_session", SessionFiles::SessionId),
            ("idx_session_files_type", SessionFiles::FileType),
            ("idx_session_files_path", SessionFiles::FilePath),
        ] {
            manager
                .create_index(
                    Index::create()
                        .if_not_exists()
                        .name(name)
                        .table(SessionFiles::Table)
                        .col(col)
                        .to_owned(),
                )
                .await?;
        }

        // -- messages
        manager
            .create_table(
                Table::create()
                    .table(Messages::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Messages::Id).string().primary_key())
                    .col(ColumnDef::new(Messages::SessionId).string().not_null())
                    .col(ColumnDef::new(Messages::AgentId).string().null())
                    .col(ColumnDef::new(Messages::ParentId).string().null())
                    .col(ColumnDef::new(Messages::MessageType).string().not_null())
                    .col(ColumnDef::new(Messages::Role).string().null())
                    .col(ColumnDef::new(Messages::Content).text().null())
                    .col(ColumnDef::new(Messages::ToolName).string().null())
                    .col(ColumnDef::new(Messages::ToolInput).text().null())
                    .col(ColumnDef::new(Messages::ToolResult).text().null())
                    .col(ColumnDef::new(Messages::RawJson).text().null())
                    .col(ColumnDef::new(Messages::Timestamp).string().not_null())
                    .col(ColumnDef::new(Messages::LineNumber).integer().not_null())
                    .col(ColumnDef::new(Messages::SourceFileName).string().null())
                    .col(ColumnDef::new(Messages::SourceFileType).string().null())
                    .col(ColumnDef::new(Messages::SentimentScore).double().null())
                    .col(ColumnDef::new(Messages::SentimentLevel).string().null())
                    .col(ColumnDef::new(Messages::FrustrationScore).double().null())
                    .col(ColumnDef::new(Messages::FrustrationLevel).string().null())
                    .col(ColumnDef::new(Messages::InputTokens).integer().null())
                    .col(ColumnDef::new(Messages::OutputTokens).integer().null())
                    .col(ColumnDef::new(Messages::CacheReadTokens).integer().null())
                    .col(ColumnDef::new(Messages::CacheCreationTokens).integer().null())
                    .col(ColumnDef::new(Messages::LinesAdded).integer().null())
                    .col(ColumnDef::new(Messages::LinesRemoved).integer().null())
                    .col(ColumnDef::new(Messages::FilesChanged).integer().null())
                    .col(ColumnDef::new(Messages::IndexedAt).string().null())
                    .foreign_key(
                        ForeignKey::create()
                            .from(Messages::Table, Messages::SessionId)
                            .to(Sessions::Table, Sessions::Id),
                    )
                    .to_owned(),
            )
            .await?;

        // Message indexes
        manager.create_index(Index::create().if_not_exists().name("idx_messages_session").table(Messages::Table).col(Messages::SessionId).to_owned()).await?;
        manager.create_index(Index::create().if_not_exists().name("idx_messages_agent").table(Messages::Table).col(Messages::SessionId).col(Messages::AgentId).to_owned()).await?;
        manager.create_index(Index::create().if_not_exists().name("idx_messages_parent").table(Messages::Table).col(Messages::ParentId).to_owned()).await?;
        manager.create_index(Index::create().if_not_exists().name("idx_messages_type").table(Messages::Table).col(Messages::MessageType).to_owned()).await?;
        manager.create_index(Index::create().if_not_exists().name("idx_messages_timestamp").table(Messages::Table).col(Messages::Timestamp).to_owned()).await?;
        manager.create_index(Index::create().if_not_exists().name("idx_messages_line").table(Messages::Table).col(Messages::SessionId).col(Messages::LineNumber).to_owned()).await?;

        // -- session_summaries
        manager
            .create_table(
                Table::create()
                    .table(SessionSummaries::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(SessionSummaries::Id).string().primary_key())
                    .col(ColumnDef::new(SessionSummaries::SessionId).string().not_null().unique_key())
                    .col(ColumnDef::new(SessionSummaries::MessageId).string().not_null())
                    .col(ColumnDef::new(SessionSummaries::Content).text().null())
                    .col(ColumnDef::new(SessionSummaries::RawJson).text().null())
                    .col(ColumnDef::new(SessionSummaries::Timestamp).string().not_null())
                    .col(ColumnDef::new(SessionSummaries::LineNumber).integer().not_null())
                    .col(ColumnDef::new(SessionSummaries::IndexedAt).string().null())
                    .foreign_key(ForeignKey::create().from(SessionSummaries::Table, SessionSummaries::SessionId).to(Sessions::Table, Sessions::Id))
                    .to_owned(),
            )
            .await?;

        // -- session_compacts
        manager
            .create_table(
                Table::create()
                    .table(SessionCompacts::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(SessionCompacts::Id).string().primary_key())
                    .col(ColumnDef::new(SessionCompacts::SessionId).string().not_null().unique_key())
                    .col(ColumnDef::new(SessionCompacts::MessageId).string().not_null())
                    .col(ColumnDef::new(SessionCompacts::Content).text().null())
                    .col(ColumnDef::new(SessionCompacts::RawJson).text().null())
                    .col(ColumnDef::new(SessionCompacts::Timestamp).string().not_null())
                    .col(ColumnDef::new(SessionCompacts::LineNumber).integer().not_null())
                    .col(ColumnDef::new(SessionCompacts::CompactType).string().null())
                    .col(ColumnDef::new(SessionCompacts::IndexedAt).string().null())
                    .foreign_key(ForeignKey::create().from(SessionCompacts::Table, SessionCompacts::SessionId).to(Sessions::Table, Sessions::Id))
                    .to_owned(),
            )
            .await?;

        // -- session_todos
        manager
            .create_table(
                Table::create()
                    .table(SessionTodos::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(SessionTodos::Id).string().primary_key())
                    .col(ColumnDef::new(SessionTodos::SessionId).string().not_null().unique_key())
                    .col(ColumnDef::new(SessionTodos::MessageId).string().not_null())
                    .col(ColumnDef::new(SessionTodos::TodosJson).text().not_null())
                    .col(ColumnDef::new(SessionTodos::Timestamp).string().not_null())
                    .col(ColumnDef::new(SessionTodos::LineNumber).integer().not_null())
                    .col(ColumnDef::new(SessionTodos::IndexedAt).string().null())
                    .foreign_key(ForeignKey::create().from(SessionTodos::Table, SessionTodos::SessionId).to(Sessions::Table, Sessions::Id))
                    .to_owned(),
            )
            .await?;

        // -- native_tasks
        manager
            .create_table(
                Table::create()
                    .table(NativeTasks::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(NativeTasks::Id).string().not_null())
                    .col(ColumnDef::new(NativeTasks::SessionId).string().not_null())
                    .col(ColumnDef::new(NativeTasks::MessageId).string().not_null())
                    .col(ColumnDef::new(NativeTasks::Subject).string().not_null())
                    .col(ColumnDef::new(NativeTasks::Description).text().null())
                    .col(ColumnDef::new(NativeTasks::Status).string().not_null().default("pending"))
                    .col(ColumnDef::new(NativeTasks::ActiveForm).string().null())
                    .col(ColumnDef::new(NativeTasks::Owner).string().null())
                    .col(ColumnDef::new(NativeTasks::Blocks).text().null())
                    .col(ColumnDef::new(NativeTasks::BlockedBy).text().null())
                    .col(ColumnDef::new(NativeTasks::CreatedAt).string().not_null())
                    .col(ColumnDef::new(NativeTasks::UpdatedAt).string().not_null())
                    .col(ColumnDef::new(NativeTasks::CompletedAt).string().null())
                    .col(ColumnDef::new(NativeTasks::LineNumber).integer().not_null())
                    .primary_key(Index::create().col(NativeTasks::Id))
                    .foreign_key(ForeignKey::create().from(NativeTasks::Table, NativeTasks::SessionId).to(Sessions::Table, Sessions::Id))
                    .to_owned(),
            )
            .await?;

        // -- tasks (metrics)
        manager
            .create_table(
                Table::create()
                    .table(Tasks::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Tasks::Id).string().primary_key())
                    .col(ColumnDef::new(Tasks::SessionId).string().null())
                    .col(ColumnDef::new(Tasks::TaskId).string().not_null().unique_key())
                    .col(ColumnDef::new(Tasks::Description).string().not_null())
                    .col(ColumnDef::new(Tasks::TaskType).string().not_null())
                    .col(ColumnDef::new(Tasks::Outcome).string().null())
                    .col(ColumnDef::new(Tasks::Confidence).double().null())
                    .col(ColumnDef::new(Tasks::Notes).text().null())
                    .col(ColumnDef::new(Tasks::FilesModified).text().null())
                    .col(ColumnDef::new(Tasks::TestsAdded).integer().null())
                    .col(ColumnDef::new(Tasks::StartedAt).string().not_null())
                    .col(ColumnDef::new(Tasks::CompletedAt).string().null())
                    .foreign_key(ForeignKey::create().from(Tasks::Table, Tasks::SessionId).to(Sessions::Table, Sessions::Id))
                    .to_owned(),
            )
            .await?;

        manager.create_index(Index::create().if_not_exists().name("idx_tasks_task_id").table(Tasks::Table).col(Tasks::TaskId).to_owned()).await?;
        manager.create_index(Index::create().if_not_exists().name("idx_tasks_session").table(Tasks::Table).col(Tasks::SessionId).to_owned()).await?;
        manager.create_index(Index::create().if_not_exists().name("idx_tasks_type").table(Tasks::Table).col(Tasks::TaskType).to_owned()).await?;
        manager.create_index(Index::create().if_not_exists().name("idx_tasks_outcome").table(Tasks::Table).col(Tasks::Outcome).to_owned()).await?;
        manager.create_index(Index::create().if_not_exists().name("idx_tasks_started").table(Tasks::Table).col(Tasks::StartedAt).to_owned()).await?;

        // -- orchestrations
        manager
            .create_table(
                Table::create()
                    .table(Orchestrations::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Orchestrations::Id).string().primary_key())
                    .col(ColumnDef::new(Orchestrations::SessionId).string().null())
                    .col(ColumnDef::new(Orchestrations::HookType).string().not_null())
                    .col(ColumnDef::new(Orchestrations::ProjectRoot).string().not_null())
                    .col(ColumnDef::new(Orchestrations::Status).string().not_null().default("pending"))
                    .col(ColumnDef::new(Orchestrations::TotalHooks).integer().not_null().default(0))
                    .col(ColumnDef::new(Orchestrations::CompletedHooks).integer().not_null().default(0))
                    .col(ColumnDef::new(Orchestrations::FailedHooks).integer().not_null().default(0))
                    .col(ColumnDef::new(Orchestrations::DeferredHooks).integer().not_null().default(0))
                    .col(ColumnDef::new(Orchestrations::CreatedAt).string().not_null())
                    .col(ColumnDef::new(Orchestrations::CompletedAt).string().null())
                    .foreign_key(ForeignKey::create().from(Orchestrations::Table, Orchestrations::SessionId).to(Sessions::Table, Sessions::Id))
                    .to_owned(),
            )
            .await?;

        // -- hook_executions
        manager
            .create_table(
                Table::create()
                    .table(HookExecutions::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(HookExecutions::Id).string().primary_key())
                    .col(ColumnDef::new(HookExecutions::OrchestrationId).string().null())
                    .col(ColumnDef::new(HookExecutions::SessionId).string().null())
                    .col(ColumnDef::new(HookExecutions::TaskId).string().null())
                    .col(ColumnDef::new(HookExecutions::HookType).string().not_null())
                    .col(ColumnDef::new(HookExecutions::HookName).string().not_null())
                    .col(ColumnDef::new(HookExecutions::HookSource).string().null())
                    .col(ColumnDef::new(HookExecutions::Directory).string().null())
                    .col(ColumnDef::new(HookExecutions::DurationMs).integer().not_null())
                    .col(ColumnDef::new(HookExecutions::ExitCode).integer().not_null())
                    .col(ColumnDef::new(HookExecutions::Passed).integer().not_null().default(1))
                    .col(ColumnDef::new(HookExecutions::Output).text().null())
                    .col(ColumnDef::new(HookExecutions::Error).text().null())
                    .col(ColumnDef::new(HookExecutions::IfChanged).text().null())
                    .col(ColumnDef::new(HookExecutions::Command).text().null())
                    .col(ColumnDef::new(HookExecutions::ExecutedAt).string().not_null())
                    .col(ColumnDef::new(HookExecutions::Status).string().null().default("completed"))
                    .col(ColumnDef::new(HookExecutions::ConsecutiveFailures).integer().null().default(0))
                    .col(ColumnDef::new(HookExecutions::MaxAttempts).integer().null().default(3))
                    .col(ColumnDef::new(HookExecutions::Pid).integer().null())
                    .col(ColumnDef::new(HookExecutions::PluginRoot).string().null())
                    .foreign_key(ForeignKey::create().from(HookExecutions::Table, HookExecutions::OrchestrationId).to(Orchestrations::Table, Orchestrations::Id))
                    .foreign_key(ForeignKey::create().from(HookExecutions::Table, HookExecutions::SessionId).to(Sessions::Table, Sessions::Id))
                    .to_owned(),
            )
            .await?;

        manager.create_index(Index::create().if_not_exists().name("idx_hook_executions_session").table(HookExecutions::Table).col(HookExecutions::SessionId).to_owned()).await?;
        manager.create_index(Index::create().if_not_exists().name("idx_hook_executions_orchestration").table(HookExecutions::Table).col(HookExecutions::OrchestrationId).to_owned()).await?;

        // -- pending_hooks
        manager
            .create_table(
                Table::create()
                    .table(PendingHooks::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(PendingHooks::Id).string().primary_key())
                    .col(ColumnDef::new(PendingHooks::OrchestrationId).string().not_null())
                    .col(ColumnDef::new(PendingHooks::Plugin).string().not_null())
                    .col(ColumnDef::new(PendingHooks::HookName).string().not_null())
                    .col(ColumnDef::new(PendingHooks::Directory).string().not_null())
                    .col(ColumnDef::new(PendingHooks::IfChanged).text().null())
                    .col(ColumnDef::new(PendingHooks::Command).text().not_null())
                    .col(ColumnDef::new(PendingHooks::QueuedAt).string().not_null())
                    .foreign_key(ForeignKey::create().from(PendingHooks::Table, PendingHooks::OrchestrationId).to(Orchestrations::Table, Orchestrations::Id))
                    .to_owned(),
            )
            .await?;

        // -- frustration_events
        manager
            .create_table(
                Table::create()
                    .table(FrustrationEvents::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(FrustrationEvents::Id).string().primary_key())
                    .col(ColumnDef::new(FrustrationEvents::SessionId).string().null())
                    .col(ColumnDef::new(FrustrationEvents::TaskId).string().null())
                    .col(ColumnDef::new(FrustrationEvents::FrustrationLevel).string().not_null())
                    .col(ColumnDef::new(FrustrationEvents::FrustrationScore).double().not_null())
                    .col(ColumnDef::new(FrustrationEvents::UserMessage).text().not_null())
                    .col(ColumnDef::new(FrustrationEvents::DetectedSignals).text().null())
                    .col(ColumnDef::new(FrustrationEvents::Context).text().null())
                    .col(ColumnDef::new(FrustrationEvents::RecordedAt).string().not_null())
                    .foreign_key(ForeignKey::create().from(FrustrationEvents::Table, FrustrationEvents::SessionId).to(Sessions::Table, Sessions::Id))
                    .to_owned(),
            )
            .await?;

        // -- session_file_changes
        manager
            .create_table(
                Table::create()
                    .table(SessionFileChanges::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(SessionFileChanges::Id).string().primary_key())
                    .col(ColumnDef::new(SessionFileChanges::SessionId).string().not_null())
                    .col(ColumnDef::new(SessionFileChanges::FilePath).string().not_null())
                    .col(ColumnDef::new(SessionFileChanges::Action).string().not_null())
                    .col(ColumnDef::new(SessionFileChanges::FileHashBefore).string().null())
                    .col(ColumnDef::new(SessionFileChanges::FileHashAfter).string().null())
                    .col(ColumnDef::new(SessionFileChanges::ToolName).string().null())
                    .col(ColumnDef::new(SessionFileChanges::AgentId).string().null())
                    .col(ColumnDef::new(SessionFileChanges::RecordedAt).string().not_null())
                    .foreign_key(ForeignKey::create().from(SessionFileChanges::Table, SessionFileChanges::SessionId).to(Sessions::Table, Sessions::Id))
                    .to_owned(),
            )
            .await?;

        // -- session_file_validations
        manager
            .create_table(
                Table::create()
                    .table(SessionFileValidations::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(SessionFileValidations::Id).string().primary_key())
                    .col(ColumnDef::new(SessionFileValidations::SessionId).string().not_null())
                    .col(ColumnDef::new(SessionFileValidations::FilePath).string().not_null())
                    .col(ColumnDef::new(SessionFileValidations::FileHash).string().not_null())
                    .col(ColumnDef::new(SessionFileValidations::PluginName).string().not_null())
                    .col(ColumnDef::new(SessionFileValidations::HookName).string().not_null())
                    .col(ColumnDef::new(SessionFileValidations::Directory).string().not_null())
                    .col(ColumnDef::new(SessionFileValidations::CommandHash).string().not_null())
                    .col(ColumnDef::new(SessionFileValidations::ValidatedAt).string().not_null())
                    .foreign_key(ForeignKey::create().from(SessionFileValidations::Table, SessionFileValidations::SessionId).to(Sessions::Table, Sessions::Id))
                    .to_owned(),
            )
            .await?;

        // -- async_hook_queue
        manager
            .create_table(
                Table::create()
                    .table(AsyncHookQueue::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(AsyncHookQueue::Id).string().primary_key())
                    .col(ColumnDef::new(AsyncHookQueue::SessionId).string().not_null())
                    .col(ColumnDef::new(AsyncHookQueue::Cwd).string().not_null())
                    .col(ColumnDef::new(AsyncHookQueue::Plugin).string().not_null())
                    .col(ColumnDef::new(AsyncHookQueue::HookName).string().not_null())
                    .col(ColumnDef::new(AsyncHookQueue::FilePaths).text().not_null())
                    .col(ColumnDef::new(AsyncHookQueue::Command).text().not_null())
                    .col(ColumnDef::new(AsyncHookQueue::Status).string().not_null().default("pending"))
                    .col(ColumnDef::new(AsyncHookQueue::CreatedAt).string().not_null())
                    .col(ColumnDef::new(AsyncHookQueue::StartedAt).string().null())
                    .col(ColumnDef::new(AsyncHookQueue::CompletedAt).string().null())
                    .col(ColumnDef::new(AsyncHookQueue::Result).text().null())
                    .col(ColumnDef::new(AsyncHookQueue::Error).text().null())
                    .foreign_key(ForeignKey::create().from(AsyncHookQueue::Table, AsyncHookQueue::SessionId).to(Sessions::Table, Sessions::Id))
                    .to_owned(),
            )
            .await?;

        // -- generated_session_summaries
        manager
            .create_table(
                Table::create()
                    .table(GeneratedSessionSummaries::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(GeneratedSessionSummaries::Id).string().primary_key())
                    .col(ColumnDef::new(GeneratedSessionSummaries::SessionId).string().not_null().unique_key())
                    .col(ColumnDef::new(GeneratedSessionSummaries::SummaryText).text().not_null())
                    .col(ColumnDef::new(GeneratedSessionSummaries::Topics).text().not_null())
                    .col(ColumnDef::new(GeneratedSessionSummaries::FilesModified).text().null())
                    .col(ColumnDef::new(GeneratedSessionSummaries::ToolsUsed).text().null())
                    .col(ColumnDef::new(GeneratedSessionSummaries::Outcome).string().null())
                    .col(ColumnDef::new(GeneratedSessionSummaries::MessageCount).integer().null())
                    .col(ColumnDef::new(GeneratedSessionSummaries::DurationSeconds).integer().null())
                    .col(ColumnDef::new(GeneratedSessionSummaries::CreatedAt).string().not_null())
                    .col(ColumnDef::new(GeneratedSessionSummaries::UpdatedAt).string().not_null())
                    .foreign_key(ForeignKey::create().from(GeneratedSessionSummaries::Table, GeneratedSessionSummaries::SessionId).to(Sessions::Table, Sessions::Id))
                    .to_owned(),
            )
            .await?;

        // -- FTS5 virtual tables and triggers (SQLite only, raw SQL)
        #[cfg(feature = "sqlite")]
        {
            use sea_orm::{ConnectionTrait, Statement};

            let fts_sql = vec![
                // sessions_with_timestamps view
                "CREATE VIEW IF NOT EXISTS sessions_with_timestamps AS
                 SELECT s.*, (SELECT MIN(m.timestamp) FROM messages m WHERE m.session_id = s.id) as started_at,
                 (SELECT MAX(m.timestamp) FROM messages m WHERE m.session_id = s.id) as ended_at,
                 (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) as message_count
                 FROM sessions s",
                // messages FTS
                "CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(id, content, content='messages', content_rowid='rowid')",
                "CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN INSERT INTO messages_fts(rowid, id, content) VALUES (NEW.rowid, NEW.id, NEW.content); END",
                "CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN INSERT INTO messages_fts(messages_fts, rowid, id, content) VALUES ('delete', OLD.rowid, OLD.id, OLD.content); END",
                "CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN INSERT INTO messages_fts(messages_fts, rowid, id, content) VALUES ('delete', OLD.rowid, OLD.id, OLD.content); INSERT INTO messages_fts(rowid, id, content) VALUES (NEW.rowid, NEW.id, NEW.content); END",
                // generated_session_summaries FTS
                "CREATE VIRTUAL TABLE IF NOT EXISTS generated_session_summaries_fts USING fts5(id, summary_text, topics, content='generated_session_summaries', content_rowid='rowid')",
                "CREATE TRIGGER IF NOT EXISTS gen_summaries_ai AFTER INSERT ON generated_session_summaries BEGIN INSERT INTO generated_session_summaries_fts(rowid, id, summary_text, topics) VALUES (NEW.rowid, NEW.id, NEW.summary_text, NEW.topics); END",
                "CREATE TRIGGER IF NOT EXISTS gen_summaries_ad AFTER DELETE ON generated_session_summaries BEGIN INSERT INTO generated_session_summaries_fts(generated_session_summaries_fts, rowid, id, summary_text, topics) VALUES ('delete', OLD.rowid, OLD.id, OLD.summary_text, OLD.topics); END",
                "CREATE TRIGGER IF NOT EXISTS gen_summaries_au AFTER UPDATE ON generated_session_summaries BEGIN INSERT INTO generated_session_summaries_fts(generated_session_summaries_fts, rowid, id, summary_text, topics) VALUES ('delete', OLD.rowid, OLD.id, OLD.summary_text, OLD.topics); INSERT INTO generated_session_summaries_fts(rowid, id, summary_text, topics) VALUES (NEW.rowid, NEW.id, NEW.summary_text, NEW.topics); END",
            ];

            let db = manager.get_connection();
            for sql in fts_sql {
                db.execute(Statement::from_string(sea_orm::DatabaseBackend::Sqlite, sql.to_string()))
                    .await?;
            }
        }

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Drop in reverse dependency order
        let tables = vec![
            AsyncHookQueue::Table.into_table_ref(),
            SessionFileValidations::Table.into_table_ref(),
            SessionFileChanges::Table.into_table_ref(),
            FrustrationEvents::Table.into_table_ref(),
            PendingHooks::Table.into_table_ref(),
            HookExecutions::Table.into_table_ref(),
            Orchestrations::Table.into_table_ref(),
            Tasks::Table.into_table_ref(),
            NativeTasks::Table.into_table_ref(),
            GeneratedSessionSummaries::Table.into_table_ref(),
            SessionTodos::Table.into_table_ref(),
            SessionCompacts::Table.into_table_ref(),
            SessionSummaries::Table.into_table_ref(),
            Messages::Table.into_table_ref(),
            SessionFiles::Table.into_table_ref(),
            Sessions::Table.into_table_ref(),
            Projects::Table.into_table_ref(),
            ConfigDirs::Table.into_table_ref(),
            Repos::Table.into_table_ref(),
            HanMetadata::Table.into_table_ref(),
        ];

        for table in tables {
            manager.drop_table(Table::drop().table(table).if_exists().to_owned()).await?;
        }

        Ok(())
    }
}

// Iden enums for all tables

#[derive(DeriveIden)]
enum HanMetadata {
    Table,
    Key,
    Value,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Repos {
    Table,
    Id,
    Remote,
    Name,
    DefaultBranch,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum ConfigDirs {
    Table,
    Id,
    Path,
    Name,
    RegisteredAt,
    LastIndexedAt,
    SessionCount,
    IsDefault,
}

#[derive(DeriveIden)]
enum Projects {
    Table,
    Id,
    RepoId,
    Slug,
    Path,
    RelativePath,
    Name,
    IsWorktree,
    SourceConfigDir,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Sessions {
    Table,
    Id,
    ProjectId,
    Status,
    Slug,
    TranscriptPath,
    SourceConfigDir,
    LastIndexedLine,
}

#[derive(DeriveIden)]
enum SessionFiles {
    Table,
    Id,
    SessionId,
    FileType,
    FilePath,
    AgentId,
    LastIndexedLine,
    LastIndexedAt,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Messages {
    Table,
    Id,
    SessionId,
    AgentId,
    ParentId,
    MessageType,
    Role,
    Content,
    ToolName,
    ToolInput,
    ToolResult,
    RawJson,
    Timestamp,
    LineNumber,
    SourceFileName,
    SourceFileType,
    SentimentScore,
    SentimentLevel,
    FrustrationScore,
    FrustrationLevel,
    InputTokens,
    OutputTokens,
    CacheReadTokens,
    CacheCreationTokens,
    LinesAdded,
    LinesRemoved,
    FilesChanged,
    IndexedAt,
}

#[derive(DeriveIden)]
enum SessionSummaries {
    Table,
    Id,
    SessionId,
    MessageId,
    Content,
    RawJson,
    Timestamp,
    LineNumber,
    IndexedAt,
}

#[derive(DeriveIden)]
enum SessionCompacts {
    Table,
    Id,
    SessionId,
    MessageId,
    Content,
    RawJson,
    Timestamp,
    LineNumber,
    CompactType,
    IndexedAt,
}

#[derive(DeriveIden)]
enum SessionTodos {
    Table,
    Id,
    SessionId,
    MessageId,
    TodosJson,
    Timestamp,
    LineNumber,
    IndexedAt,
}

#[derive(DeriveIden)]
enum NativeTasks {
    Table,
    Id,
    SessionId,
    MessageId,
    Subject,
    Description,
    Status,
    ActiveForm,
    Owner,
    Blocks,
    BlockedBy,
    CreatedAt,
    UpdatedAt,
    CompletedAt,
    LineNumber,
}

#[derive(DeriveIden)]
enum Tasks {
    Table,
    Id,
    SessionId,
    TaskId,
    Description,
    TaskType,
    Outcome,
    Confidence,
    Notes,
    FilesModified,
    TestsAdded,
    StartedAt,
    CompletedAt,
}

#[derive(DeriveIden)]
enum Orchestrations {
    Table,
    Id,
    SessionId,
    HookType,
    ProjectRoot,
    Status,
    TotalHooks,
    CompletedHooks,
    FailedHooks,
    DeferredHooks,
    CreatedAt,
    CompletedAt,
}

#[derive(DeriveIden)]
enum HookExecutions {
    Table,
    Id,
    OrchestrationId,
    SessionId,
    TaskId,
    HookType,
    HookName,
    HookSource,
    Directory,
    DurationMs,
    ExitCode,
    Passed,
    Output,
    Error,
    IfChanged,
    Command,
    ExecutedAt,
    Status,
    ConsecutiveFailures,
    MaxAttempts,
    Pid,
    PluginRoot,
}

#[derive(DeriveIden)]
enum PendingHooks {
    Table,
    Id,
    OrchestrationId,
    Plugin,
    HookName,
    Directory,
    IfChanged,
    Command,
    QueuedAt,
}

#[derive(DeriveIden)]
enum FrustrationEvents {
    Table,
    Id,
    SessionId,
    TaskId,
    FrustrationLevel,
    FrustrationScore,
    UserMessage,
    DetectedSignals,
    Context,
    RecordedAt,
}

#[derive(DeriveIden)]
enum SessionFileChanges {
    Table,
    Id,
    SessionId,
    FilePath,
    Action,
    FileHashBefore,
    FileHashAfter,
    ToolName,
    AgentId,
    RecordedAt,
}

#[derive(DeriveIden)]
enum SessionFileValidations {
    Table,
    Id,
    SessionId,
    FilePath,
    FileHash,
    PluginName,
    HookName,
    Directory,
    CommandHash,
    ValidatedAt,
}

#[derive(DeriveIden)]
enum AsyncHookQueue {
    Table,
    Id,
    SessionId,
    Cwd,
    Plugin,
    HookName,
    FilePaths,
    Command,
    Status,
    CreatedAt,
    StartedAt,
    CompletedAt,
    Result,
    Error,
}

#[derive(DeriveIden)]
enum GeneratedSessionSummaries {
    Table,
    Id,
    SessionId,
    SummaryText,
    Topics,
    FilesModified,
    ToolsUsed,
    Outcome,
    MessageCount,
    DurationSeconds,
    CreatedAt,
    UpdatedAt,
}
