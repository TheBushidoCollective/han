//! Integration tests for han-db.
//!
//! Tests run against a fresh in-memory SQLite database with migrations applied.
//! Also includes a read-only test against the real ~/.han/han.db if it exists.

use han_db::connection::{DbConfig, establish_connection};
use han_db::migration::Migrator;
use sea_orm::DatabaseConnection;
use sea_orm_migration::MigratorTrait;

/// Helper: create an in-memory SQLite database with all migrations applied.
async fn setup_db() -> DatabaseConnection {
    let db = establish_connection(DbConfig::Sqlite {
        path: ":memory:".to_string(),
    })
    .await
    .expect("Failed to connect to in-memory SQLite");

    Migrator::up(&db, None)
        .await
        .expect("Failed to run migrations");

    db
}

// ============================================================================
// Connection & Migration Tests
// ============================================================================

#[tokio::test]
async fn test_connection_and_migration() {
    let db = setup_db().await;

    // Verify tables exist by querying one
    use sea_orm::EntityTrait;
    let repos = han_db::entities::repos::Entity::find()
        .all(&db)
        .await
        .expect("Should be able to query repos table");
    assert!(repos.is_empty());
}

#[tokio::test]
async fn test_sqlite_pragmas_applied() {
    use sea_orm::{ConnectionTrait, Statement};

    // Use a tempfile-based database for WAL mode testing (in-memory uses "memory" journal)
    let tmp = tempfile::NamedTempFile::new().expect("Failed to create temp file");
    let db = establish_connection(DbConfig::Sqlite {
        path: tmp.path().to_string_lossy().to_string(),
    })
    .await
    .expect("Failed to connect");

    Migrator::up(&db, None).await.expect("Migration failed");

    // Verify WAL mode
    let row = db
        .query_one(Statement::from_string(
            sea_orm::DatabaseBackend::Sqlite,
            "PRAGMA journal_mode;".to_string(),
        ))
        .await
        .expect("Failed to query pragma")
        .expect("No row returned");

    let mode: String = row.try_get("", "journal_mode").unwrap_or_default();
    assert_eq!(mode, "wal", "WAL mode should be enabled");

    // Verify foreign keys
    let row = db
        .query_one(Statement::from_string(
            sea_orm::DatabaseBackend::Sqlite,
            "PRAGMA foreign_keys;".to_string(),
        ))
        .await
        .expect("Failed to query pragma")
        .expect("No row returned");

    let fk: i32 = row.try_get("", "foreign_keys").unwrap_or(0);
    assert_eq!(fk, 1, "Foreign keys should be enabled");
}

// ============================================================================
// Repos CRUD Tests
// ============================================================================

#[tokio::test]
async fn test_repos_crud() {
    let db = setup_db().await;
    use han_db::crud::repos;

    // Create
    let repo = repos::upsert(
        &db,
        "https://github.com/test/repo".to_string(),
        "repo".to_string(),
        Some("main".to_string()),
    )
    .await
    .expect("Failed to create repo");

    assert_eq!(repo.remote, "https://github.com/test/repo");
    assert_eq!(repo.name, "repo");
    assert_eq!(repo.default_branch, Some("main".to_string()));

    // Get by remote
    let found = repos::get_by_remote(&db, "https://github.com/test/repo")
        .await
        .expect("Failed to get repo");
    assert!(found.is_some());
    assert_eq!(found.unwrap().name, "repo");

    // Upsert (update)
    let updated = repos::upsert(
        &db,
        "https://github.com/test/repo".to_string(),
        "repo-renamed".to_string(),
        Some("develop".to_string()),
    )
    .await
    .expect("Failed to upsert repo");
    assert_eq!(updated.name, "repo-renamed");

    // List
    let all = repos::list(&db).await.expect("Failed to list repos");
    assert_eq!(all.len(), 1);

    // Not found
    let missing = repos::get_by_remote(&db, "https://github.com/nonexistent")
        .await
        .expect("Should not error");
    assert!(missing.is_none());
}

// ============================================================================
// Projects CRUD Tests
// ============================================================================

#[tokio::test]
async fn test_projects_crud() {
    let db = setup_db().await;
    use han_db::crud::projects;

    // Create
    let project = projects::upsert(
        &db,
        None,
        "test-project".to_string(),
        "/home/user/project".to_string(),
        None,
        "Test Project".to_string(),
        Some(false),
        None,
    )
    .await
    .expect("Failed to create project");

    assert_eq!(project.slug, "test-project");
    assert_eq!(project.name, "Test Project");

    // Get by slug
    let found = projects::get_by_slug(&db, "test-project")
        .await
        .expect("Failed to get by slug");
    assert!(found.is_some());

    // Get by path
    let found = projects::get_by_path(&db, "/home/user/project")
        .await
        .expect("Failed to get by path");
    assert!(found.is_some());

    // List
    let all = projects::list(&db, None).await.expect("Failed to list projects");
    assert_eq!(all.len(), 1);
}

// ============================================================================
// Sessions CRUD Tests
// ============================================================================

#[tokio::test]
async fn test_sessions_crud() {
    let db = setup_db().await;
    use han_db::crud::sessions;

    // Create
    let session = sessions::upsert(
        &db,
        "session-001".to_string(),
        None,
        Some("active".to_string()),
        Some("/tmp/transcript.jsonl".to_string()),
        Some("fancy-session".to_string()),
        None,
    )
    .await
    .expect("Failed to create session");

    assert_eq!(session.id, "session-001");
    assert_eq!(session.status, Some("active".to_string()));
    assert_eq!(session.slug, Some("fancy-session".to_string()));

    // Get
    let found = sessions::get(&db, "session-001")
        .await
        .expect("Failed to get session");
    assert!(found.is_some());

    // End session
    let ended = sessions::end_session(&db, "session-001")
        .await
        .expect("Failed to end session");
    assert!(ended);

    let found = sessions::get(&db, "session-001")
        .await
        .expect("Failed to get session")
        .unwrap();
    assert_eq!(found.status, Some("completed".to_string()));

    // List with filters
    let all = sessions::list(&db, None, None, None, None, None)
        .await
        .expect("Failed to list sessions");
    assert_eq!(all.len(), 1);

    let completed = sessions::list(&db, None, Some("completed"), None, None, None)
        .await
        .expect("Failed to list completed sessions");
    assert_eq!(completed.len(), 1);

    let active = sessions::list(&db, None, Some("active"), None, None, None)
        .await
        .expect("Failed to list active sessions");
    assert_eq!(active.len(), 0);

    // Update indexed line
    let updated = sessions::update_last_indexed_line(&db, "session-001", 42)
        .await
        .expect("Failed to update indexed line");
    assert!(updated);

    // Reset all for reindex
    let reset = sessions::reset_all_for_reindex(&db)
        .await
        .expect("Failed to reset");
    assert_eq!(reset, 1);
}

// ============================================================================
// Config Dirs CRUD Tests
// ============================================================================

#[tokio::test]
async fn test_config_dirs_crud() {
    let db = setup_db().await;
    use han_db::crud::config_dirs;

    // Register
    let dir = config_dirs::register(
        &db,
        "/home/user/.claude".to_string(),
        Some("default".to_string()),
        Some(true),
    )
    .await
    .expect("Failed to register config dir");

    assert_eq!(dir.path, "/home/user/.claude");
    assert_eq!(dir.is_default, 1);

    // Get default
    let default = config_dirs::get_default(&db)
        .await
        .expect("Failed to get default")
        .unwrap();
    assert_eq!(default.path, "/home/user/.claude");

    // Get by path
    let found = config_dirs::get_by_path(&db, "/home/user/.claude")
        .await
        .expect("Failed to get by path");
    assert!(found.is_some());

    // List
    let all = config_dirs::list(&db).await.expect("Failed to list");
    assert_eq!(all.len(), 1);

    // Update indexed
    let updated = config_dirs::update_last_indexed(&db, "/home/user/.claude")
        .await
        .expect("Failed to update");
    assert!(updated);

    // Unregister
    let removed = config_dirs::unregister(&db, "/home/user/.claude")
        .await
        .expect("Failed to unregister");
    assert!(removed);

    let after = config_dirs::list(&db).await.expect("Failed to list");
    assert_eq!(after.len(), 0);
}

// ============================================================================
// Messages CRUD Tests
// ============================================================================

#[tokio::test]
async fn test_messages_crud() {
    let db = setup_db().await;
    use han_db::crud::{messages, sessions};
    use han_db::entities::messages as msg_entity;
    use sea_orm::Set;

    // Create parent session first
    sessions::upsert(
        &db,
        "session-msg".to_string(),
        None,
        Some("active".to_string()),
        None,
        None,
        None,
    )
    .await
    .unwrap();

    // Insert batch
    let msgs = vec![
        msg_entity::ActiveModel {
            id: Set("msg-001".to_string()),
            session_id: Set("session-msg".to_string()),
            agent_id: Set(None),
            parent_id: Set(None),
            message_type: Set("assistant".to_string()),
            role: Set(Some("assistant".to_string())),
            content: Set(Some("Hello, I can help you with that.".to_string())),
            tool_name: Set(None),
            tool_input: Set(None),
            tool_result: Set(None),
            raw_json: Set(None),
            timestamp: Set("2026-02-15T10:00:00Z".to_string()),
            line_number: Set(1),
            source_file_name: Set(None),
            source_file_type: Set(None),
            sentiment_score: Set(None),
            sentiment_level: Set(None),
            frustration_score: Set(None),
            frustration_level: Set(None),
            input_tokens: Set(Some(100)),
            output_tokens: Set(Some(50)),
            cache_read_tokens: Set(Some(10)),
            cache_creation_tokens: Set(None),
            lines_added: Set(None),
            lines_removed: Set(None),
            files_changed: Set(None),
            indexed_at: Set(None),
        },
        msg_entity::ActiveModel {
            id: Set("msg-002".to_string()),
            session_id: Set("session-msg".to_string()),
            agent_id: Set(None),
            parent_id: Set(None),
            message_type: Set("user".to_string()),
            role: Set(Some("user".to_string())),
            content: Set(Some("Please fix the bug in auth module.".to_string())),
            tool_name: Set(None),
            tool_input: Set(None),
            tool_result: Set(None),
            raw_json: Set(None),
            timestamp: Set("2026-02-15T10:01:00Z".to_string()),
            line_number: Set(2),
            source_file_name: Set(None),
            source_file_type: Set(None),
            sentiment_score: Set(None),
            sentiment_level: Set(None),
            frustration_score: Set(None),
            frustration_level: Set(None),
            input_tokens: Set(None),
            output_tokens: Set(None),
            cache_read_tokens: Set(None),
            cache_creation_tokens: Set(None),
            lines_added: Set(None),
            lines_removed: Set(None),
            files_changed: Set(None),
            indexed_at: Set(None),
        },
        msg_entity::ActiveModel {
            id: Set("msg-003".to_string()),
            session_id: Set("session-msg".to_string()),
            agent_id: Set(None),
            parent_id: Set(None),
            message_type: Set("assistant".to_string()),
            role: Set(Some("assistant".to_string())),
            content: Set(Some("I found the authentication bug and fixed it.".to_string())),
            tool_name: Set(Some("Edit".to_string())),
            tool_input: Set(None),
            tool_result: Set(None),
            raw_json: Set(None),
            timestamp: Set("2026-02-15T10:02:00Z".to_string()),
            line_number: Set(3),
            source_file_name: Set(None),
            source_file_type: Set(None),
            sentiment_score: Set(None),
            sentiment_level: Set(None),
            frustration_score: Set(None),
            frustration_level: Set(None),
            input_tokens: Set(Some(200)),
            output_tokens: Set(Some(150)),
            cache_read_tokens: Set(Some(20)),
            cache_creation_tokens: Set(None),
            lines_added: Set(Some(5)),
            lines_removed: Set(Some(3)),
            files_changed: Set(Some(1)),
            indexed_at: Set(None),
        },
    ];

    let inserted = messages::insert_batch(&db, msgs)
        .await
        .expect("Failed to insert batch");
    assert_eq!(inserted, 3);

    // Get by ID
    let msg = messages::get(&db, "msg-001")
        .await
        .expect("Failed to get message")
        .unwrap();
    assert_eq!(msg.message_type, "assistant");

    // List by session
    let all = messages::list_by_session(&db, "session-msg", None, None, None, None, false)
        .await
        .expect("Failed to list messages");
    assert_eq!(all.len(), 3);
    assert_eq!(all[0].line_number, 1); // ASC order

    // List DESC
    let desc = messages::list_by_session(&db, "session-msg", None, None, None, None, true)
        .await
        .expect("Failed to list messages desc");
    assert_eq!(desc[0].line_number, 3); // DESC order

    // Filter by type
    let assistants = messages::list_by_session(
        &db,
        "session-msg",
        None,
        Some(vec!["assistant".to_string()]),
        None,
        None,
        false,
    )
    .await
    .expect("Failed to filter messages");
    assert_eq!(assistants.len(), 2);

    // Count
    let count = messages::get_count(&db, "session-msg")
        .await
        .expect("Failed to count");
    assert_eq!(count, 3);

    // Batch counts
    let counts = messages::get_counts_batch(&db, vec!["session-msg".to_string()])
        .await
        .expect("Failed batch count");
    assert_eq!(counts.len(), 1);
    assert_eq!(counts[0].1, 3);

    // Session timestamps batch
    let timestamps = messages::get_session_timestamps_batch(&db, vec!["session-msg".to_string()])
        .await
        .expect("Failed to get timestamps");
    assert_eq!(timestamps.len(), 1);
    assert_eq!(timestamps[0].0, "session-msg");
    assert!(timestamps[0].1.is_some()); // started_at
    assert!(timestamps[0].2.is_some()); // ended_at
    assert_eq!(timestamps[0].3, 3); // message_count
}

// ============================================================================
// Tasks (Metrics) CRUD Tests
// ============================================================================

#[tokio::test]
async fn test_tasks_crud() {
    let db = setup_db().await;
    use han_db::crud::tasks;

    // Create
    let task = tasks::create(
        &db,
        None,
        "task-001".to_string(),
        "Fix authentication bug".to_string(),
        "bugfix".to_string(),
    )
    .await
    .expect("Failed to create task");

    assert_eq!(task.task_id, "task-001");
    assert_eq!(task.description, "Fix authentication bug");
    assert!(task.completed_at.is_none());

    // Get
    let found = tasks::get(&db, "task-001")
        .await
        .expect("Failed to get task")
        .unwrap();
    assert_eq!(found.task_type, "bugfix");

    // Complete
    let completed = tasks::complete(
        &db,
        "task-001",
        "success".to_string(),
        0.95,
        Some("Fixed the auth issue".to_string()),
        Some(vec!["auth.rs".to_string()]),
        Some(2),
    )
    .await
    .expect("Failed to complete task")
    .unwrap();

    assert_eq!(completed.outcome, Some("success".to_string()));
    assert_eq!(completed.confidence, Some(0.95));
    assert!(completed.completed_at.is_some());

    // Fail a different task
    let _task2 = tasks::create(
        &db,
        None,
        "task-002".to_string(),
        "Refactor module".to_string(),
        "refactor".to_string(),
    )
    .await
    .unwrap();

    let failed = tasks::fail(
        &db,
        "task-002",
        "Dependency issue".to_string(),
        Some(0.3),
        None,
    )
    .await
    .expect("Failed to fail task")
    .unwrap();

    assert_eq!(failed.outcome, Some("failed".to_string()));
    assert!(failed.completed_at.is_some());
}

// ============================================================================
// Native Tasks CRUD Tests
// ============================================================================

#[tokio::test]
async fn test_native_tasks_crud() {
    let db = setup_db().await;
    use han_db::crud::{native_tasks, sessions};

    // Create parent session
    sessions::upsert(
        &db,
        "session-nt".to_string(),
        None,
        Some("active".to_string()),
        None,
        None,
        None,
    )
    .await
    .unwrap();

    // Create task
    let task = native_tasks::create(
        &db,
        "1".to_string(),
        "session-nt".to_string(),
        "msg-100".to_string(),
        "Build the database layer".to_string(),
        Some("Create SeaORM entities".to_string()),
        Some("Building database layer".to_string()),
        "2026-02-15T10:00:00Z".to_string(),
        1,
    )
    .await
    .expect("Failed to create native task");

    assert_eq!(task.subject, "Build the database layer");
    assert_eq!(task.status, "pending");

    // Get
    let found = native_tasks::get(&db, "session-nt", "1")
        .await
        .expect("Failed to get native task")
        .unwrap();
    assert_eq!(found.subject, "Build the database layer");

    // Update with status and blocks
    let updated = native_tasks::update(
        &db,
        "1",
        "session-nt",
        "msg-101".to_string(),
        Some("in_progress".to_string()),
        None,
        None,
        None,
        Some("builder-agent".to_string()),
        Some(vec!["2".to_string(), "3".to_string()]),
        None,
        "2026-02-15T10:05:00Z".to_string(),
        2,
    )
    .await
    .expect("Failed to update native task")
    .unwrap();

    assert_eq!(updated.status, "in_progress");
    assert_eq!(updated.owner, Some("builder-agent".to_string()));
    let blocks: Vec<String> = serde_json::from_str(updated.blocks.as_deref().unwrap()).unwrap();
    assert_eq!(blocks, vec!["2", "3"]);

    // Complete
    let completed = native_tasks::update(
        &db,
        "1",
        "session-nt",
        "msg-102".to_string(),
        Some("completed".to_string()),
        None,
        None,
        None,
        None,
        None,
        None,
        "2026-02-15T10:10:00Z".to_string(),
        3,
    )
    .await
    .expect("Failed to complete")
    .unwrap();

    assert_eq!(completed.status, "completed");
    assert!(completed.completed_at.is_some());

    // Get by session
    let all = native_tasks::get_by_session(&db, "session-nt")
        .await
        .expect("Failed to get by session");
    assert_eq!(all.len(), 1);
}

// ============================================================================
// Hooks CRUD Tests
// ============================================================================

#[tokio::test]
async fn test_hooks_crud() {
    let db = setup_db().await;
    use han_db::crud::hooks;

    // Record execution
    let exec = hooks::record_execution(
        &db,
        None,
        None,
        "Stop".to_string(),
        "biome-check".to_string(),
        Some("biome".to_string()),
        Some("/project".to_string()),
        150,
        0,
        true,
        Some("All checks passed".to_string()),
        None,
        None,
        Some("npx biome check .".to_string()),
    )
    .await
    .expect("Failed to record hook execution");

    assert_eq!(exec.hook_name, "biome-check");
    assert_eq!(exec.passed, 1);
    assert_eq!(exec.duration_ms, 150);
}

// ============================================================================
// Orchestrations CRUD Tests
// ============================================================================

#[tokio::test]
async fn test_orchestrations_crud() {
    let db = setup_db().await;
    use han_db::crud::orchestrations;

    let orch = orchestrations::create(
        &db,
        None,
        "Stop".to_string(),
        "/project".to_string(),
    )
    .await
    .expect("Failed to create orchestration");

    assert_eq!(orch.hook_type, "Stop");
    assert_eq!(orch.total_hooks, 0);
    assert_eq!(orch.status, "pending");

    // Get
    let found = orchestrations::get(&db, &orch.id)
        .await
        .expect("Failed to get")
        .unwrap();
    assert_eq!(found.hook_type, "Stop");

    // Update
    orchestrations::update(
        &db,
        &orch.id,
        Some("running".to_string()),
        Some(5),
        Some(2),
        Some(0),
        Some(1),
    )
    .await
    .expect("Failed to update");

    let updated = orchestrations::get(&db, &orch.id)
        .await
        .expect("Failed to get after update")
        .unwrap();
    assert_eq!(updated.status, "running");
    assert_eq!(updated.total_hooks, 5);
    assert_eq!(updated.completed_hooks, 2);

    // Cancel
    orchestrations::cancel(&db, &orch.id)
        .await
        .expect("Failed to cancel");

    let cancelled = orchestrations::get(&db, &orch.id)
        .await
        .expect("Failed to get after cancel")
        .unwrap();
    assert_eq!(cancelled.status, "cancelled");
}

// ============================================================================
// Async Hooks CRUD Tests
// ============================================================================

#[tokio::test]
async fn test_async_hooks_crud() {
    let db = setup_db().await;
    use han_db::crud::{async_hooks, sessions};

    // Create session
    sessions::upsert(
        &db,
        "session-ah".to_string(),
        None,
        Some("active".to_string()),
        None,
        None,
        None,
    )
    .await
    .unwrap();

    // Enqueue
    let hook = async_hooks::enqueue(
        &db,
        "session-ah".to_string(),
        "/project".to_string(),
        "biome".to_string(),
        "format".to_string(),
        vec!["src/main.ts".to_string()],
        "npx biome format .".to_string(),
    )
    .await
    .expect("Failed to enqueue");

    assert_eq!(hook.status, "pending");

    // List pending
    let pending = async_hooks::list_pending(&db, "session-ah")
        .await
        .expect("Failed to list pending");
    assert_eq!(pending.len(), 1);

    // Queue not empty
    let empty = async_hooks::is_queue_empty(&db, "session-ah")
        .await
        .expect("Failed to check queue");
    assert!(!empty);

    // Complete
    async_hooks::complete(&db, &hook.id, Some("{\"ok\":true}".to_string()))
        .await
        .expect("Failed to complete hook");

    // Queue empty now (no pending/running)
    let empty = async_hooks::is_queue_empty(&db, "session-ah")
        .await
        .expect("Failed to check queue");
    assert!(empty);
}

// ============================================================================
// Session Files CRUD Tests
// ============================================================================

#[tokio::test]
async fn test_session_files_crud() {
    let db = setup_db().await;
    use han_db::crud::{session_files, sessions};

    sessions::upsert(
        &db,
        "session-sf".to_string(),
        None,
        Some("active".to_string()),
        None,
        None,
        None,
    )
    .await
    .unwrap();

    // Upsert
    let sf = session_files::upsert(
        &db,
        "session-sf".to_string(),
        "transcript".to_string(),
        "/tmp/session.jsonl".to_string(),
        None,
    )
    .await
    .expect("Failed to upsert session file");

    assert_eq!(sf.file_type, "transcript");

    // Get by session
    let files = session_files::get_by_session(&db, "session-sf")
        .await
        .expect("Failed to get by session");
    assert_eq!(files.len(), 1);

    // Get by path
    let found = session_files::get_by_path(&db, "/tmp/session.jsonl")
        .await
        .expect("Failed to get by path");
    assert!(found.is_some());

    // Update indexed line
    let updated = session_files::update_indexed_line(&db, "/tmp/session.jsonl", 100)
        .await
        .expect("Failed to update indexed line");
    assert!(updated);
}

// ============================================================================
// FTS5 Search Tests
// ============================================================================

#[tokio::test]
async fn test_fts5_escape() {
    use han_db::search::escape_fts5_query;

    assert_eq!(escape_fts5_query("hello world"), "\"hello\" \"world\"");
    assert_eq!(escape_fts5_query("AND OR NOT"), "\"AND\" \"OR\" \"NOT\"");
    assert_eq!(escape_fts5_query("test*"), "\"test*\"");
    assert_eq!(escape_fts5_query(""), "");
    assert_eq!(escape_fts5_query("  spaced  "), "\"spaced\"");
}

#[tokio::test]
async fn test_fts5_search_messages() {
    let db = setup_db().await;
    use han_db::crud::{messages, sessions};
    use han_db::entities::messages as msg_entity;
    use han_db::search::SqliteSearch;
    use sea_orm::Set;

    // Setup
    sessions::upsert(
        &db,
        "session-fts".to_string(),
        None,
        Some("active".to_string()),
        None,
        None,
        None,
    )
    .await
    .unwrap();

    let msgs = vec![
        msg_entity::ActiveModel {
            id: Set("fts-msg-001".to_string()),
            session_id: Set("session-fts".to_string()),
            agent_id: Set(None),
            parent_id: Set(None),
            message_type: Set("assistant".to_string()),
            role: Set(Some("assistant".to_string())),
            content: Set(Some("The authentication module has a critical bug".to_string())),
            tool_name: Set(None),
            tool_input: Set(None),
            tool_result: Set(None),
            raw_json: Set(None),
            timestamp: Set("2026-02-15T10:00:00Z".to_string()),
            line_number: Set(1),
            source_file_name: Set(None),
            source_file_type: Set(None),
            sentiment_score: Set(None),
            sentiment_level: Set(None),
            frustration_score: Set(None),
            frustration_level: Set(None),
            input_tokens: Set(None),
            output_tokens: Set(None),
            cache_read_tokens: Set(None),
            cache_creation_tokens: Set(None),
            lines_added: Set(None),
            lines_removed: Set(None),
            files_changed: Set(None),
            indexed_at: Set(None),
        },
        msg_entity::ActiveModel {
            id: Set("fts-msg-002".to_string()),
            session_id: Set("session-fts".to_string()),
            agent_id: Set(None),
            parent_id: Set(None),
            message_type: Set("assistant".to_string()),
            role: Set(Some("assistant".to_string())),
            content: Set(Some("The database migration script needs updating".to_string())),
            tool_name: Set(None),
            tool_input: Set(None),
            tool_result: Set(None),
            raw_json: Set(None),
            timestamp: Set("2026-02-15T10:01:00Z".to_string()),
            line_number: Set(2),
            source_file_name: Set(None),
            source_file_type: Set(None),
            sentiment_score: Set(None),
            sentiment_level: Set(None),
            frustration_score: Set(None),
            frustration_level: Set(None),
            input_tokens: Set(None),
            output_tokens: Set(None),
            cache_read_tokens: Set(None),
            cache_creation_tokens: Set(None),
            lines_added: Set(None),
            lines_removed: Set(None),
            files_changed: Set(None),
            indexed_at: Set(None),
        },
    ];

    messages::insert_batch(&db, msgs).await.unwrap();

    let search = SqliteSearch::new(db.clone());

    // Search for authentication
    let results = search
        .search_messages("authentication", None, 10)
        .await
        .expect("FTS search failed");
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].id, "fts-msg-001");
    assert!(results[0].score > 0.0);

    // Search for database
    let results = search
        .search_messages("database", None, 10)
        .await
        .expect("FTS search failed");
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].id, "fts-msg-002");

    // Search with session filter
    let results = search
        .search_messages("authentication", Some("session-fts"), 10)
        .await
        .expect("FTS search with session filter failed");
    assert_eq!(results.len(), 1);

    // Search with wrong session filter
    let results = search
        .search_messages("authentication", Some("other-session"), 10)
        .await
        .expect("FTS search should return empty");
    assert_eq!(results.len(), 0);

    // Empty query returns empty
    let results = search
        .search_messages("", None, 10)
        .await
        .expect("Empty query should succeed");
    assert_eq!(results.len(), 0);
}

// ============================================================================
// Aggregates Tests
// ============================================================================

#[tokio::test]
async fn test_dashboard_aggregates() {
    let db = setup_db().await;
    use han_db::aggregates::query_dashboard_aggregates;
    use han_db::crud::{messages, sessions};
    use han_db::entities::messages as msg_entity;
    use sea_orm::Set;

    // Setup session with messages
    sessions::upsert(
        &db,
        "session-agg".to_string(),
        None,
        Some("active".to_string()),
        None,
        None,
        None,
    )
    .await
    .unwrap();

    let msgs = vec![
        msg_entity::ActiveModel {
            id: Set("agg-msg-001".to_string()),
            session_id: Set("session-agg".to_string()),
            agent_id: Set(None),
            parent_id: Set(None),
            message_type: Set("assistant".to_string()),
            role: Set(Some("assistant".to_string())),
            content: Set(Some("I'll fix that".to_string())),
            tool_name: Set(Some("Edit".to_string())),
            tool_input: Set(None),
            tool_result: Set(None),
            raw_json: Set(None),
            timestamp: Set("2026-02-15T10:00:00Z".to_string()),
            line_number: Set(1),
            source_file_name: Set(None),
            source_file_type: Set(None),
            sentiment_score: Set(None),
            sentiment_level: Set(None),
            frustration_score: Set(None),
            frustration_level: Set(None),
            input_tokens: Set(Some(100)),
            output_tokens: Set(Some(50)),
            cache_read_tokens: Set(Some(10)),
            cache_creation_tokens: Set(None),
            lines_added: Set(None),
            lines_removed: Set(None),
            files_changed: Set(None),
            indexed_at: Set(None),
        },
        msg_entity::ActiveModel {
            id: Set("agg-msg-002".to_string()),
            session_id: Set("session-agg".to_string()),
            agent_id: Set(None),
            parent_id: Set(None),
            message_type: Set("assistant".to_string()),
            role: Set(Some("assistant".to_string())),
            content: Set(Some("Done".to_string())),
            tool_name: Set(Some("Edit".to_string())),
            tool_input: Set(None),
            tool_result: Set(None),
            raw_json: Set(None),
            timestamp: Set("2026-02-15T10:01:00Z".to_string()),
            line_number: Set(2),
            source_file_name: Set(None),
            source_file_type: Set(None),
            sentiment_score: Set(None),
            sentiment_level: Set(None),
            frustration_score: Set(None),
            frustration_level: Set(None),
            input_tokens: Set(Some(200)),
            output_tokens: Set(Some(100)),
            cache_read_tokens: Set(Some(20)),
            cache_creation_tokens: Set(None),
            lines_added: Set(None),
            lines_removed: Set(None),
            files_changed: Set(None),
            indexed_at: Set(None),
        },
    ];

    messages::insert_batch(&db, msgs).await.unwrap();

    let agg = query_dashboard_aggregates(&db, "2020-01-01")
        .await
        .expect("Failed to query dashboard aggregates");

    // Token totals (only counts assistant messages)
    assert_eq!(agg.total_input_tokens, 300);
    assert_eq!(agg.total_output_tokens, 150);
    assert_eq!(agg.total_cache_read_tokens, 30);
    assert_eq!(agg.total_sessions, 1);
    assert_eq!(agg.total_messages, 2);

    // Tool usage
    assert_eq!(agg.tool_usage.len(), 1);
    assert_eq!(agg.tool_usage[0].tool_name, "Edit");
    assert_eq!(agg.tool_usage[0].count, 2);

    // Daily costs
    assert_eq!(agg.daily_costs.len(), 1);
    assert_eq!(agg.daily_costs[0].date, "2026-02-15");
    assert_eq!(agg.daily_costs[0].input_tokens, 300);
}

#[tokio::test]
async fn test_activity_aggregates() {
    let db = setup_db().await;
    use han_db::aggregates::query_activity_aggregates;
    use han_db::crud::{messages, sessions};
    use han_db::entities::messages as msg_entity;
    use sea_orm::Set;

    sessions::upsert(
        &db,
        "session-act".to_string(),
        None,
        Some("active".to_string()),
        None,
        None,
        None,
    )
    .await
    .unwrap();

    let msgs = vec![msg_entity::ActiveModel {
        id: Set("act-msg-001".to_string()),
        session_id: Set("session-act".to_string()),
        agent_id: Set(None),
        parent_id: Set(None),
        message_type: Set("user".to_string()),
        role: Set(Some("user".to_string())),
        content: Set(Some("Fix the thing".to_string())),
        tool_name: Set(None),
        tool_input: Set(None),
        tool_result: Set(None),
        raw_json: Set(None),
        timestamp: Set("2026-02-15T10:00:00Z".to_string()),
        line_number: Set(1),
        source_file_name: Set(None),
        source_file_type: Set(None),
        sentiment_score: Set(None),
        sentiment_level: Set(None),
        frustration_score: Set(None),
        frustration_level: Set(None),
        input_tokens: Set(Some(50)),
        output_tokens: Set(Some(25)),
        cache_read_tokens: Set(Some(5)),
        cache_creation_tokens: Set(None),
        lines_added: Set(Some(10)),
        lines_removed: Set(Some(3)),
        files_changed: Set(Some(2)),
        indexed_at: Set(None),
    }];

    messages::insert_batch(&db, msgs).await.unwrap();

    let agg = query_activity_aggregates(&db, "2020-01-01")
        .await
        .expect("Failed to query activity aggregates");

    assert_eq!(agg.total_messages, 1);
    assert_eq!(agg.total_sessions, 1);
    assert_eq!(agg.total_input_tokens, 50);
    assert_eq!(agg.daily_activity.len(), 1);
    assert_eq!(agg.daily_activity[0].lines_added, 10);
    assert_eq!(agg.hourly_activity.len(), 1);
    assert_eq!(agg.hourly_activity[0].hour, 10); // 10:00 UTC
}

// ============================================================================
// Integration Test Against Real Database (Read-Only)
// ============================================================================

#[tokio::test]
async fn test_read_real_database() {
    // Skip if no real database exists
    let home = std::env::var("HOME").unwrap_or_default();
    let db_path = format!("{}/.han/han.db", home);

    if !std::path::Path::new(&db_path).exists() {
        eprintln!("Skipping real database test: {} not found", db_path);
        return;
    }

    let db = establish_connection(DbConfig::Sqlite {
        path: db_path.clone(),
    })
    .await
    .expect("Failed to connect to real database");

    // Read-only queries only
    use han_db::crud::{repos, sessions};

    // List repos (just verify no error)
    let all_repos = repos::list(&db).await.expect("Failed to list repos from real db");
    eprintln!("Real DB: {} repos found", all_repos.len());

    // List recent sessions
    let recent = sessions::list(&db, None, None, None, Some(5), None)
        .await
        .expect("Failed to list sessions from real db");
    eprintln!("Real DB: {} recent sessions found", recent.len());

    // Query dashboard aggregates
    use han_db::aggregates::query_dashboard_aggregates;
    let agg = query_dashboard_aggregates(&db, "2020-01-01")
        .await
        .expect("Failed to query aggregates from real db");
    eprintln!(
        "Real DB: {} total messages, {} sessions, {} tool types",
        agg.total_messages,
        agg.total_sessions,
        agg.tool_usage.len()
    );
}
