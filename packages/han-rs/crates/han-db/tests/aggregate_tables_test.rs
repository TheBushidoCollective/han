//! Verifies the aggregate tables the dashboard reads actually exist after
//! migration, and that an existing database is backfilled rather than starting
//! empty.
//!
//! The reads in `han-api::query` are raw SQL against these tables, so a column
//! rename in the migration would not fail to compile. These assert the exact
//! shape those queries select.

use han_db::connection::{establish_connection, DbConfig};
use han_db::migration::Migrator;
use sea_orm::{ConnectionTrait, DatabaseConnection, Statement};
use sea_orm_migration::MigratorTrait;

async fn migrated_db() -> DatabaseConnection {
    let db = establish_connection(DbConfig::Sqlite {
        path: ":memory:".to_string(),
    })
    .await
    .expect("connect");
    Migrator::up(&db, None).await.expect("migrate");
    db
}

async fn scalar(db: &DatabaseConnection, sql: &str) -> i64 {
    db.query_one(Statement::from_string(
        db.get_database_backend(),
        sql.to_string(),
    ))
    .await
    .expect("query")
    .expect("row")
    .try_get_by_index::<i64>(0)
    .expect("i64")
}

/// Each of these is the projection a dashboard panel issues. Before the
/// migration they failed with "no such table" and the panel loaded forever.
#[tokio::test]
async fn dashboard_aggregate_reads_resolve() {
    let db = migrated_db().await;

    for sql in [
        "SELECT date, session_count, message_count, input_tokens, output_tokens, \
         cache_read_tokens AS cached_tokens, lines_added, lines_removed, files_changed \
         FROM daily_aggregates",
        "SELECT hour, session_count, message_count FROM hourly_aggregates ORDER BY hour",
        "SELECT total_sessions, total_messages, total_input_tokens, total_output_tokens, \
         total_cache_read_tokens FROM global_aggregates WHERE id = 1",
    ] {
        db.execute(Statement::from_string(
            db.get_database_backend(),
            sql.to_string(),
        ))
        .await
        .unwrap_or_else(|e| panic!("dashboard read failed: {sql}\n{e}"));
    }
}

/// The activity aggregates sum these three columns straight off `messages`.
/// Long-lived databases were created by hand-written SQL that never had them,
/// so the backfill failed with "no such column: lines_added".
#[tokio::test]
async fn messages_carries_the_change_tracking_columns() {
    let db = migrated_db().await;

    for column in ["lines_added", "lines_removed", "files_changed"] {
        db.execute(Statement::from_string(
            db.get_database_backend(),
            format!("SELECT COALESCE(SUM({column}), 0) FROM messages"),
        ))
        .await
        .unwrap_or_else(|e| panic!("messages.{column} missing: {e}"));
    }
}
/// The writer uses INSERT OR REPLACE keyed on date/hour/id, which silently
/// duplicates rows if those columns are not primary keys.
#[tokio::test]
async fn repeated_writes_collapse_onto_their_keys() {
    let db = migrated_db().await;

    for _ in 0..2 {
        db.execute_unprepared(
            "INSERT OR REPLACE INTO daily_aggregates (date, message_count) VALUES ('2026-08-12', 5)",
        )
        .await
        .expect("daily write");
        db.execute_unprepared(
            "INSERT OR REPLACE INTO hourly_aggregates (hour, message_count) VALUES (9, 5)",
        )
        .await
        .expect("hourly write");
        db.execute_unprepared(
            "INSERT OR REPLACE INTO global_aggregates (id, total_sessions) VALUES (1, 5)",
        )
        .await
        .expect("global write");
    }

    assert_eq!(
        scalar(&db, "SELECT COUNT(*) FROM daily_aggregates").await,
        1
    );
    assert_eq!(
        scalar(&db, "SELECT COUNT(*) FROM hourly_aggregates").await,
        1
    );
    assert_eq!(
        scalar(&db, "SELECT COUNT(*) FROM global_aggregates").await,
        1
    );
}
/// A database that already holds messages must end up with history, not with
/// empty panels until the next session happens to be indexed.
#[tokio::test]
async fn existing_messages_are_backfilled() {
    let db = migrated_db().await;
    db.execute_unprepared(
        "INSERT INTO projects (id, slug, path, name, created_at, updated_at) \
         VALUES ('p1', 'backfill-fixture', '/tmp/backfill-fixture', 'backfill-fixture', \
                 datetime('now'), datetime('now'))",
    )
    .await
    .expect("seed project");
    db.execute_unprepared(
        "INSERT INTO sessions (id, project_id, status) VALUES ('s-backfill', 'p1', 'active')",
    )
    .await
    .expect("seed session");
    db.execute_unprepared(
        "INSERT INTO messages \
            (id, session_id, message_type, line_number, timestamp, input_tokens, output_tokens) \
         VALUES ('m1', 's-backfill', 'assistant', 1, '2026-08-12T09:00:00Z', 100, 20), \
                ('m2', 's-backfill', 'assistant', 2, '2026-08-12T09:30:00Z', 200, 30)",
    )
    .await
    .expect("seed messages");

    assert!(
        han_indexer::backfill_aggregates_if_empty(&db)
            .await
            .expect("backfill"),
        "an unfilled database should report that it did the work"
    );

    assert_eq!(
        scalar(&db, "SELECT COUNT(*) FROM daily_aggregates").await,
        1,
        "the seeded messages share one local date"
    );
    assert_eq!(
        scalar(&db, "SELECT SUM(message_count) FROM daily_aggregates").await,
        2
    );
    assert_eq!(
        scalar(&db, "SELECT SUM(input_tokens) FROM daily_aggregates").await,
        300
    );
    assert_eq!(
        scalar(
            &db,
            "SELECT total_messages FROM global_aggregates WHERE id = 1"
        )
        .await,
        2
    );

    // Second run must be a no-op rather than double counting.
    assert!(
        !han_indexer::backfill_aggregates_if_empty(&db)
            .await
            .expect("second backfill"),
        "an already filled database should skip the rebuild"
    );
    assert_eq!(
        scalar(&db, "SELECT SUM(message_count) FROM daily_aggregates").await,
        2
    );
}
