//! End-to-end ingestion of a bridged harness's session.
//!
//! A bridged harness writes only a `*-han.jsonl` events file, with no native
//! transcript beside it. Before this path existed the indexer dropped those
//! files entirely, so no harness other than Claude Code could ever appear in
//! the database. These tests hold that door open.

use han_db::connection::{establish_connection, DbConfig};
use han_db::migration::Migrator;
use han_indexer::{harness_from_path, index_project_directory};
use sea_orm::{DatabaseConnection, EntityTrait};
use sea_orm_migration::MigratorTrait;
use std::path::{Path, PathBuf};

async fn setup_db() -> DatabaseConnection {
    let db = establish_connection(DbConfig::Sqlite {
        path: ":memory:".to_string(),
    })
    .await
    .expect("connect to in-memory sqlite");
    Migrator::up(&db, None).await.expect("run migrations");
    db
}

const SESSION_ID: &str = "abc12345-1234-5678-9abc-def012345678";

/// Write a bridged harness's events file and return its project directory.
fn write_bridge_session(root: &Path, harness: &str, lines: &[String]) -> PathBuf {
    let project_dir = root
        .join(".han")
        .join(harness)
        .join("projects")
        .join("-Users-me-proj");
    std::fs::create_dir_all(&project_dir).expect("create project dir");
    std::fs::write(
        project_dir.join(format!("{}-han.jsonl", SESSION_ID)),
        lines.join("\n"),
    )
    .expect("write events file");
    project_dir
}

fn event(event_type: &str, harness: &str, data: serde_json::Value) -> String {
    serde_json::json!({
        "uuid": format!("{}-{}", event_type, harness),
        "sessionId": SESSION_ID,
        "type": event_type,
        "timestamp": "2026-08-12T00:00:00.000Z",
        "harness": harness,
        "data": data,
    })
    .to_string()
}

#[tokio::test]
async fn indexes_a_standalone_han_events_file_as_its_own_session() {
    let db = setup_db().await;
    let tmp = tempfile::tempdir().expect("tempdir");

    let project_dir = write_bridge_session(
        tmp.path(),
        "omp",
        &[event(
            "hook_run",
            "omp",
            serde_json::json!({
                "plugin": "core",
                "hook": "lint",
                "hook_type": "Stop",
                "directory": ".",
                "cached": false,
            }),
        )],
    );

    let results = index_project_directory(&db, &project_dir.to_string_lossy(), None)
        .await
        .expect("index project directory");

    assert_eq!(results.len(), 1, "the events file should be indexed once");
    assert_eq!(results[0].session_id, SESSION_ID);

    let session = han_db::entities::sessions::Entity::find_by_id(SESSION_ID)
        .one(&db)
        .await
        .expect("query session")
        .expect("session row exists");
    assert_eq!(session.harness.as_deref(), Some("omp"));
}

#[tokio::test]
async fn token_usage_events_populate_the_token_columns() {
    let db = setup_db().await;
    let tmp = tempfile::tempdir().expect("tempdir");

    let project_dir = write_bridge_session(
        tmp.path(),
        "omp",
        &[event(
            "token_usage",
            "omp",
            serde_json::json!({
                "model": "claude-sonnet-4-5",
                "provider": "anthropic",
                "input_tokens": 1200,
                "output_tokens": 340,
                "cache_read_tokens": 50,
                "cache_creation_tokens": 7,
                "cost_usd": 0.0123,
            }),
        )],
    );

    index_project_directory(&db, &project_dir.to_string_lossy(), None)
        .await
        .expect("index project directory");

    let messages = han_db::entities::messages::Entity::find()
        .all(&db)
        .await
        .expect("query messages");

    let usage = messages
        .iter()
        .find(|m| m.tool_name.as_deref() == Some("token_usage"))
        .unwrap_or_else(|| {
            panic!(
                "token_usage row not indexed; rows present: {:?}",
                messages
                    .iter()
                    .map(|m| (m.message_type.clone(), m.tool_name.clone()))
                    .collect::<Vec<_>>()
            )
        });

    // Without this lift the counts stay in opaque JSON and no cost or token
    // aggregate can see a bridged harness at all.
    assert_eq!(usage.input_tokens, Some(1200));
    assert_eq!(usage.output_tokens, Some(340));
    assert_eq!(usage.cache_read_tokens, Some(50));
    assert_eq!(usage.cache_creation_tokens, Some(7));
}

#[tokio::test]
async fn each_harness_is_attributed_separately() {
    let _db = setup_db().await;
    let tmp = tempfile::tempdir().expect("tempdir");

    for harness in ["omp", "kiro", "codex"] {
        let project_dir = write_bridge_session(
            tmp.path(),
            harness,
            &[event("hook_run", harness, serde_json::json!({}))],
        );
        // Each harness root holds a session id unique to it, so derive one.
        let path = project_dir.join(format!("{}-han.jsonl", SESSION_ID));
        assert_eq!(harness_from_path(&path), harness);
    }
}

#[tokio::test]
async fn a_han_events_file_beside_a_transcript_is_not_a_separate_session() {
    let db = setup_db().await;
    let tmp = tempfile::tempdir().expect("tempdir");

    // Claude Code's layout: native transcript plus a sibling events file.
    let project_dir = tmp.path().join(".claude/projects/-Users-me-proj");
    std::fs::create_dir_all(&project_dir).expect("create project dir");
    std::fs::write(
        project_dir.join(format!("{}.jsonl", SESSION_ID)),
        serde_json::json!({
            "type": "user",
            "uuid": "u1",
            "sessionId": SESSION_ID,
            "timestamp": "2026-08-12T00:00:00.000Z",
            "message": { "role": "user", "content": "hi" },
        })
        .to_string(),
    )
    .expect("write transcript");
    std::fs::write(
        project_dir.join(format!("{}-han.jsonl", SESSION_ID)),
        event("hook_run", "claude-code", serde_json::json!({})),
    )
    .expect("write events file");

    let results = index_project_directory(&db, &project_dir.to_string_lossy(), None)
        .await
        .expect("index project directory");

    assert_eq!(
        results.len(),
        1,
        "the transcript is indexed once and reads its own events file; the \
         events file must not also be indexed as a second session"
    );

    let session = han_db::entities::sessions::Entity::find_by_id(SESSION_ID)
        .one(&db)
        .await
        .expect("query session")
        .expect("session row exists");
    assert_eq!(session.harness.as_deref(), Some("claude-code"));
}
