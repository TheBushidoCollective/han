//! CRUD operations for Han's unified data store (SQLite)
//!
//! Provides database operations for repos, projects, sessions, tasks,
//! hook cache, and marketplace cache.
//!
//! IMPORTANT: All database access MUST go through the coordinator.

use crate::db;
use crate::schema::*;
use napi_derive::napi;
use rusqlite::params;
use uuid::Uuid;

// ============================================================================
// Repo Operations
// ============================================================================

pub fn upsert_repo(input: RepoInput) -> napi::Result<Repo> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // Use RETURNING to get the inserted/updated row in one query (avoids re-entrancy deadlock)
    let mut stmt = conn
        .prepare(
            "INSERT INTO repos (id, remote, name, default_branch, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)
         ON CONFLICT(remote) DO UPDATE SET
             name = excluded.name,
             default_branch = excluded.default_branch,
             updated_at = excluded.updated_at
         RETURNING id, remote, name, default_branch, created_at, updated_at",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare upsert: {}", e)))?;

    stmt.query_row(
        params![id, input.remote, input.name, input.default_branch, now],
        |row| {
            Ok(Repo {
                id: Some(row.get(0)?),
                remote: row.get(1)?,
                name: row.get(2)?,
                default_branch: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        },
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to upsert repo: {}", e)))
}

pub fn get_repo_by_remote(remote: &str) -> napi::Result<Option<Repo>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, remote, name, default_branch, created_at, updated_at
         FROM repos WHERE remote = ?1 LIMIT 1",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row(params![remote], |row| {
        Ok(Repo {
            id: Some(row.get(0)?),
            remote: row.get(1)?,
            name: row.get(2)?,
            default_branch: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    });

    match result {
        Ok(repo) => Ok(Some(repo)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!(
            "Failed to get repo: {}",
            e
        ))),
    }
}

pub fn list_repos() -> napi::Result<Vec<Repo>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, remote, name, default_branch, created_at, updated_at
         FROM repos ORDER BY name ASC",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Repo {
                id: Some(row.get(0)?),
                remote: row.get(1)?,
                name: row.get(2)?,
                default_branch: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| napi::Error::from_reason(format!("Failed to list repos: {}", e)))?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

// ============================================================================
// Project Operations
// ============================================================================

pub fn upsert_project(input: ProjectInput) -> napi::Result<Project> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let is_worktree = input.is_worktree.unwrap_or(false) as i32;

    // Use RETURNING to get the inserted/updated row in one query (avoids re-entrancy deadlock)
    let mut stmt = conn.prepare(
        "INSERT INTO projects (id, repo_id, slug, path, relative_path, name, is_worktree, source_config_dir, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
         ON CONFLICT(slug) DO UPDATE SET
             repo_id = excluded.repo_id,
             path = excluded.path,
             relative_path = excluded.relative_path,
             name = excluded.name,
             is_worktree = excluded.is_worktree,
             source_config_dir = COALESCE(excluded.source_config_dir, projects.source_config_dir),
             updated_at = excluded.updated_at
         RETURNING id, repo_id, slug, path, relative_path, name, is_worktree, source_config_dir, created_at, updated_at"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare upsert: {}", e)))?;

    stmt.query_row(
        params![
            id,
            input.repo_id,
            input.slug,
            input.path,
            input.relative_path,
            input.name,
            is_worktree,
            input.source_config_dir,
            now
        ],
        |row| {
            Ok(Project {
                id: Some(row.get(0)?),
                repo_id: row.get(1)?,
                slug: row.get(2)?,
                path: row.get(3)?,
                relative_path: row.get(4)?,
                name: row.get(5)?,
                is_worktree: row.get::<_, i32>(6)? != 0,
                source_config_dir: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        },
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to upsert project: {}", e)))
}

pub fn get_project_by_slug(slug: &str) -> napi::Result<Option<Project>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, repo_id, slug, path, relative_path, name, is_worktree, source_config_dir, created_at, updated_at
         FROM projects WHERE slug = ?1 LIMIT 1"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row(params![slug], |row| {
        Ok(Project {
            id: Some(row.get(0)?),
            repo_id: row.get(1)?,
            slug: row.get(2)?,
            path: row.get(3)?,
            relative_path: row.get(4)?,
            name: row.get(5)?,
            is_worktree: row.get::<_, i32>(6)? != 0,
            source_config_dir: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    });

    match result {
        Ok(project) => Ok(Some(project)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!(
            "Failed to get project: {}",
            e
        ))),
    }
}

pub fn get_project_by_path(path: &str) -> napi::Result<Option<Project>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, repo_id, slug, path, relative_path, name, is_worktree, source_config_dir, created_at, updated_at
         FROM projects WHERE path = ?1 LIMIT 1"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row(params![path], |row| {
        Ok(Project {
            id: Some(row.get(0)?),
            repo_id: row.get(1)?,
            slug: row.get(2)?,
            path: row.get(3)?,
            relative_path: row.get(4)?,
            name: row.get(5)?,
            is_worktree: row.get::<_, i32>(6)? != 0,
            source_config_dir: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    });

    match result {
        Ok(project) => Ok(Some(project)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!(
            "Failed to get project: {}",
            e
        ))),
    }
}

pub fn list_projects(repo_id: Option<String>) -> napi::Result<Vec<Project>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Use a helper function to map rows to Projects
    fn map_row(row: &rusqlite::Row) -> rusqlite::Result<Project> {
        Ok(Project {
            id: Some(row.get(0)?),
            repo_id: row.get(1)?,
            slug: row.get(2)?,
            path: row.get(3)?,
            relative_path: row.get(4)?,
            name: row.get(5)?,
            is_worktree: row.get::<_, i32>(6)? != 0,
            source_config_dir: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    }

    if let Some(ref rid) = repo_id {
        let mut stmt = conn.prepare(
            "SELECT id, repo_id, slug, path, relative_path, name, is_worktree, source_config_dir, created_at, updated_at
             FROM projects WHERE repo_id = ?1 ORDER BY name ASC"
        ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

        let rows: Vec<Project> = stmt
            .query_map(params![rid], map_row)
            .map_err(|e| napi::Error::from_reason(format!("Failed to list projects: {}", e)))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(rows)
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, repo_id, slug, path, relative_path, name, is_worktree, source_config_dir, created_at, updated_at
             FROM projects ORDER BY name ASC"
        ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

        let rows: Vec<Project> = stmt
            .query_map([], map_row)
            .map_err(|e| napi::Error::from_reason(format!("Failed to list projects: {}", e)))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(rows)
    }
}

// ============================================================================
// Session Operations
// ============================================================================

pub fn upsert_session(input: SessionInput) -> napi::Result<Session> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let status = input.status.unwrap_or_else(|| "active".to_string());

    // id IS the session UUID - no separate session_id column
    // No timestamps stored - derived from messages
    let mut stmt = conn
        .prepare(
            "INSERT INTO sessions (id, project_id, status, transcript_path, slug, source_config_dir)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
             project_id = COALESCE(excluded.project_id, sessions.project_id),
             status = excluded.status,
             transcript_path = COALESCE(excluded.transcript_path, sessions.transcript_path),
             slug = COALESCE(excluded.slug, sessions.slug),
             source_config_dir = COALESCE(excluded.source_config_dir, sessions.source_config_dir)
         RETURNING id, project_id, status, transcript_path, slug, source_config_dir, last_indexed_line",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare upsert: {}", e)))?;

    stmt.query_row(
        params![
            input.id,
            input.project_id,
            status,
            input.transcript_path,
            input.slug,
            input.source_config_dir
        ],
        |row| {
            Ok(Session {
                id: row.get(0)?,
                project_id: row.get(1)?,
                status: row.get(2)?,
                transcript_path: row.get(3)?,
                slug: row.get(4)?,
                source_config_dir: row.get(5)?,
                last_indexed_line: row.get(6)?,
            })
        },
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to upsert session: {}", e)))
}

pub fn end_session(session_id: &str) -> napi::Result<bool> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Sessions table uses 'id' as primary key and has 'status' column
    // Timestamps are derived from messages table, not stored in sessions
    conn.execute(
        "UPDATE sessions SET status = 'completed' WHERE id = ?1",
        params![session_id],
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to end session: {}", e)))?;

    Ok(true)
}

pub fn get_session(session_id: &str) -> napi::Result<Option<Session>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // id IS the session UUID - query by id directly
    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, status, transcript_path, slug, source_config_dir, last_indexed_line
         FROM sessions WHERE id = ?1 LIMIT 1",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row(params![session_id], |row| {
        Ok(Session {
            id: row.get(0)?,
            project_id: row.get(1)?,
            status: row.get(2)?,
            transcript_path: row.get(3)?,
            slug: row.get(4)?,
            source_config_dir: row.get(5)?,
            last_indexed_line: row.get(6)?,
        })
    });

    match result {
        Ok(session) => Ok(Some(session)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!(
            "Failed to get session: {}",
            e
        ))),
    }
}

/// Ensure a session exists in the database (INSERT OR IGNORE).
/// This is called before inserting records that reference sessions (hook executions, file validations)
/// to avoid foreign key constraint violations.
fn ensure_session_exists(
    conn: &rusqlite::Connection,
    session_id: &str,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT OR IGNORE INTO sessions (id, status) VALUES (?1, 'active')",
        params![session_id],
    )?;
    Ok(())
}

pub fn list_sessions(
    project_id: Option<String>,
    status: Option<String>,
    limit: Option<u32>,
) -> napi::Result<Vec<Session>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;
    let limit_val = limit.unwrap_or(100);

    // Join with messages to get max timestamp for sorting
    // Sessions are ordered by most recent message timestamp (descending)
    let sql = match (&project_id, &status) {
        (Some(_), Some(_)) => {
            "SELECT s.id, s.project_id, s.status, s.transcript_path, s.slug, s.source_config_dir, s.last_indexed_line
             FROM sessions s
             LEFT JOIN (SELECT session_id, MAX(timestamp) as max_ts FROM messages GROUP BY session_id) m
             ON s.id = m.session_id
             WHERE s.project_id = ?1 AND s.status = ?2
             ORDER BY m.max_ts DESC NULLS LAST
             LIMIT ?3"
        }
        (Some(_), None) => {
            "SELECT s.id, s.project_id, s.status, s.transcript_path, s.slug, s.source_config_dir, s.last_indexed_line
             FROM sessions s
             LEFT JOIN (SELECT session_id, MAX(timestamp) as max_ts FROM messages GROUP BY session_id) m
             ON s.id = m.session_id
             WHERE s.project_id = ?1
             ORDER BY m.max_ts DESC NULLS LAST
             LIMIT ?2"
        }
        (None, Some(_)) => {
            "SELECT s.id, s.project_id, s.status, s.transcript_path, s.slug, s.source_config_dir, s.last_indexed_line
             FROM sessions s
             LEFT JOIN (SELECT session_id, MAX(timestamp) as max_ts FROM messages GROUP BY session_id) m
             ON s.id = m.session_id
             WHERE s.status = ?1
             ORDER BY m.max_ts DESC NULLS LAST
             LIMIT ?2"
        }
        (None, None) => {
            "SELECT s.id, s.project_id, s.status, s.transcript_path, s.slug, s.source_config_dir, s.last_indexed_line
             FROM sessions s
             LEFT JOIN (SELECT session_id, MAX(timestamp) as max_ts FROM messages GROUP BY session_id) m
             ON s.id = m.session_id
             ORDER BY m.max_ts DESC NULLS LAST
             LIMIT ?1"
        }
    };

    let mut stmt = conn
        .prepare(sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let map_row = |row: &rusqlite::Row| -> rusqlite::Result<Session> {
        Ok(Session {
            id: row.get(0)?,
            project_id: row.get(1)?,
            status: row.get(2)?,
            transcript_path: row.get(3)?,
            slug: row.get(4)?,
            source_config_dir: row.get(5)?,
            last_indexed_line: row.get(6)?,
        })
    };

    let rows: Vec<Session> = match (&project_id, &status) {
        (Some(pid), Some(s)) => stmt
            .query_map(params![pid, s, limit_val], map_row)
            .map_err(|e| napi::Error::from_reason(format!("Failed to list sessions: {}", e)))?
            .filter_map(|r| r.ok())
            .collect(),
        (Some(pid), None) => stmt
            .query_map(params![pid, limit_val], map_row)
            .map_err(|e| napi::Error::from_reason(format!("Failed to list sessions: {}", e)))?
            .filter_map(|r| r.ok())
            .collect(),
        (None, Some(s)) => stmt
            .query_map(params![s, limit_val], map_row)
            .map_err(|e| napi::Error::from_reason(format!("Failed to list sessions: {}", e)))?
            .filter_map(|r| r.ok())
            .collect(),
        (None, None) => stmt
            .query_map(params![limit_val], map_row)
            .map_err(|e| napi::Error::from_reason(format!("Failed to list sessions: {}", e)))?
            .filter_map(|r| r.ok())
            .collect(),
    };

    Ok(rows)
}

/// Update the last indexed line for a session
pub fn update_last_indexed_line(session_id: &str, line_number: i32) -> napi::Result<bool> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // session_id IS the id (primary key)
    conn.execute(
        "UPDATE sessions SET last_indexed_line = ?1 WHERE id = ?2",
        params![line_number, session_id],
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to update last indexed line: {}", e)))?;

    Ok(true)
}

/// Reset all sessions for re-indexing
/// Sets last_indexed_line to 0 so all messages will be re-processed
pub fn reset_all_sessions_for_reindex() -> napi::Result<u32> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let count = conn
        .execute("UPDATE sessions SET last_indexed_line = 0", [])
        .map_err(|e| napi::Error::from_reason(format!("Failed to reset sessions: {}", e)))?;

    Ok(count as u32)
}

// ============================================================================
// Config Dir Registry Operations (Multi-Environment Support)
// ============================================================================

/// Register a new config directory for multi-environment indexing
/// Note: Exported via wrapper in lib.rs (not directly via #[napi] here to avoid duplicate exports)
pub fn register_config_dir(input: ConfigDirInput) -> napi::Result<ConfigDir> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let is_default = input.is_default.unwrap_or(false);

    let mut stmt = conn
        .prepare(
            "INSERT INTO config_dirs (id, path, name, registered_at, is_default)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(path) DO UPDATE SET
                 name = COALESCE(excluded.name, config_dirs.name),
                 is_default = excluded.is_default
             RETURNING id, path, name, registered_at, last_indexed_at, session_count, is_default",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare insert: {}", e)))?;

    stmt.query_row(
        params![id, input.path, input.name, now, is_default],
        |row| {
            Ok(ConfigDir {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                registered_at: row.get(3)?,
                last_indexed_at: row.get(4)?,
                session_count: row.get(5)?,
                is_default: row.get(6)?,
            })
        },
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to register config dir: {}", e)))
}

/// Get a config directory by path
/// Note: Exported via wrapper in lib.rs
pub fn get_config_dir_by_path(path: String) -> napi::Result<Option<ConfigDir>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, path, name, registered_at, last_indexed_at, session_count, is_default
             FROM config_dirs WHERE path = ?1 LIMIT 1",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row(params![path], |row| {
        Ok(ConfigDir {
            id: row.get(0)?,
            path: row.get(1)?,
            name: row.get(2)?,
            registered_at: row.get(3)?,
            last_indexed_at: row.get(4)?,
            session_count: row.get(5)?,
            is_default: row.get(6)?,
        })
    });

    match result {
        Ok(config_dir) => Ok(Some(config_dir)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!(
            "Failed to get config dir: {}",
            e
        ))),
    }
}

/// List all registered config directories
// Note: Exported via lib.rs wrapper
pub fn list_config_dirs() -> napi::Result<Vec<ConfigDir>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, path, name, registered_at, last_indexed_at, session_count, is_default
             FROM config_dirs ORDER BY is_default DESC, registered_at ASC",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ConfigDir {
                id: row.get(0)?,
                path: row.get(1)?,
                name: row.get(2)?,
                registered_at: row.get(3)?,
                last_indexed_at: row.get(4)?,
                session_count: row.get(5)?,
                is_default: row.get(6)?,
            })
        })
        .map_err(|e| napi::Error::from_reason(format!("Failed to list config dirs: {}", e)))?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

/// Update the last indexed timestamp for a config directory
// Note: Exported via lib.rs wrapper
pub fn update_config_dir_last_indexed(path: String) -> napi::Result<bool> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let now = chrono::Utc::now().to_rfc3339();

    // Also update session count
    conn.execute(
        "UPDATE config_dirs SET
            last_indexed_at = ?1,
            session_count = (SELECT COUNT(*) FROM sessions WHERE source_config_dir = config_dirs.path)
         WHERE path = ?2",
        params![now, path],
    )
    .map_err(|e| {
        napi::Error::from_reason(format!("Failed to update config dir last indexed: {}", e))
    })?;

    Ok(true)
}

/// Remove a config directory from the registry
// Note: Exported via lib.rs wrapper
pub fn unregister_config_dir(path: String) -> napi::Result<bool> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let count = conn
        .execute("DELETE FROM config_dirs WHERE path = ?1", params![path])
        .map_err(|e| napi::Error::from_reason(format!("Failed to unregister config dir: {}", e)))?;

    Ok(count > 0)
}

/// Get the default config directory
// Note: Exported via lib.rs wrapper
pub fn get_default_config_dir() -> napi::Result<Option<ConfigDir>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, path, name, registered_at, last_indexed_at, session_count, is_default
             FROM config_dirs WHERE is_default = 1 LIMIT 1",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row([], |row| {
        Ok(ConfigDir {
            id: row.get(0)?,
            path: row.get(1)?,
            name: row.get(2)?,
            registered_at: row.get(3)?,
            last_indexed_at: row.get(4)?,
            session_count: row.get(5)?,
            is_default: row.get(6)?,
        })
    });

    match result {
        Ok(config_dir) => Ok(Some(config_dir)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!(
            "Failed to get default config dir: {}",
            e
        ))),
    }
}

// ============================================================================
// Session File Operations
// ============================================================================

/// Upsert a session file record
pub fn upsert_session_file(
    session_id: &str,
    file_type: &str,
    file_path: &str,
    agent_id: Option<&str>,
) -> napi::Result<bool> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO session_files (id, session_id, file_type, file_path, agent_id, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(file_path) DO UPDATE SET
             session_id = excluded.session_id,
             file_type = excluded.file_type,
             agent_id = excluded.agent_id",
        params![id, session_id, file_type, file_path, agent_id, now],
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to upsert session file: {}", e)))?;

    Ok(true)
}

/// Get session files for a session
#[allow(dead_code)] // Reserved for future session file tracking API
pub fn get_session_files(session_id: &str) -> napi::Result<Vec<SessionFile>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, file_type, file_path, agent_id, last_indexed_line, last_indexed_at, created_at
             FROM session_files WHERE session_id = ?1 ORDER BY created_at ASC",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let rows = stmt
        .query_map(params![session_id], |row| {
            Ok(SessionFile {
                id: row.get(0)?,
                session_id: row.get(1)?,
                file_type: row.get(2)?,
                file_path: row.get(3)?,
                agent_id: row.get(4)?,
                last_indexed_line: row.get(5)?,
                last_indexed_at: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| napi::Error::from_reason(format!("Failed to query session files: {}", e)))?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

/// Get session file by path
#[allow(dead_code)] // Reserved for future session file tracking API
pub fn get_session_file_by_path(file_path: &str) -> napi::Result<Option<SessionFile>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, file_type, file_path, agent_id, last_indexed_line, last_indexed_at, created_at
             FROM session_files WHERE file_path = ?1 LIMIT 1",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row(params![file_path], |row| {
        Ok(SessionFile {
            id: row.get(0)?,
            session_id: row.get(1)?,
            file_type: row.get(2)?,
            file_path: row.get(3)?,
            agent_id: row.get(4)?,
            last_indexed_line: row.get(5)?,
            last_indexed_at: row.get(6)?,
            created_at: row.get(7)?,
        })
    });

    match result {
        Ok(sf) => Ok(Some(sf)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!(
            "Failed to get session file: {}",
            e
        ))),
    }
}

/// Update last indexed line for a session file
#[allow(dead_code)] // Reserved for future session file tracking API
pub fn update_session_file_indexed_line(file_path: &str, line_number: u32) -> napi::Result<bool> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE session_files SET last_indexed_line = ?1, last_indexed_at = ?2 WHERE file_path = ?3",
        params![line_number, now, file_path],
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to update session file: {}", e)))?;

    Ok(true)
}

// ============================================================================
// Session Summary Operations (event-sourced)
// ============================================================================

/// Upsert a session summary - only if this one is newer than existing
pub fn upsert_session_summary(input: SessionSummaryInput) -> napi::Result<SessionSummary> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let now = chrono::Utc::now().to_rfc3339();

    // UPSERT - only update if new timestamp is >= existing timestamp
    let mut stmt = conn.prepare(
        "INSERT INTO session_summaries (id, session_id, message_id, content, raw_json, timestamp, line_number, indexed_at)
         VALUES (?1, ?2, ?1, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(session_id) DO UPDATE SET
             id = CASE WHEN excluded.timestamp >= session_summaries.timestamp THEN excluded.id ELSE session_summaries.id END,
             message_id = CASE WHEN excluded.timestamp >= session_summaries.timestamp THEN excluded.message_id ELSE session_summaries.message_id END,
             content = CASE WHEN excluded.timestamp >= session_summaries.timestamp THEN excluded.content ELSE session_summaries.content END,
             raw_json = CASE WHEN excluded.timestamp >= session_summaries.timestamp THEN excluded.raw_json ELSE session_summaries.raw_json END,
             timestamp = CASE WHEN excluded.timestamp >= session_summaries.timestamp THEN excluded.timestamp ELSE session_summaries.timestamp END,
             line_number = CASE WHEN excluded.timestamp >= session_summaries.timestamp THEN excluded.line_number ELSE session_summaries.line_number END,
             indexed_at = excluded.indexed_at
         RETURNING id, session_id, message_id, content, raw_json, timestamp, line_number, indexed_at"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare upsert: {}", e)))?;

    stmt.query_row(
        params![
            input.message_id,
            input.session_id,
            input.content,
            input.raw_json,
            input.timestamp,
            input.line_number,
            now
        ],
        |row| {
            Ok(SessionSummary {
                id: row.get(0)?,
                session_id: row.get(1)?,
                message_id: row.get(2)?,
                content: row.get(3)?,
                raw_json: row.get(4)?,
                timestamp: row.get(5)?,
                line_number: row.get(6)?,
                indexed_at: row.get(7)?,
            })
        },
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to upsert session summary: {}", e)))
}

/// Get session summary by session ID
pub fn get_session_summary(session_id: &str) -> napi::Result<Option<SessionSummary>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, session_id, message_id, content, raw_json, timestamp, line_number, indexed_at
         FROM session_summaries WHERE session_id = ?1 LIMIT 1"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row(params![session_id], |row| {
        Ok(SessionSummary {
            id: row.get(0)?,
            session_id: row.get(1)?,
            message_id: row.get(2)?,
            content: row.get(3)?,
            raw_json: row.get(4)?,
            timestamp: row.get(5)?,
            line_number: row.get(6)?,
            indexed_at: row.get(7)?,
        })
    });

    match result {
        Ok(summary) => Ok(Some(summary)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!(
            "Failed to get session summary: {}",
            e
        ))),
    }
}

// ============================================================================
// Session Compact Operations (event-sourced)
// ============================================================================

/// Upsert a session compact - only if this one is newer than existing
pub fn upsert_session_compact(input: SessionCompactInput) -> napi::Result<SessionCompact> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let now = chrono::Utc::now().to_rfc3339();

    // UPSERT - only update if new timestamp is >= existing timestamp
    let mut stmt = conn.prepare(
        "INSERT INTO session_compacts (id, session_id, message_id, content, raw_json, timestamp, line_number, compact_type, indexed_at)
         VALUES (?1, ?2, ?1, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(session_id) DO UPDATE SET
             id = CASE WHEN excluded.timestamp >= session_compacts.timestamp THEN excluded.id ELSE session_compacts.id END,
             message_id = CASE WHEN excluded.timestamp >= session_compacts.timestamp THEN excluded.message_id ELSE session_compacts.message_id END,
             content = CASE WHEN excluded.timestamp >= session_compacts.timestamp THEN excluded.content ELSE session_compacts.content END,
             raw_json = CASE WHEN excluded.timestamp >= session_compacts.timestamp THEN excluded.raw_json ELSE session_compacts.raw_json END,
             timestamp = CASE WHEN excluded.timestamp >= session_compacts.timestamp THEN excluded.timestamp ELSE session_compacts.timestamp END,
             line_number = CASE WHEN excluded.timestamp >= session_compacts.timestamp THEN excluded.line_number ELSE session_compacts.line_number END,
             compact_type = CASE WHEN excluded.timestamp >= session_compacts.timestamp THEN excluded.compact_type ELSE session_compacts.compact_type END,
             indexed_at = excluded.indexed_at
         RETURNING id, session_id, message_id, content, raw_json, timestamp, line_number, compact_type, indexed_at"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare upsert: {}", e)))?;

    stmt.query_row(
        params![
            input.message_id,
            input.session_id,
            input.content,
            input.raw_json,
            input.timestamp,
            input.line_number,
            input.compact_type,
            now
        ],
        |row| {
            Ok(SessionCompact {
                id: row.get(0)?,
                session_id: row.get(1)?,
                message_id: row.get(2)?,
                content: row.get(3)?,
                raw_json: row.get(4)?,
                timestamp: row.get(5)?,
                line_number: row.get(6)?,
                compact_type: row.get(7)?,
                indexed_at: row.get(8)?,
            })
        },
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to upsert session compact: {}", e)))
}

/// Get session compact by session ID
pub fn get_session_compact(session_id: &str) -> napi::Result<Option<SessionCompact>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, session_id, message_id, content, raw_json, timestamp, line_number, compact_type, indexed_at
         FROM session_compacts WHERE session_id = ?1 LIMIT 1"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row(params![session_id], |row| {
        Ok(SessionCompact {
            id: row.get(0)?,
            session_id: row.get(1)?,
            message_id: row.get(2)?,
            content: row.get(3)?,
            raw_json: row.get(4)?,
            timestamp: row.get(5)?,
            line_number: row.get(6)?,
            compact_type: row.get(7)?,
            indexed_at: row.get(8)?,
        })
    });

    match result {
        Ok(compact) => Ok(Some(compact)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!(
            "Failed to get session compact: {}",
            e
        ))),
    }
}

// ============================================================================
// Session Todos Operations (event-sourced)
// ============================================================================

/// Upsert session todos - only if this one is newer than existing
pub fn upsert_session_todos(input: SessionTodosInput) -> napi::Result<SessionTodos> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let now = chrono::Utc::now().to_rfc3339();
    let id = uuid::Uuid::new_v4().to_string();

    // UPSERT - only update if new timestamp is >= existing timestamp
    let mut stmt = conn.prepare(
        "INSERT INTO session_todos (id, session_id, message_id, todos_json, timestamp, line_number, indexed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(session_id) DO UPDATE SET
             id = CASE WHEN excluded.timestamp >= session_todos.timestamp THEN excluded.id ELSE session_todos.id END,
             message_id = CASE WHEN excluded.timestamp >= session_todos.timestamp THEN excluded.message_id ELSE session_todos.message_id END,
             todos_json = CASE WHEN excluded.timestamp >= session_todos.timestamp THEN excluded.todos_json ELSE session_todos.todos_json END,
             timestamp = CASE WHEN excluded.timestamp >= session_todos.timestamp THEN excluded.timestamp ELSE session_todos.timestamp END,
             line_number = CASE WHEN excluded.timestamp >= session_todos.timestamp THEN excluded.line_number ELSE session_todos.line_number END,
             indexed_at = excluded.indexed_at
         RETURNING id, session_id, message_id, todos_json, timestamp, line_number, indexed_at"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare upsert: {}", e)))?;

    stmt.query_row(
        params![
            id,
            input.session_id,
            input.message_id,
            input.todos_json,
            input.timestamp,
            input.line_number,
            now
        ],
        |row| {
            Ok(SessionTodos {
                id: row.get(0)?,
                session_id: row.get(1)?,
                message_id: row.get(2)?,
                todos_json: row.get(3)?,
                timestamp: row.get(4)?,
                line_number: row.get(5)?,
                indexed_at: row.get(6)?,
            })
        },
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to upsert session todos: {}", e)))
}

/// Get session todos by session ID
pub fn get_session_todos(session_id: &str) -> napi::Result<Option<SessionTodos>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, message_id, todos_json, timestamp, line_number, indexed_at
         FROM session_todos WHERE session_id = ?1 LIMIT 1",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row(params![session_id], |row| {
        Ok(SessionTodos {
            id: row.get(0)?,
            session_id: row.get(1)?,
            message_id: row.get(2)?,
            todos_json: row.get(3)?,
            timestamp: row.get(4)?,
            line_number: row.get(5)?,
            indexed_at: row.get(6)?,
        })
    });

    match result {
        Ok(todos) => Ok(Some(todos)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!(
            "Failed to get session todos: {}",
            e
        ))),
    }
}

// ============================================================================
// Generated Session Summary Operations (LLM-analyzed summaries)
// ============================================================================

/// Upsert a generated session summary (inserts or updates based on session_id)
pub fn upsert_generated_summary(
    input: GeneratedSessionSummaryInput,
) -> napi::Result<GeneratedSessionSummary> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let topics_json = serde_json::to_string(&input.topics)
        .map_err(|e| napi::Error::from_reason(format!("Failed to serialize topics: {}", e)))?;
    let files_json = input
        .files_modified
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|e| napi::Error::from_reason(format!("Failed to serialize files: {}", e)))?;
    let tools_json = input
        .tools_used
        .as_ref()
        .map(serde_json::to_string)
        .transpose()
        .map_err(|e| napi::Error::from_reason(format!("Failed to serialize tools: {}", e)))?;

    // Use RETURNING to get the inserted/updated row (avoids re-entrancy deadlock)
    let mut stmt = conn
        .prepare(
            "INSERT INTO generated_session_summaries (
                id, session_id, summary_text, topics, files_modified, tools_used,
                outcome, message_count, duration_seconds, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)
            ON CONFLICT(session_id) DO UPDATE SET
                summary_text = excluded.summary_text,
                topics = excluded.topics,
                files_modified = excluded.files_modified,
                tools_used = excluded.tools_used,
                outcome = excluded.outcome,
                message_count = excluded.message_count,
                duration_seconds = excluded.duration_seconds,
                updated_at = excluded.updated_at
            RETURNING id, session_id, summary_text, topics, files_modified, tools_used,
                      outcome, message_count, duration_seconds, created_at, updated_at",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare upsert: {}", e)))?;

    stmt.query_row(
        params![
            id,
            input.session_id,
            input.summary_text,
            topics_json,
            files_json,
            tools_json,
            input.outcome,
            input.message_count,
            input.duration_seconds,
            now,
        ],
        |row| {
            let topics_str: String = row.get(3)?;
            let files_str: Option<String> = row.get(4)?;
            let tools_str: Option<String> = row.get(5)?;

            Ok(GeneratedSessionSummary {
                id: row.get(0)?,
                session_id: row.get(1)?,
                summary_text: row.get(2)?,
                topics: serde_json::from_str(&topics_str).unwrap_or_default(),
                files_modified: files_str.and_then(|s| serde_json::from_str(&s).ok()),
                tools_used: tools_str.and_then(|s| serde_json::from_str(&s).ok()),
                outcome: row.get(6)?,
                message_count: row.get(7)?,
                duration_seconds: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        },
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to upsert generated summary: {}", e)))
}

/// Get generated summary by session ID
pub fn get_generated_summary(session_id: &str) -> napi::Result<Option<GeneratedSessionSummary>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, summary_text, topics, files_modified, tools_used,
                    outcome, message_count, duration_seconds, created_at, updated_at
             FROM generated_session_summaries WHERE session_id = ?1 LIMIT 1",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row(params![session_id], |row| {
        let topics_str: String = row.get(3)?;
        let files_str: Option<String> = row.get(4)?;
        let tools_str: Option<String> = row.get(5)?;

        Ok(GeneratedSessionSummary {
            id: row.get(0)?,
            session_id: row.get(1)?,
            summary_text: row.get(2)?,
            topics: serde_json::from_str(&topics_str).unwrap_or_default(),
            files_modified: files_str.and_then(|s| serde_json::from_str(&s).ok()),
            tools_used: tools_str.and_then(|s| serde_json::from_str(&s).ok()),
            outcome: row.get(6)?,
            message_count: row.get(7)?,
            duration_seconds: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    });

    match result {
        Ok(summary) => Ok(Some(summary)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!(
            "Failed to get generated summary: {}",
            e
        ))),
    }
}

/// Search generated summaries using FTS
pub fn search_generated_summaries(
    query: &str,
    limit: Option<u32>,
) -> napi::Result<Vec<GeneratedSessionSummary>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;
    let limit_val = limit.unwrap_or(20);

    // Escape the query to prevent FTS5 syntax errors
    let escaped_query = escape_fts5_query(query);

    let mut stmt = conn
        .prepare(
            "SELECT g.id, g.session_id, g.summary_text, g.topics, g.files_modified, g.tools_used,
                    g.outcome, g.message_count, g.duration_seconds, g.created_at, g.updated_at
             FROM generated_session_summaries g
             JOIN generated_session_summaries_fts fts ON fts.rowid = g.rowid
             WHERE generated_session_summaries_fts MATCH ?1
             ORDER BY g.created_at DESC
             LIMIT ?2",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare search: {}", e)))?;

    let rows = stmt
        .query_map(params![escaped_query, limit_val], |row| {
            let topics_str: String = row.get(3)?;
            let files_str: Option<String> = row.get(4)?;
            let tools_str: Option<String> = row.get(5)?;

            Ok(GeneratedSessionSummary {
                id: row.get(0)?,
                session_id: row.get(1)?,
                summary_text: row.get(2)?,
                topics: serde_json::from_str(&topics_str).unwrap_or_default(),
                files_modified: files_str.and_then(|s| serde_json::from_str(&s).ok()),
                tools_used: tools_str.and_then(|s| serde_json::from_str(&s).ok()),
                outcome: row.get(6)?,
                message_count: row.get(7)?,
                duration_seconds: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|e| napi::Error::from_reason(format!("Failed to search summaries: {}", e)))?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

/// List sessions that don't have generated summaries yet
/// Returns session IDs ordered by most recent first
pub fn list_sessions_without_summaries(limit: Option<u32>) -> napi::Result<Vec<String>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;
    let limit_val = limit.unwrap_or(100);

    let mut stmt = conn
        .prepare(
            "SELECT s.id
             FROM sessions s
             LEFT JOIN generated_session_summaries gs ON s.id = gs.session_id
             WHERE gs.id IS NULL
             ORDER BY (
                 SELECT MAX(m.timestamp) FROM messages m WHERE m.session_id = s.id
             ) DESC NULLS LAST
             LIMIT ?1",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let rows = stmt
        .query_map(params![limit_val], |row| row.get(0))
        .map_err(|e| napi::Error::from_reason(format!("Failed to list sessions: {}", e)))?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

// ============================================================================
// Native Task Operations (Claude Code's built-in task system)
// ============================================================================

/// Create a native task from a TaskCreate tool call
pub fn create_native_task(input: NativeTaskInput) -> napi::Result<NativeTask> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Use INSERT OR IGNORE with RETURNING to avoid deadlock (re-entrancy issue)
    // First try to insert
    let mut stmt = conn
        .prepare(
            "INSERT INTO native_tasks (
                id, session_id, message_id, subject, description, status, active_form,
                owner, blocks, blocked_by, created_at, updated_at, completed_at, line_number
            ) VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6, NULL, NULL, NULL, ?7, ?7, NULL, ?8)
            ON CONFLICT(session_id, id) DO UPDATE SET updated_at = excluded.updated_at
            RETURNING id, session_id, message_id, subject, description, status, active_form,
                      owner, blocks, blocked_by, created_at, updated_at, completed_at, line_number",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare insert: {}", e)))?;

    stmt.query_row(
        params![
            input.id,
            input.session_id,
            input.message_id,
            input.subject,
            input.description,
            input.active_form,
            input.timestamp,
            input.line_number,
        ],
        |row| {
            Ok(NativeTask {
                id: row.get(0)?,
                session_id: row.get(1)?,
                message_id: row.get(2)?,
                subject: row.get(3)?,
                description: row.get(4)?,
                status: row.get(5)?,
                active_form: row.get(6)?,
                owner: row.get(7)?,
                blocks: row.get(8)?,
                blocked_by: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
                completed_at: row.get(12)?,
                line_number: row.get(13)?,
            })
        },
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to create native task: {}", e)))
}

/// Update a native task from a TaskUpdate tool call
pub fn update_native_task(input: NativeTaskUpdate) -> napi::Result<Option<NativeTask>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Build dynamic UPDATE query based on provided fields
    let mut updates = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    let mut param_idx = 1;

    // Always update these
    updates.push(format!("message_id = ?{}", param_idx));
    params_vec.push(Box::new(input.message_id.clone()));
    param_idx += 1;

    updates.push(format!("updated_at = ?{}", param_idx));
    params_vec.push(Box::new(input.timestamp.clone()));
    param_idx += 1;

    updates.push(format!("line_number = ?{}", param_idx));
    params_vec.push(Box::new(input.line_number));
    param_idx += 1;

    if let Some(ref status) = input.status {
        updates.push(format!("status = ?{}", param_idx));
        params_vec.push(Box::new(status.clone()));
        param_idx += 1;

        // Set completed_at if status is completed
        if status == "completed" {
            updates.push(format!("completed_at = ?{}", param_idx));
            params_vec.push(Box::new(input.timestamp.clone()));
            param_idx += 1;
        }
    }

    if let Some(ref subject) = input.subject {
        updates.push(format!("subject = ?{}", param_idx));
        params_vec.push(Box::new(subject.clone()));
        param_idx += 1;
    }

    if let Some(ref description) = input.description {
        updates.push(format!("description = ?{}", param_idx));
        params_vec.push(Box::new(description.clone()));
        param_idx += 1;
    }

    if let Some(ref active_form) = input.active_form {
        updates.push(format!("active_form = ?{}", param_idx));
        params_vec.push(Box::new(active_form.clone()));
        param_idx += 1;
    }

    if let Some(ref owner) = input.owner {
        updates.push(format!("owner = ?{}", param_idx));
        params_vec.push(Box::new(owner.clone()));
        param_idx += 1;
    }

    // Handle addBlocks - append to existing JSON array
    if let Some(ref add_blocks) = input.add_blocks {
        if !add_blocks.is_empty() {
            let blocks_json = serde_json::to_string(add_blocks).unwrap_or_default();
            updates.push(format!(
                "blocks = CASE
                    WHEN blocks IS NULL THEN ?{}
                    ELSE json_group_array(value)
                END",
                param_idx
            ));
            params_vec.push(Box::new(blocks_json));
            param_idx += 1;
        }
    }

    // Handle addBlockedBy - append to existing JSON array
    if let Some(ref add_blocked_by) = input.add_blocked_by {
        if !add_blocked_by.is_empty() {
            let blocked_by_json = serde_json::to_string(add_blocked_by).unwrap_or_default();
            updates.push(format!(
                "blocked_by = CASE
                    WHEN blocked_by IS NULL THEN ?{}
                    ELSE json_group_array(value)
                END",
                param_idx
            ));
            params_vec.push(Box::new(blocked_by_json));
            param_idx += 1;
        }
    }

    // Add WHERE clause params
    params_vec.push(Box::new(input.session_id.clone()));
    params_vec.push(Box::new(input.id.clone()));

    // Add RETURNING clause to avoid deadlock (re-entrancy issue with get_native_task)
    let sql = format!(
        "UPDATE native_tasks SET {} WHERE session_id = ?{} AND id = ?{}
         RETURNING id, session_id, message_id, subject, description, status, active_form,
                   owner, blocks, blocked_by, created_at, updated_at, completed_at, line_number",
        updates.join(", "),
        param_idx,
        param_idx + 1
    );

    // Convert to params slice
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare update: {}", e)))?;

    let result = stmt.query_row(params_refs.as_slice(), |row| {
        Ok(NativeTask {
            id: row.get(0)?,
            session_id: row.get(1)?,
            message_id: row.get(2)?,
            subject: row.get(3)?,
            description: row.get(4)?,
            status: row.get(5)?,
            active_form: row.get(6)?,
            owner: row.get(7)?,
            blocks: row.get(8)?,
            blocked_by: row.get(9)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
            completed_at: row.get(12)?,
            line_number: row.get(13)?,
        })
    });

    match result {
        Ok(task) => Ok(Some(task)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!(
            "Failed to update native task: {}",
            e
        ))),
    }
}

/// Get a native task by session ID and task ID
pub fn get_native_task(session_id: &str, task_id: &str) -> napi::Result<Option<NativeTask>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, message_id, subject, description, status, active_form,
                    owner, blocks, blocked_by, created_at, updated_at, completed_at, line_number
             FROM native_tasks WHERE session_id = ?1 AND id = ?2",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row(params![session_id, task_id], |row| {
        Ok(NativeTask {
            id: row.get(0)?,
            session_id: row.get(1)?,
            message_id: row.get(2)?,
            subject: row.get(3)?,
            description: row.get(4)?,
            status: row.get(5)?,
            active_form: row.get(6)?,
            owner: row.get(7)?,
            blocks: row.get(8)?,
            blocked_by: row.get(9)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
            completed_at: row.get(12)?,
            line_number: row.get(13)?,
        })
    });

    match result {
        Ok(task) => Ok(Some(task)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!(
            "Failed to get native task: {}",
            e
        ))),
    }
}

/// Get all native tasks for a session
pub fn get_session_native_tasks(session_id: &str) -> napi::Result<Vec<NativeTask>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, message_id, subject, description, status, active_form,
                    owner, blocks, blocked_by, created_at, updated_at, completed_at, line_number
             FROM native_tasks WHERE session_id = ?1 ORDER BY created_at ASC",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let tasks = stmt
        .query_map(params![session_id], |row| {
            Ok(NativeTask {
                id: row.get(0)?,
                session_id: row.get(1)?,
                message_id: row.get(2)?,
                subject: row.get(3)?,
                description: row.get(4)?,
                status: row.get(5)?,
                active_form: row.get(6)?,
                owner: row.get(7)?,
                blocks: row.get(8)?,
                blocked_by: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
                completed_at: row.get(12)?,
                line_number: row.get(13)?,
            })
        })
        .map_err(|e| napi::Error::from_reason(format!("Failed to query native tasks: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(tasks)
}

// ============================================================================
// Message Operations
// ============================================================================

/// Insert a batch of messages for a session
pub fn insert_messages_batch(session_id: &str, messages: Vec<MessageInput>) -> napi::Result<u32> {
    if messages.is_empty() {
        return Ok(0);
    }

    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;
    let now = chrono::Utc::now().to_rfc3339();

    // session_id IS the id (primary key) - no lookup needed
    let mut count = 0u32;

    for msg in messages {
        // id IS the message UUID from JSONL - no generated ID
        // Use UPSERT to update fields for existing messages (migration path for old data)
        // NOTE: message_type must be updated to fix sentiment events that were stored with wrong type
        conn.execute(
            "INSERT INTO messages
             (id, session_id, agent_id, parent_id, message_type, role, content, tool_name, tool_input, tool_result, raw_json, timestamp, line_number, source_file_name, source_file_type, sentiment_score, sentiment_level, frustration_score, frustration_level, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, lines_added, lines_removed, files_changed, indexed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27)
             ON CONFLICT(id) DO UPDATE SET
                message_type = excluded.message_type,
                agent_id = COALESCE(excluded.agent_id, agent_id),
                parent_id = COALESCE(excluded.parent_id, parent_id),
                tool_name = excluded.tool_name,
                content = COALESCE(excluded.content, content),
                raw_json = COALESCE(excluded.raw_json, raw_json),
                source_file_name = COALESCE(excluded.source_file_name, source_file_name),
                source_file_type = COALESCE(excluded.source_file_type, source_file_type),
                sentiment_score = COALESCE(excluded.sentiment_score, sentiment_score),
                sentiment_level = COALESCE(excluded.sentiment_level, sentiment_level),
                frustration_score = COALESCE(excluded.frustration_score, frustration_score),
                frustration_level = COALESCE(excluded.frustration_level, frustration_level),
                input_tokens = COALESCE(excluded.input_tokens, input_tokens),
                output_tokens = COALESCE(excluded.output_tokens, output_tokens),
                cache_read_tokens = COALESCE(excluded.cache_read_tokens, cache_read_tokens),
                cache_creation_tokens = COALESCE(excluded.cache_creation_tokens, cache_creation_tokens),
                lines_added = COALESCE(excluded.lines_added, lines_added),
                lines_removed = COALESCE(excluded.lines_removed, lines_removed),
                files_changed = COALESCE(excluded.files_changed, files_changed),
                indexed_at = excluded.indexed_at",
            params![
                msg.id,  // id IS the message UUID from JSONL
                session_id,  // session_id IS the session's id
                msg.agent_id,  // NULL for main conversation, agent ID for agent messages
                msg.parent_id,  // For result messages, references the call message id
                msg.message_type,
                msg.role,
                msg.content,
                msg.tool_name,
                msg.tool_input,
                msg.tool_result,
                msg.raw_json,
                msg.timestamp,
                msg.line_number,
                msg.source_file_name,
                msg.source_file_type,
                msg.sentiment_score,
                msg.sentiment_level,
                msg.frustration_score,
                msg.frustration_level,
                msg.input_tokens,
                msg.output_tokens,
                msg.cache_read_tokens,
                msg.cache_creation_tokens,
                msg.lines_added,
                msg.lines_removed,
                msg.files_changed,
                now
            ],
        ).map_err(|e| napi::Error::from_reason(format!("Failed to insert message: {}", e)))?;

        count += 1;
    }

    Ok(count)
}

/// Get a message by ID (id IS the message UUID from JSONL)
pub fn get_message(message_id: &str) -> napi::Result<Option<Message>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // id IS the message UUID - no separate message_id column
    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, agent_id, parent_id, message_type, role, content,
                tool_name, tool_input, tool_result, raw_json, timestamp, line_number,
                source_file_name, source_file_type, sentiment_score, sentiment_level,
                frustration_score, frustration_level, indexed_at
         FROM messages WHERE id = ?1 LIMIT 1",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row(params![message_id], |row| {
        Ok(Message {
            id: row.get(0)?,
            session_id: row.get(1)?,
            agent_id: row.get(2)?,
            parent_id: row.get(3)?,
            message_type: row.get(4)?,
            role: row.get(5)?,
            content: row.get(6)?,
            tool_name: row.get(7)?,
            tool_input: row.get(8)?,
            tool_result: row.get(9)?,
            raw_json: row.get(10)?,
            timestamp: row.get(11)?,
            line_number: row.get(12)?,
            source_file_name: row.get(13)?,
            source_file_type: row.get(14)?,
            sentiment_score: row.get(15)?,
            sentiment_level: row.get(16)?,
            frustration_score: row.get(17)?,
            frustration_level: row.get(18)?,
            indexed_at: row.get(19)?,
        })
    });

    match result {
        Ok(message) => Ok(Some(message)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!(
            "Failed to get message: {}",
            e
        ))),
    }
}

/// List messages for a session (session_id IS the session's id)
/// agent_id filter:
///   - None: returns all messages (main + agent)
///   - Some(None): returns only main conversation (agent_id IS NULL)
///   - Some(Some(id)): returns only messages from that agent
pub fn list_session_messages(
    session_id: &str,
    message_type: Option<String>,
    agent_id_filter: Option<Option<String>>, // None = all, Some(None) = main only, Some(Some(id)) = specific agent
    limit: Option<u32>,
    offset: Option<u32>,
) -> napi::Result<Vec<Message>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;
    // Default to very high limit when not specified - caller should paginate if needed
    let limit_val = limit.unwrap_or(100_000);
    let offset_val = offset.unwrap_or(0);

    // Build dynamic SQL based on filters
    // No JOIN needed - session_id is the FK directly
    // Order by timestamp DESC (newest first) for forward pagination with column-reverse
    let base_cols = "id, session_id, agent_id, parent_id, message_type, role, content,
                     tool_name, tool_input, tool_result, raw_json, timestamp, line_number,
                     source_file_name, source_file_type, sentiment_score, sentiment_level,
                     frustration_score, frustration_level, indexed_at";

    let (sql, params_vec): (String, Vec<Box<dyn rusqlite::ToSql>>) = match (&message_type, &agent_id_filter) {
        (Some(mtype), Some(Some(agent))) => (
            format!("SELECT {} FROM messages WHERE session_id = ?1 AND message_type = ?2 AND agent_id = ?3 ORDER BY timestamp DESC LIMIT ?4 OFFSET ?5", base_cols),
            vec![
                Box::new(session_id.to_string()) as Box<dyn rusqlite::ToSql>,
                Box::new(mtype.clone()),
                Box::new(agent.clone()),
                Box::new(limit_val),
                Box::new(offset_val),
            ]
        ),
        (Some(mtype), Some(None)) => (
            format!("SELECT {} FROM messages WHERE session_id = ?1 AND message_type = ?2 AND agent_id IS NULL ORDER BY timestamp DESC LIMIT ?3 OFFSET ?4", base_cols),
            vec![
                Box::new(session_id.to_string()) as Box<dyn rusqlite::ToSql>,
                Box::new(mtype.clone()),
                Box::new(limit_val),
                Box::new(offset_val),
            ]
        ),
        (Some(mtype), None) => (
            format!("SELECT {} FROM messages WHERE session_id = ?1 AND message_type = ?2 ORDER BY timestamp DESC LIMIT ?3 OFFSET ?4", base_cols),
            vec![
                Box::new(session_id.to_string()) as Box<dyn rusqlite::ToSql>,
                Box::new(mtype.clone()),
                Box::new(limit_val),
                Box::new(offset_val),
            ]
        ),
        (None, Some(Some(agent))) => (
            format!("SELECT {} FROM messages WHERE session_id = ?1 AND agent_id = ?2 ORDER BY timestamp DESC LIMIT ?3 OFFSET ?4", base_cols),
            vec![
                Box::new(session_id.to_string()) as Box<dyn rusqlite::ToSql>,
                Box::new(agent.clone()),
                Box::new(limit_val),
                Box::new(offset_val),
            ]
        ),
        (None, Some(None)) => (
            format!("SELECT {} FROM messages WHERE session_id = ?1 AND agent_id IS NULL ORDER BY timestamp DESC LIMIT ?2 OFFSET ?3", base_cols),
            vec![
                Box::new(session_id.to_string()) as Box<dyn rusqlite::ToSql>,
                Box::new(limit_val),
                Box::new(offset_val),
            ]
        ),
        (None, None) => (
            format!("SELECT {} FROM messages WHERE session_id = ?1 ORDER BY timestamp DESC LIMIT ?2 OFFSET ?3", base_cols),
            vec![
                Box::new(session_id.to_string()) as Box<dyn rusqlite::ToSql>,
                Box::new(limit_val),
                Box::new(offset_val),
            ]
        ),
    };

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let map_row = |row: &rusqlite::Row| -> rusqlite::Result<Message> {
        Ok(Message {
            id: row.get(0)?,
            session_id: row.get(1)?,
            agent_id: row.get(2)?,
            parent_id: row.get(3)?,
            message_type: row.get(4)?,
            role: row.get(5)?,
            content: row.get(6)?,
            tool_name: row.get(7)?,
            tool_input: row.get(8)?,
            tool_result: row.get(9)?,
            raw_json: row.get(10)?,
            timestamp: row.get(11)?,
            line_number: row.get(12)?,
            source_file_name: row.get(13)?,
            source_file_type: row.get(14)?,
            sentiment_score: row.get(15)?,
            sentiment_level: row.get(16)?,
            frustration_score: row.get(17)?,
            frustration_level: row.get(18)?,
            indexed_at: row.get(19)?,
        })
    };

    // Convert params to references for query_map
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

    let rows: Vec<Message> = stmt
        .query_map(params_refs.as_slice(), map_row)
        .map_err(|e| napi::Error::from_reason(format!("Failed to list messages: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

/// Get message count for a session (only user and assistant messages)
pub fn get_message_count(session_id: &str) -> napi::Result<u32> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // session_id IS the primary key (id) in the new schema - no JOIN needed
    let count: u32 = conn
        .query_row(
            "SELECT COUNT(*) FROM messages
         WHERE session_id = ?1 AND message_type IN ('user', 'assistant')",
            params![session_id],
            |row| row.get(0),
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to count messages: {}", e)))?;

    Ok(count)
}

/// Get message counts for multiple sessions in a single query
pub fn get_message_counts_batch(
    session_ids: Vec<String>,
) -> napi::Result<std::collections::HashMap<String, u32>> {
    if session_ids.is_empty() {
        return Ok(std::collections::HashMap::new());
    }

    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Initialize all to 0
    let mut result: std::collections::HashMap<String, u32> =
        session_ids.iter().map(|id| (id.clone(), 0)).collect();

    // Build placeholders for IN clause
    // session_id in messages table IS the session's id (primary key) - no JOIN needed
    let placeholders: Vec<String> = (1..=session_ids.len()).map(|i| format!("?{}", i)).collect();
    let sql = format!(
        "SELECT session_id, COUNT(*) as count
         FROM messages
         WHERE session_id IN ({})
           AND message_type IN ('user', 'assistant')
         GROUP BY session_id",
        placeholders.join(", ")
    );

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    // Convert session_ids to rusqlite params
    let params: Vec<&dyn rusqlite::ToSql> = session_ids
        .iter()
        .map(|s| s as &dyn rusqlite::ToSql)
        .collect();

    let rows = stmt
        .query_map(params.as_slice(), |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, u32>(1)?))
        })
        .map_err(|e| napi::Error::from_reason(format!("Failed to count messages batch: {}", e)))?;

    for row in rows.flatten() {
        result.insert(row.0, row.1);
    }

    Ok(result)
}

/// Get the highest line number indexed for a session
pub fn get_last_indexed_line(session_id: &str) -> napi::Result<i32> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // session_id IS the primary key (id) in the new schema
    let line: Option<i32> = conn
        .query_row(
            "SELECT last_indexed_line FROM sessions WHERE id = ?1",
            params![session_id],
            |row| row.get(0),
        )
        .ok();

    Ok(line.unwrap_or(0))
}

/// Session timestamp info returned by get_session_timestamps_batch
#[derive(Debug, Clone)]
pub struct SessionTimestamps {
    pub session_id: String,
    pub started_at: Option<String>,
    pub ended_at: Option<String>,
}

/// Get first/last message timestamps for multiple sessions in a single query
pub fn get_session_timestamps_batch(
    session_ids: Vec<String>,
) -> napi::Result<std::collections::HashMap<String, SessionTimestamps>> {
    if session_ids.is_empty() {
        return Ok(std::collections::HashMap::new());
    }

    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Initialize all to empty timestamps
    let mut result: std::collections::HashMap<String, SessionTimestamps> = session_ids
        .iter()
        .map(|id| {
            (
                id.clone(),
                SessionTimestamps {
                    session_id: id.clone(),
                    started_at: None,
                    ended_at: None,
                },
            )
        })
        .collect();

    // Build placeholders for IN clause
    let placeholders: Vec<String> = (1..=session_ids.len()).map(|i| format!("?{}", i)).collect();
    let sql = format!(
        "SELECT session_id, MIN(timestamp) as started_at, MAX(timestamp) as ended_at
         FROM messages
         WHERE session_id IN ({})
         GROUP BY session_id",
        placeholders.join(", ")
    );

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    // Convert session_ids to rusqlite params
    let params: Vec<&dyn rusqlite::ToSql> = session_ids
        .iter()
        .map(|s| s as &dyn rusqlite::ToSql)
        .collect();

    let rows = stmt
        .query_map(params.as_slice(), |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        })
        .map_err(|e| napi::Error::from_reason(format!("Failed to get timestamps batch: {}", e)))?;

    for row in rows.flatten() {
        result.insert(
            row.0.clone(),
            SessionTimestamps {
                session_id: row.0,
                started_at: row.1,
                ended_at: row.2,
            },
        );
    }

    Ok(result)
}

/// Escape a query string for FTS5
/// FTS5 interprets words like AND, OR, NOT, NEAR as operators,
/// and characters like :, *, (, ), ^ as special syntax.
/// This function quotes each word to prevent syntax errors.
fn escape_fts5_query(query: &str) -> String {
    query
        .split_whitespace()
        .map(|word| {
            let clean = word.trim_matches('"');
            let escaped = clean.replace('"', "\"\"");
            format!("\"{}\"", escaped)
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Search messages using FTS
pub fn search_messages(
    query: &str,
    session_id: Option<String>,
    limit: Option<u32>,
) -> napi::Result<Vec<Message>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;
    let limit_val = limit.unwrap_or(50);

    // Escape the query to prevent FTS5 syntax errors
    let escaped_query = escape_fts5_query(query);

    // No JOINs needed - session_id in messages directly references sessions.id
    // id IS the message UUID from JSONL (no separate message_id column)
    let sql = if session_id.is_some() {
        "SELECT m.id, m.session_id, m.agent_id, m.parent_id, m.message_type, m.role, m.content,
                m.tool_name, m.tool_input, m.tool_result, m.raw_json, m.timestamp, m.line_number,
                m.source_file_name, m.source_file_type, m.indexed_at
         FROM messages m
         JOIN messages_fts ON messages_fts.rowid = m.rowid
         WHERE messages_fts MATCH ?1 AND m.session_id = ?2
         ORDER BY m.timestamp DESC
         LIMIT ?3"
    } else {
        "SELECT m.id, m.session_id, m.agent_id, m.parent_id, m.message_type, m.role, m.content,
                m.tool_name, m.tool_input, m.tool_result, m.raw_json, m.timestamp, m.line_number,
                m.source_file_name, m.source_file_type, m.indexed_at
         FROM messages m
         JOIN messages_fts ON messages_fts.rowid = m.rowid
         WHERE messages_fts MATCH ?1
         ORDER BY m.timestamp DESC
         LIMIT ?2"
    };

    let mut stmt = conn
        .prepare(sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare search: {}", e)))?;

    let map_row = |row: &rusqlite::Row| -> rusqlite::Result<Message> {
        Ok(Message {
            id: row.get(0)?,
            session_id: row.get(1)?,
            agent_id: row.get(2)?,
            parent_id: row.get(3)?,
            message_type: row.get(4)?,
            role: row.get(5)?,
            content: row.get(6)?,
            tool_name: row.get(7)?,
            tool_input: row.get(8)?,
            tool_result: row.get(9)?,
            raw_json: row.get(10)?,
            timestamp: row.get(11)?,
            line_number: row.get(12)?,
            source_file_name: row.get(13)?,
            source_file_type: row.get(14)?,
            sentiment_score: row.get(15)?,
            sentiment_level: row.get(16)?,
            frustration_score: row.get(17)?,
            frustration_level: row.get(18)?,
            indexed_at: row.get(19)?,
        })
    };

    let rows: Vec<Message> = if let Some(ref sid) = session_id {
        stmt.query_map(params![escaped_query, sid, limit_val], map_row)
            .map_err(|e| napi::Error::from_reason(format!("Failed to search: {}", e)))?
            .filter_map(|r| r.ok())
            .collect()
    } else {
        stmt.query_map(params![escaped_query, limit_val], map_row)
            .map_err(|e| napi::Error::from_reason(format!("Failed to search: {}", e)))?
            .filter_map(|r| r.ok())
            .collect()
    };

    Ok(rows)
}

// ============================================================================
// Task Operations
// ============================================================================

pub fn create_task(input: TaskInput) -> napi::Result<Task> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // Use RETURNING to get the inserted row (avoids re-entrancy deadlock)
    let mut stmt = conn.prepare(
        "INSERT INTO tasks (id, session_id, task_id, description, task_type, started_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         RETURNING id, session_id, task_id, description, task_type, outcome, confidence, notes, files_modified, tests_added, started_at, completed_at"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare insert: {}", e)))?;

    stmt.query_row(
        params![
            id,
            input.session_id,
            input.task_id,
            input.description,
            input.task_type,
            now
        ],
        |row| {
            let files_json: Option<String> = row.get(8)?;
            Ok(Task {
                id: Some(row.get(0)?),
                session_id: row.get(1)?,
                task_id: row.get(2)?,
                description: row.get(3)?,
                task_type: row.get(4)?,
                outcome: row.get(5)?,
                confidence: row.get(6)?,
                notes: row.get(7)?,
                files_modified: files_json.and_then(|s| serde_json::from_str(&s).ok()),
                tests_added: row.get(9)?,
                started_at: row.get(10)?,
                completed_at: row.get(11)?,
            })
        },
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to create task: {}", e)))
}

pub fn complete_task(completion: TaskCompletion) -> napi::Result<Task> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let now = chrono::Utc::now().to_rfc3339();
    let files_json = completion
        .files_modified
        .as_ref()
        .map(|f| serde_json::to_string(f).unwrap_or_default());

    // Use RETURNING to get the updated row (avoids re-entrancy deadlock)
    let mut stmt = conn.prepare(
        "UPDATE tasks SET
            outcome = ?1,
            confidence = ?2,
            notes = ?3,
            files_modified = ?4,
            tests_added = ?5,
            completed_at = ?6
         WHERE task_id = ?7
         RETURNING id, session_id, task_id, description, task_type, outcome, confidence, notes, files_modified, tests_added, started_at, completed_at"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare update: {}", e)))?;

    stmt.query_row(
        params![
            completion.outcome,
            completion.confidence,
            completion.notes,
            files_json,
            completion.tests_added,
            now,
            completion.task_id
        ],
        |row| {
            let files_json: Option<String> = row.get(8)?;
            Ok(Task {
                id: Some(row.get(0)?),
                session_id: row.get(1)?,
                task_id: row.get(2)?,
                description: row.get(3)?,
                task_type: row.get(4)?,
                outcome: row.get(5)?,
                confidence: row.get(6)?,
                notes: row.get(7)?,
                files_modified: files_json.and_then(|s| serde_json::from_str(&s).ok()),
                tests_added: row.get(9)?,
                started_at: row.get(10)?,
                completed_at: row.get(11)?,
            })
        },
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to complete task: {}", e)))
}

pub fn fail_task(failure: TaskFailure) -> napi::Result<Task> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let now = chrono::Utc::now().to_rfc3339();
    let notes = format!(
        "Failure reason: {}\n{}{}",
        failure.reason,
        failure
            .notes
            .as_deref()
            .map(|n| format!("\nNotes: {}", n))
            .unwrap_or_default(),
        failure
            .attempted_solutions
            .as_ref()
            .map(|sols| format!("\nAttempted solutions:\n- {}", sols.join("\n- ")))
            .unwrap_or_default()
    );

    // Use RETURNING to get the updated row (avoids re-entrancy deadlock)
    let mut stmt = conn.prepare(
        "UPDATE tasks SET
            outcome = 'failure',
            confidence = ?1,
            notes = ?2,
            completed_at = ?3
         WHERE task_id = ?4
         RETURNING id, session_id, task_id, description, task_type, outcome, confidence, notes, files_modified, tests_added, started_at, completed_at"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare update: {}", e)))?;

    stmt.query_row(
        params![failure.confidence, notes, now, failure.task_id],
        |row| {
            let files_json: Option<String> = row.get(8)?;
            Ok(Task {
                id: Some(row.get(0)?),
                session_id: row.get(1)?,
                task_id: row.get(2)?,
                description: row.get(3)?,
                task_type: row.get(4)?,
                outcome: row.get(5)?,
                confidence: row.get(6)?,
                notes: row.get(7)?,
                files_modified: files_json.and_then(|s| serde_json::from_str(&s).ok()),
                tests_added: row.get(9)?,
                started_at: row.get(10)?,
                completed_at: row.get(11)?,
            })
        },
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to fail task: {}", e)))
}

pub fn get_task(task_id: &str) -> napi::Result<Option<Task>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, session_id, task_id, description, task_type, outcome, confidence, notes, files_modified, tests_added, started_at, completed_at
         FROM tasks WHERE task_id = ?1 LIMIT 1"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row(params![task_id], |row| {
        let files_json: Option<String> = row.get(8)?;
        let files_modified = files_json.and_then(|j| serde_json::from_str::<Vec<String>>(&j).ok());

        Ok(Task {
            id: Some(row.get(0)?),
            session_id: row.get(1)?,
            task_id: row.get(2)?,
            description: row.get(3)?,
            task_type: row.get(4)?,
            outcome: row.get(5)?,
            confidence: row.get(6)?,
            notes: row.get(7)?,
            files_modified,
            tests_added: row.get(9)?,
            started_at: row.get(10)?,
            completed_at: row.get(11)?,
        })
    });

    match result {
        Ok(task) => Ok(Some(task)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!(
            "Failed to get task: {}",
            e
        ))),
    }
}

pub fn query_task_metrics(
    task_type: Option<String>,
    outcome: Option<String>,
    period: Option<String>,
) -> napi::Result<TaskMetrics> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Calculate time filter based on period
    let time_filter = match period.as_deref() {
        Some("day") => "AND started_at > datetime('now', '-1 day')",
        Some("week") => "AND started_at > datetime('now', '-7 days')",
        Some("month") => "AND started_at > datetime('now', '-30 days')",
        _ => "",
    };

    let base_sql = format!(
        "SELECT
            COUNT(*) as total,
            COALESCE(SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END), 0) as completed,
            COALESCE(SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END), 0) as successful,
            COALESCE(SUM(CASE WHEN outcome = 'partial' THEN 1 ELSE 0 END), 0) as partial,
            COALESCE(SUM(CASE WHEN outcome = 'failure' THEN 1 ELSE 0 END), 0) as failed,
            AVG(confidence) as avg_conf,
            AVG(CASE WHEN completed_at IS NOT NULL THEN
                (julianday(completed_at) - julianday(started_at)) * 86400
            ELSE NULL END) as avg_duration
         FROM tasks
         WHERE 1=1 {} {} {}",
        if task_type.is_some() {
            "AND task_type = ?1"
        } else {
            ""
        },
        if outcome.is_some() {
            if task_type.is_some() {
                "AND outcome = ?2"
            } else {
                "AND outcome = ?1"
            }
        } else {
            ""
        },
        time_filter
    );

    let mut stmt = conn
        .prepare(&base_sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let map_err =
        |e: rusqlite::Error| napi::Error::from_reason(format!("Failed to query metrics: {}", e));

    let (total, completed, successful, partial, failed, avg_conf, avg_duration): (
        i64,
        i64,
        i64,
        i64,
        i64,
        Option<f64>,
        Option<f64>,
    ) = match (&task_type, &outcome) {
        (Some(tt), Some(o)) => stmt
            .query_row(params![tt, o], |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                ))
            })
            .map_err(map_err)?,
        (Some(tt), None) => stmt
            .query_row(params![tt], |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                ))
            })
            .map_err(map_err)?,
        (None, Some(o)) => stmt
            .query_row(params![o], |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                ))
            })
            .map_err(map_err)?,
        (None, None) => stmt
            .query_row([], |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                ))
            })
            .map_err(map_err)?,
    };

    // Calculate success rate
    let success_rate = if completed > 0 {
        successful as f64 / completed as f64
    } else {
        0.0
    };

    // Calculate calibration score (how well confidence predicts outcomes)
    let calibration = calculate_calibration_score(&conn, time_filter)?;

    // Get tasks by type breakdown
    let by_type = get_tasks_by_type(&conn, time_filter)?;

    // Get tasks by outcome breakdown
    let by_outcome = get_tasks_by_outcome(&conn, time_filter)?;

    Ok(TaskMetrics {
        total_tasks: total,
        completed_tasks: completed,
        successful_tasks: successful,
        partial_tasks: partial,
        failed_tasks: failed,
        success_rate,
        average_confidence: avg_conf,
        average_duration_seconds: avg_duration,
        calibration_score: Some(calibration),
        by_type: Some(serde_json::to_string(&by_type).unwrap_or_default()),
        by_outcome: Some(serde_json::to_string(&by_outcome).unwrap_or_default()),
    })
}

fn calculate_calibration_score(
    conn: &rusqlite::Connection,
    time_filter: &str,
) -> napi::Result<f64> {
    let sql = format!(
        "SELECT confidence, outcome FROM tasks WHERE confidence IS NOT NULL AND outcome IS NOT NULL {}",
        time_filter
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| {
        napi::Error::from_reason(format!("Failed to prepare calibration query: {}", e))
    })?;

    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, f64>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| napi::Error::from_reason(format!("Failed to query calibration: {}", e)))?;

    let mut total_error = 0.0;
    let mut count = 0;

    for row in rows.flatten() {
        let (confidence, outcome) = row;
        let actual_success = if outcome == "success" { 1.0 } else { 0.0 };
        total_error += (confidence - actual_success).abs();
        count += 1;
    }

    if count == 0 {
        return Ok(0.0);
    }

    let avg_error = total_error / count as f64;
    Ok((1.0 - avg_error).max(0.0))
}

fn get_tasks_by_type(
    conn: &rusqlite::Connection,
    time_filter: &str,
) -> napi::Result<std::collections::HashMap<String, i64>> {
    let sql = format!(
        "SELECT task_type, COUNT(*) as count FROM tasks WHERE 1=1 {} GROUP BY task_type",
        time_filter
    );

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare type query: {}", e)))?;

    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })
        .map_err(|e| napi::Error::from_reason(format!("Failed to query task types: {}", e)))?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

fn get_tasks_by_outcome(
    conn: &rusqlite::Connection,
    time_filter: &str,
) -> napi::Result<std::collections::HashMap<String, i64>> {
    let sql = format!(
        "SELECT outcome, COUNT(*) as count FROM tasks WHERE outcome IS NOT NULL {} GROUP BY outcome",
        time_filter
    );

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare outcome query: {}", e)))?;

    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })
        .map_err(|e| napi::Error::from_reason(format!("Failed to query task outcomes: {}", e)))?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

// ============================================================================
// NOTE: Hook Cache Operations removed - replaced by session_file_validations
// NOTE: Marketplace Cache Operations removed - not used
// ============================================================================

// ============================================================================
// Hook Execution Operations
// ============================================================================

pub fn record_hook_execution(input: HookExecutionInput) -> napi::Result<HookExecution> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Ensure session exists before inserting (avoids FK constraint violation)
    if let Some(ref session_id) = input.session_id {
        ensure_session_exists(&conn, session_id).map_err(|e| {
            napi::Error::from_reason(format!("Failed to ensure session exists: {}", e))
        })?;
    }

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let mut stmt = conn.prepare(
        "INSERT INTO hook_executions (id, session_id, task_id, hook_type, hook_name, hook_source, directory, duration_ms, exit_code, passed, output, error, if_changed, command, executed_at, status, consecutive_failures, max_attempts)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, 'completed', 0, 3)
         RETURNING id, session_id, task_id, hook_type, hook_name, hook_source, directory, duration_ms, exit_code, passed, output, error, if_changed, command, executed_at, status, consecutive_failures, max_attempts"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare insert: {}", e)))?;

    stmt.query_row(
        params![
            id,
            input.session_id,
            input.task_id,
            input.hook_type,
            input.hook_name,
            input.hook_source,
            input.directory,
            input.duration_ms,
            input.exit_code,
            input.passed as i32,
            input.output,
            input.error,
            input.if_changed,
            input.command,
            now
        ],
        |row| {
            Ok(HookExecution {
                id: Some(row.get(0)?),
                orchestration_id: None, // Legacy hook executions don't have orchestration
                session_id: row.get(1)?,
                task_id: row.get(2)?,
                hook_type: row.get(3)?,
                hook_name: row.get(4)?,
                hook_source: row.get(5)?,
                directory: row.get(6)?,
                duration_ms: row.get(7)?,
                exit_code: row.get(8)?,
                passed: row.get::<_, i32>(9)? != 0,
                output: row.get(10)?,
                error: row.get(11)?,
                if_changed: row.get(12)?,
                command: row.get(13)?,
                executed_at: row.get(14)?,
                status: row.get(15)?,
                consecutive_failures: row.get(16)?,
                max_attempts: row.get(17)?,
                pid: None,         // Completed hooks don't track PID
                plugin_root: None, // Completed hooks don't need plugin_root stored
            })
        },
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to record hook execution: {}", e)))
}

pub fn query_hook_stats(period: Option<String>) -> napi::Result<HookStats> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let time_filter = match period.as_deref() {
        Some("day") => "AND executed_at > datetime('now', '-1 day')",
        Some("week") => "AND executed_at > datetime('now', '-7 days')",
        Some("month") => "AND executed_at > datetime('now', '-30 days')",
        _ => "",
    };

    let sql = format!(
        "SELECT
            COUNT(*) as total,
            SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as passed,
            SUM(CASE WHEN passed = 0 THEN 1 ELSE 0 END) as failed,
            COUNT(DISTINCT hook_name) as unique_hooks
         FROM hook_executions WHERE 1=1 {}",
        time_filter
    );

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let (total, passed, failed, unique_hooks): (i64, i64, i64, i64) = stmt
        .query_row([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .map_err(|e| napi::Error::from_reason(format!("Failed to query hook stats: {}", e)))?;

    let pass_rate = if total > 0 {
        passed as f64 / total as f64
    } else {
        0.0
    };

    // Get by hook type breakdown
    let type_sql = format!(
        "SELECT hook_type, COUNT(*) as count FROM hook_executions WHERE 1=1 {} GROUP BY hook_type",
        time_filter
    );
    let mut type_stmt = conn
        .prepare(&type_sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare type query: {}", e)))?;

    let type_rows = type_stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })
        .map_err(|e| napi::Error::from_reason(format!("Failed to query hook types: {}", e)))?;

    let by_hook_type: std::collections::HashMap<String, i64> =
        type_rows.filter_map(|r| r.ok()).collect();

    Ok(HookStats {
        total_executions: total,
        total_passed: passed,
        total_failed: failed,
        pass_rate,
        unique_hooks,
        by_hook_type: Some(serde_json::to_string(&by_hook_type).unwrap_or_default()),
    })
}

// ============================================================================
// Frustration Event Operations
// ============================================================================

pub fn record_frustration(input: FrustrationEventInput) -> napi::Result<FrustrationEvent> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let signals_json = input
        .detected_signals
        .map(|s| serde_json::to_string(&s).unwrap_or_default());

    let mut stmt = conn.prepare(
        "INSERT INTO frustration_events (id, session_id, task_id, frustration_level, frustration_score, user_message, detected_signals, context, recorded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         RETURNING id, session_id, task_id, frustration_level, frustration_score, user_message, detected_signals, context, recorded_at"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare insert: {}", e)))?;

    stmt.query_row(
        params![
            id,
            input.session_id,
            input.task_id,
            input.frustration_level,
            input.frustration_score,
            input.user_message,
            signals_json,
            input.context,
            now
        ],
        |row| {
            Ok(FrustrationEvent {
                id: Some(row.get(0)?),
                session_id: row.get(1)?,
                task_id: row.get(2)?,
                frustration_level: row.get(3)?,
                frustration_score: row.get(4)?,
                user_message: row.get(5)?,
                detected_signals: row.get(6)?,
                context: row.get(7)?,
                recorded_at: row.get(8)?,
            })
        },
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to record frustration: {}", e)))
}

pub fn query_frustration_metrics(
    period: Option<String>,
    total_tasks: i64,
) -> napi::Result<FrustrationMetrics> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let time_filter = match period.as_deref() {
        Some("day") => "AND recorded_at > datetime('now', '-1 day')",
        Some("week") => "AND recorded_at > datetime('now', '-7 days')",
        Some("month") => "AND recorded_at > datetime('now', '-30 days')",
        _ => "",
    };

    let sql = format!(
        "SELECT
            COUNT(*) as total,
            SUM(CASE WHEN frustration_level IN ('moderate', 'high') THEN 1 ELSE 0 END) as significant,
            SUM(CASE WHEN frustration_level IN ('moderate', 'high') THEN frustration_score ELSE 0 END) as weighted
         FROM frustration_events WHERE 1=1 {}",
        time_filter
    );

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let (total, significant, weighted): (i64, i64, f64) = stmt
        .query_row([], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get::<_, f64>(2).unwrap_or(0.0),
            ))
        })
        .map_err(|e| {
            napi::Error::from_reason(format!("Failed to query frustration metrics: {}", e))
        })?;

    let frustration_rate = if total_tasks > 0 {
        total as f64 / total_tasks as f64
    } else {
        0.0
    };
    let significant_rate = if total_tasks > 0 {
        significant as f64 / total_tasks as f64
    } else {
        0.0
    };

    // Get by level breakdown
    let level_sql = format!(
        "SELECT frustration_level, COUNT(*) as count FROM frustration_events WHERE 1=1 {} GROUP BY frustration_level",
        time_filter
    );
    let mut level_stmt = conn
        .prepare(&level_sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare level query: {}", e)))?;

    let level_rows = level_stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })
        .map_err(|e| {
            napi::Error::from_reason(format!("Failed to query frustration levels: {}", e))
        })?;

    let by_level: std::collections::HashMap<String, i64> =
        level_rows.filter_map(|r| r.ok()).collect();

    Ok(FrustrationMetrics {
        total_frustrations: total,
        significant_frustrations: significant,
        frustration_rate,
        significant_frustration_rate: significant_rate,
        weighted_score: weighted,
        by_level: Some(serde_json::to_string(&by_level).unwrap_or_default()),
    })
}

// ============================================================================
// NOTE: Checkpoint Operations removed - not used
// ============================================================================

// ============================================================================
// Session File Change Operations
// ============================================================================

pub fn record_file_change(input: SessionFileChangeInput) -> napi::Result<SessionFileChange> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let mut stmt = conn.prepare(
        "INSERT INTO session_file_changes (id, session_id, file_path, action, file_hash_before, file_hash_after, tool_name, recorded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         RETURNING id, session_id, file_path, action, file_hash_before, file_hash_after, tool_name, recorded_at"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare insert: {}", e)))?;

    stmt.query_row(
        params![
            id,
            input.session_id,
            input.file_path,
            input.action,
            input.file_hash_before,
            input.file_hash_after,
            input.tool_name,
            now
        ],
        |row| {
            Ok(SessionFileChange {
                id: Some(row.get(0)?),
                session_id: row.get(1)?,
                file_path: row.get(2)?,
                action: row.get(3)?,
                file_hash_before: row.get(4)?,
                file_hash_after: row.get(5)?,
                tool_name: row.get(6)?,
                recorded_at: row.get(7)?,
            })
        },
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to record file change: {}", e)))
}

pub fn get_session_file_changes(session_id: &str) -> napi::Result<Vec<SessionFileChange>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, session_id, file_path, action, file_hash_before, file_hash_after, tool_name, recorded_at
         FROM session_file_changes WHERE session_id = ?1 ORDER BY recorded_at DESC"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let rows = stmt
        .query_map(params![session_id], |row| {
            Ok(SessionFileChange {
                id: Some(row.get(0)?),
                session_id: row.get(1)?,
                file_path: row.get(2)?,
                action: row.get(3)?,
                file_hash_before: row.get(4)?,
                file_hash_after: row.get(5)?,
                tool_name: row.get(6)?,
                recorded_at: row.get(7)?,
            })
        })
        .map_err(|e| napi::Error::from_reason(format!("Failed to get file changes: {}", e)))?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn has_session_changes(session_id: &str) -> napi::Result<bool> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM session_file_changes WHERE session_id = ?1",
            params![session_id],
            |row| row.get(0),
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to check session changes: {}", e)))?;

    Ok(count > 0)
}

// ============================================================================
// Session File Validation Operations
// ============================================================================

pub fn record_file_validation(
    input: SessionFileValidationInput,
) -> napi::Result<SessionFileValidation> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Ensure session exists before inserting (avoids FK constraint violation)
    ensure_session_exists(&conn, &input.session_id)
        .map_err(|e| napi::Error::from_reason(format!("Failed to ensure session exists: {}", e)))?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // UPSERT - update if this session/file/plugin/hook/directory combo already validated
    let mut stmt = conn.prepare(
        "INSERT INTO session_file_validations (id, session_id, file_path, file_hash, plugin_name, hook_name, directory, command_hash, validated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(session_id, file_path, plugin_name, hook_name, directory) DO UPDATE SET
             file_hash = excluded.file_hash,
             command_hash = excluded.command_hash,
             validated_at = excluded.validated_at
         RETURNING id, session_id, file_path, file_hash, plugin_name, hook_name, directory, command_hash, validated_at"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare insert: {}", e)))?;

    stmt.query_row(
        params![
            id,
            input.session_id,
            input.file_path,
            input.file_hash,
            input.plugin_name,
            input.hook_name,
            input.directory,
            input.command_hash,
            now
        ],
        |row| {
            Ok(SessionFileValidation {
                id: Some(row.get(0)?),
                session_id: row.get(1)?,
                file_path: row.get(2)?,
                file_hash: row.get(3)?,
                plugin_name: row.get(4)?,
                hook_name: row.get(5)?,
                directory: row.get(6)?,
                command_hash: row.get(7)?,
                validated_at: row.get(8)?,
            })
        },
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to record file validation: {}", e)))
}

pub fn get_file_validation(
    session_id: &str,
    file_path: &str,
    plugin_name: &str,
    hook_name: &str,
    directory: &str,
) -> napi::Result<Option<SessionFileValidation>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, session_id, file_path, file_hash, plugin_name, hook_name, directory, command_hash, validated_at
         FROM session_file_validations
         WHERE session_id = ?1 AND file_path = ?2 AND plugin_name = ?3 AND hook_name = ?4 AND directory = ?5
         LIMIT 1"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row(
        params![session_id, file_path, plugin_name, hook_name, directory],
        |row| {
            Ok(SessionFileValidation {
                id: Some(row.get(0)?),
                session_id: row.get(1)?,
                file_path: row.get(2)?,
                file_hash: row.get(3)?,
                plugin_name: row.get(4)?,
                hook_name: row.get(5)?,
                directory: row.get(6)?,
                command_hash: row.get(7)?,
                validated_at: row.get(8)?,
            })
        },
    );

    match result {
        Ok(validation) => Ok(Some(validation)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!(
            "Failed to get file validation: {}",
            e
        ))),
    }
}

/// Get all validations for a session and plugin/hook/directory combo
/// Returns files that have been validated by this hook in this directory
pub fn get_session_validations(
    session_id: &str,
    plugin_name: &str,
    hook_name: &str,
    directory: &str,
) -> napi::Result<Vec<SessionFileValidation>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, session_id, file_path, file_hash, plugin_name, hook_name, directory, command_hash, validated_at
         FROM session_file_validations
         WHERE session_id = ?1 AND plugin_name = ?2 AND hook_name = ?3 AND directory = ?4
         ORDER BY validated_at DESC"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let rows = stmt
        .query_map(
            params![session_id, plugin_name, hook_name, directory],
            |row| {
                Ok(SessionFileValidation {
                    id: Some(row.get(0)?),
                    session_id: row.get(1)?,
                    file_path: row.get(2)?,
                    file_hash: row.get(3)?,
                    plugin_name: row.get(4)?,
                    hook_name: row.get(5)?,
                    directory: row.get(6)?,
                    command_hash: row.get(7)?,
                    validated_at: row.get(8)?,
                })
            },
        )
        .map_err(|e| {
            napi::Error::from_reason(format!("Failed to get session validations: {}", e))
        })?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

/// Check if files need validation by comparing current hashes to last validated hashes
/// Returns true if any file in the session has changed since last validation
/// Also returns true if the command has changed (different command_hash)
pub fn needs_validation(
    session_id: &str,
    plugin_name: &str,
    hook_name: &str,
    directory: &str,
    command_hash: &str,
) -> napi::Result<bool> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Check if there are any file changes in this session that don't have
    // a matching validation with the same file_hash AND command_hash
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(DISTINCT fc.file_path)
         FROM session_file_changes fc
         LEFT JOIN session_file_validations fv
           ON fc.session_id = fv.session_id
           AND fc.file_path = fv.file_path
           AND fv.plugin_name = ?2
           AND fv.hook_name = ?3
           AND fv.directory = ?4
         WHERE fc.session_id = ?1
           AND (fv.id IS NULL OR fv.file_hash != fc.file_hash_after OR fv.command_hash != ?5)",
            params![session_id, plugin_name, hook_name, directory, command_hash],
            |row| row.get(0),
        )
        .map_err(|e| {
            napi::Error::from_reason(format!("Failed to check validation needs: {}", e))
        })?;

    Ok(count > 0)
}

/// Get files this session modified along with their validation status.
/// This is used for stale detection: TypeScript will compare current disk hash
/// against modification_hash and validation_hash to determine:
/// 1. If the file is stale (modified by another session)
/// 2. If the file needs validation
pub fn get_files_for_validation(
    session_id: &str,
    plugin_name: &str,
    hook_name: &str,
    directory: &str,
) -> napi::Result<Vec<FileValidationStatus>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Get all files this session modified, with their latest validation status (if any)
    let mut stmt = conn
        .prepare(
            "SELECT
            fc.file_path,
            fc.file_hash_after as modification_hash,
            fv.file_hash as validation_hash,
            fv.command_hash as validation_command_hash
         FROM session_file_changes fc
         LEFT JOIN session_file_validations fv
           ON fc.session_id = fv.session_id
           AND fc.file_path = fv.file_path
           AND fv.plugin_name = ?2
           AND fv.hook_name = ?3
           AND fv.directory = ?4
         WHERE fc.session_id = ?1
         GROUP BY fc.file_path
         ORDER BY fc.file_path",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let rows = stmt
        .query_map(
            params![session_id, plugin_name, hook_name, directory],
            |row| {
                Ok(FileValidationStatus {
                    file_path: row.get(0)?,
                    modification_hash: row.get(1)?,
                    validation_hash: row.get(2).ok(),
                    validation_command_hash: row.get(3).ok(),
                })
            },
        )
        .map_err(|e| {
            napi::Error::from_reason(format!("Failed to get files for validation: {}", e))
        })?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

/// Get ALL validations for a session (not filtered by plugin/hook)
/// Useful for showing validation status across all hooks for file changes
pub fn get_all_session_validations(session_id: &str) -> napi::Result<Vec<SessionFileValidation>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, session_id, file_path, file_hash, plugin_name, hook_name, directory, command_hash, validated_at
         FROM session_file_validations
         WHERE session_id = ?1
         ORDER BY file_path, validated_at DESC"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let rows = stmt
        .query_map(params![session_id], |row| {
            Ok(SessionFileValidation {
                id: Some(row.get(0)?),
                session_id: row.get(1)?,
                file_path: row.get(2)?,
                file_hash: row.get(3)?,
                plugin_name: row.get(4)?,
                hook_name: row.get(5)?,
                directory: row.get(6)?,
                command_hash: row.get(7)?,
                validated_at: row.get(8)?,
            })
        })
        .map_err(|e| {
            napi::Error::from_reason(format!("Failed to get session validations: {}", e))
        })?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

/// Delete stale validation records for files that no longer exist.
/// This prevents "ghost" validations from causing infinite re-validation loops.
/// Takes a list of current file paths and deletes any validation records not in that list.
pub fn delete_stale_validations(
    session_id: &str,
    plugin_name: &str,
    hook_name: &str,
    directory: &str,
    current_file_paths: Vec<String>,
) -> napi::Result<u32> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // If no current files, delete ALL validations for this hook/directory combo
    if current_file_paths.is_empty() {
        let deleted = conn
            .execute(
                "DELETE FROM session_file_validations
                 WHERE session_id = ?1 AND plugin_name = ?2 AND hook_name = ?3 AND directory = ?4",
                params![session_id, plugin_name, hook_name, directory],
            )
            .map_err(|e| {
                napi::Error::from_reason(format!("Failed to delete validations: {}", e))
            })?;
        return Ok(deleted as u32);
    }

    // Build a list of placeholders for the IN clause
    let placeholders: Vec<String> = current_file_paths
        .iter()
        .enumerate()
        .map(|(i, _)| format!("?{}", i + 5)) // Start at ?5 since we have 4 params before
        .collect();
    let in_clause = placeholders.join(",");

    let sql = format!(
        "DELETE FROM session_file_validations
         WHERE session_id = ?1 AND plugin_name = ?2 AND hook_name = ?3 AND directory = ?4
         AND file_path NOT IN ({})",
        in_clause
    );

    // Build params: session_id, plugin_name, hook_name, directory, then all file paths
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![
        Box::new(session_id.to_string()),
        Box::new(plugin_name.to_string()),
        Box::new(hook_name.to_string()),
        Box::new(directory.to_string()),
    ];
    for path in current_file_paths {
        params_vec.push(Box::new(path));
    }

    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

    let deleted = conn.execute(&sql, params_refs.as_slice()).map_err(|e| {
        napi::Error::from_reason(format!("Failed to delete stale validations: {}", e))
    })?;

    Ok(deleted as u32)
}

// ============================================================================
// Database Reset Operations
// ============================================================================

/// Truncate all derived tables (those populated from JSONL logs).
/// This is used during reindex to rebuild the database from scratch.
/// Preserves: repos, projects (discovered from disk/git, not from logs)
/// Truncates: sessions, session_files, session_summaries, session_compacts,
///            messages, tasks, hook_executions, frustration_events,
///            session_file_changes, session_file_validations, session_todos
pub fn truncate_derived_tables() -> napi::Result<u32> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Temporarily disable foreign keys for bulk deletion
    conn.execute("PRAGMA foreign_keys=OFF", [])
        .map_err(|e| napi::Error::from_reason(format!("Failed to disable foreign keys: {}", e)))?;

    // Order matters due to foreign key constraints - delete children before parents
    let tables = [
        "session_todos",
        "session_file_validations",
        "session_file_changes",
        "frustration_events",
        "hook_executions",
        "tasks",
        "messages",
        "session_compacts",
        "session_summaries",
        "session_files",
        "sessions",
        "orchestrations", // Also clear orchestrations (has session_id but no FK)
    ];

    let mut total_deleted: u32 = 0;

    for table in tables {
        let deleted = conn
            .execute(&format!("DELETE FROM {}", table), [])
            .map_err(|e| {
                napi::Error::from_reason(format!("Failed to truncate {}: {}", table, e))
            })?;
        total_deleted += deleted as u32;
    }

    // Rebuild FTS index after deleting messages
    conn.execute(
        "INSERT INTO messages_fts(messages_fts) VALUES('rebuild')",
        [],
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to rebuild FTS index: {}", e)))?;

    // Re-enable foreign keys
    conn.execute("PRAGMA foreign_keys=ON", []).map_err(|e| {
        napi::Error::from_reason(format!("Failed to re-enable foreign keys: {}", e))
    })?;

    Ok(total_deleted)
}

// ============================================================================
// Hook Attempt Tracking Operations
// ============================================================================

/// Get or create a hook execution entry for attempt tracking
/// Uses (session_id, hook_name, directory) as the hook key
// Note: Exported via lib.rs wrapper
pub fn get_or_create_hook_attempt(
    session_id: String,
    plugin: String,
    hook_name: String,
    directory: String,
) -> napi::Result<HookAttemptInfo> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Try to find existing record
    let mut stmt = conn
        .prepare(
            "SELECT consecutive_failures, max_attempts FROM hook_executions
         WHERE session_id = ?1 AND hook_source = ?2 AND hook_name = ?3 AND directory = ?4
         ORDER BY executed_at DESC LIMIT 1",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row(params![session_id, plugin, hook_name, directory], |row| {
        let consecutive_failures: i32 = row.get(0)?;
        let max_attempts: i32 = row.get(1)?;
        Ok(HookAttemptInfo {
            consecutive_failures,
            max_attempts,
            is_stuck: consecutive_failures >= max_attempts,
        })
    });

    match result {
        Ok(info) => Ok(info),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            // No existing record - return defaults
            Ok(HookAttemptInfo {
                consecutive_failures: 0,
                max_attempts: 3,
                is_stuck: false,
            })
        }
        Err(e) => Err(napi::Error::from_reason(format!(
            "Failed to get hook attempt: {}",
            e
        ))),
    }
}

/// Increment consecutive_failures for a hook, returns updated info with is_stuck flag
// Note: Exported via lib.rs wrapper
pub fn increment_hook_failures(
    session_id: String,
    plugin: String,
    hook_name: String,
    directory: String,
) -> napi::Result<HookAttemptInfo> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Update the most recent hook execution for this session/plugin/hook/directory
    conn.execute(
        "UPDATE hook_executions SET consecutive_failures = consecutive_failures + 1
         WHERE id = (
             SELECT id FROM hook_executions
             WHERE session_id = ?1 AND hook_source = ?2 AND hook_name = ?3 AND directory = ?4
             ORDER BY executed_at DESC LIMIT 1
         )",
        params![session_id, plugin, hook_name, directory],
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to increment failures: {}", e)))?;

    // Get the updated values
    let mut stmt = conn
        .prepare(
            "SELECT consecutive_failures, max_attempts FROM hook_executions
         WHERE session_id = ?1 AND hook_source = ?2 AND hook_name = ?3 AND directory = ?4
         ORDER BY executed_at DESC LIMIT 1",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    stmt.query_row(params![session_id, plugin, hook_name, directory], |row| {
        let consecutive_failures: i32 = row.get(0)?;
        let max_attempts: i32 = row.get(1)?;
        Ok(HookAttemptInfo {
            consecutive_failures,
            max_attempts,
            is_stuck: consecutive_failures >= max_attempts,
        })
    })
    .map_err(|e| napi::Error::from_reason(format!("Failed to get updated attempt info: {}", e)))
}

/// Reset consecutive_failures to 0 (on success)
// Note: Exported via lib.rs wrapper
pub fn reset_hook_failures(
    session_id: String,
    plugin: String,
    hook_name: String,
    directory: String,
) -> napi::Result<()> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    conn.execute(
        "UPDATE hook_executions SET consecutive_failures = 0
         WHERE id = (
             SELECT id FROM hook_executions
             WHERE session_id = ?1 AND hook_source = ?2 AND hook_name = ?3 AND directory = ?4
             ORDER BY executed_at DESC LIMIT 1
         )",
        params![session_id, plugin, hook_name, directory],
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to reset failures: {}", e)))?;

    Ok(())
}

/// Increase max_attempts for a hook (user override)
// Note: Exported via lib.rs wrapper
pub fn increase_hook_max_attempts(
    session_id: String,
    plugin: String,
    hook_name: String,
    directory: String,
    increase: i32,
) -> napi::Result<()> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    conn.execute(
        "UPDATE hook_executions SET max_attempts = max_attempts + ?5
         WHERE id = (
             SELECT id FROM hook_executions
             WHERE session_id = ?1 AND hook_source = ?2 AND hook_name = ?3 AND directory = ?4
             ORDER BY executed_at DESC LIMIT 1
         )",
        params![session_id, plugin, hook_name, directory, increase],
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to increase max attempts: {}", e)))?;

    Ok(())
}

// ============================================================================
// Orchestration Operations
// ============================================================================

/// Create a new orchestration, cancelling any existing running orchestration for the same session
// Note: Exported via lib.rs wrapper
pub fn create_orchestration(input: OrchestrationInput) -> napi::Result<Orchestration> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Cancel any existing running orchestration for the same session (if session_id provided)
    if let Some(ref session_id) = input.session_id {
        conn.execute(
            "UPDATE orchestrations SET status = 'cancelled', completed_at = datetime('now')
             WHERE session_id = ?1 AND status = 'running'",
            params![session_id],
        )
        .map_err(|e| {
            napi::Error::from_reason(format!("Failed to cancel existing orchestration: {}", e))
        })?;

        // Also cancel any pending/running hooks from cancelled orchestrations
        conn.execute(
            "UPDATE hook_executions SET status = 'cancelled'
             WHERE orchestration_id IN (
                 SELECT id FROM orchestrations WHERE session_id = ?1 AND status = 'cancelled'
             ) AND status IN ('pending', 'running')",
            params![session_id],
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to cancel pending hooks: {}", e)))?;
    }

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO orchestrations (id, session_id, hook_type, project_root, status, total_hooks, completed_hooks, failed_hooks, deferred_hooks, created_at)
         VALUES (?1, ?2, ?3, ?4, 'running', 0, 0, 0, 0, ?5)",
        params![id, input.session_id, input.hook_type, input.project_root, now],
    ).map_err(|e| napi::Error::from_reason(format!("Failed to create orchestration: {}", e)))?;

    Ok(Orchestration {
        id,
        session_id: input.session_id,
        hook_type: input.hook_type,
        project_root: input.project_root,
        status: "running".to_string(),
        total_hooks: 0,
        completed_hooks: 0,
        failed_hooks: 0,
        deferred_hooks: 0,
        created_at: Some(now),
        completed_at: None,
    })
}

/// Get an orchestration by ID
// Note: Exported via lib.rs wrapper
pub fn get_orchestration(id: String) -> napi::Result<Option<Orchestration>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, session_id, hook_type, project_root, status, total_hooks, completed_hooks, failed_hooks, deferred_hooks, created_at, completed_at
         FROM orchestrations WHERE id = ?1"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row(params![id], |row| {
        Ok(Orchestration {
            id: row.get(0)?,
            session_id: row.get(1)?,
            hook_type: row.get(2)?,
            project_root: row.get(3)?,
            status: row.get(4)?,
            total_hooks: row.get(5)?,
            completed_hooks: row.get(6)?,
            failed_hooks: row.get(7)?,
            deferred_hooks: row.get(8)?,
            created_at: row.get(9)?,
            completed_at: row.get(10)?,
        })
    });

    match result {
        Ok(orch) => Ok(Some(orch)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!(
            "Failed to get orchestration: {}",
            e
        ))),
    }
}

/// Update an orchestration's counters and status
// Note: Exported via lib.rs wrapper
pub fn update_orchestration(update: OrchestrationUpdate) -> napi::Result<()> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut sql_parts = vec![];
    let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    if let Some(status) = &update.status {
        sql_parts.push(format!("status = ?{}", param_values.len() + 1));
        param_values.push(Box::new(status.clone()));

        // Set completed_at if status is terminal
        if status == "completed" || status == "failed" || status == "cancelled" {
            sql_parts.push("completed_at = datetime('now')".to_string());
        }
    }
    if let Some(total) = update.total_hooks {
        sql_parts.push(format!("total_hooks = ?{}", param_values.len() + 1));
        param_values.push(Box::new(total));
    }
    if let Some(completed) = update.completed_hooks {
        sql_parts.push(format!("completed_hooks = ?{}", param_values.len() + 1));
        param_values.push(Box::new(completed));
    }
    if let Some(failed) = update.failed_hooks {
        sql_parts.push(format!("failed_hooks = ?{}", param_values.len() + 1));
        param_values.push(Box::new(failed));
    }
    if let Some(deferred) = update.deferred_hooks {
        sql_parts.push(format!("deferred_hooks = ?{}", param_values.len() + 1));
        param_values.push(Box::new(deferred));
    }

    if sql_parts.is_empty() {
        return Ok(());
    }

    let sql = format!(
        "UPDATE orchestrations SET {} WHERE id = ?{}",
        sql_parts.join(", "),
        param_values.len() + 1
    );
    param_values.push(Box::new(update.id));

    let params: Vec<&dyn rusqlite::ToSql> = param_values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params.as_slice())
        .map_err(|e| napi::Error::from_reason(format!("Failed to update orchestration: {}", e)))?;

    Ok(())
}

/// Cancel an orchestration and all its pending/running hooks
// Note: Exported via lib.rs wrapper
pub fn cancel_orchestration(id: String) -> napi::Result<()> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Cancel the orchestration
    conn.execute(
        "UPDATE orchestrations SET status = 'cancelled', completed_at = datetime('now') WHERE id = ?1 AND status = 'running'",
        params![id],
    ).map_err(|e| napi::Error::from_reason(format!("Failed to cancel orchestration: {}", e)))?;

    // Cancel all pending/running hooks in this orchestration
    conn.execute(
        "UPDATE hook_executions SET status = 'cancelled' WHERE orchestration_id = ?1 AND status IN ('pending', 'running')",
        params![id],
    ).map_err(|e| napi::Error::from_reason(format!("Failed to cancel hooks: {}", e)))?;

    Ok(())
}

// ============================================================================
// Pending Hook Operations (for deferred execution)
// ============================================================================

/// Queue a pending hook for background execution
// Note: Exported via lib.rs wrapper
pub fn queue_pending_hook(input: PendingHookInput) -> napi::Result<String> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Ensure session exists before inserting (avoids FK constraint violation)
    if let Some(ref session_id) = input.session_id {
        ensure_session_exists(&conn, session_id).map_err(|e| {
            napi::Error::from_reason(format!("Failed to ensure session exists: {}", e))
        })?;
    }

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO hook_executions (id, orchestration_id, session_id, hook_type, hook_name, hook_source, directory, command, if_changed, executed_at, status, consecutive_failures, max_attempts, duration_ms, exit_code, passed, pid, plugin_root)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'pending', 0, 3, 0, 0, 0, ?11, ?12)",
        params![id, input.orchestration_id, input.session_id, input.hook_type, input.hook_name, input.plugin, input.directory, input.command, input.if_changed, now, input.pid, input.plugin_root],
    ).map_err(|e| napi::Error::from_reason(format!("Failed to queue pending hook: {}", e)))?;

    Ok(id)
}

/// Get all pending hooks ready to run
// Note: Exported via lib.rs wrapper
pub fn get_pending_hooks() -> napi::Result<Vec<HookExecution>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, orchestration_id, session_id, task_id, hook_type, hook_name, hook_source, directory, duration_ms, exit_code, passed, output, error, if_changed, command, executed_at, status, consecutive_failures, max_attempts, pid, plugin_root
         FROM hook_executions WHERE status = 'pending' ORDER BY executed_at ASC"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(HookExecution {
                id: Some(row.get(0)?),
                orchestration_id: row.get(1)?,
                session_id: row.get(2)?,
                task_id: row.get(3)?,
                hook_type: row.get(4)?,
                hook_name: row.get(5)?,
                hook_source: row.get(6)?,
                directory: row.get(7)?,
                duration_ms: row.get(8)?,
                exit_code: row.get(9)?,
                passed: row.get::<_, i32>(10)? != 0,
                output: row.get(11)?,
                error: row.get(12)?,
                if_changed: row.get(13)?,
                command: row.get(14)?,
                executed_at: row.get(15)?,
                status: row.get(16)?,
                consecutive_failures: row.get(17)?,
                max_attempts: row.get(18)?,
                pid: row.get(19)?,
                plugin_root: row.get(20)?,
            })
        })
        .map_err(|e| napi::Error::from_reason(format!("Failed to get pending hooks: {}", e)))?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

/// Update hook execution status
// Note: Exported via lib.rs wrapper
pub fn update_hook_status(id: String, status: String) -> napi::Result<()> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    conn.execute(
        "UPDATE hook_executions SET status = ?2 WHERE id = ?1",
        params![id, status],
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to update hook status: {}", e)))?;

    Ok(())
}

/// Get pending/running/failed hooks for an orchestration
// Note: Exported via lib.rs wrapper
pub fn get_orchestration_hooks(orchestration_id: String) -> napi::Result<Vec<HookExecution>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, orchestration_id, session_id, task_id, hook_type, hook_name, hook_source, directory, duration_ms, exit_code, passed, output, error, if_changed, command, executed_at, status, consecutive_failures, max_attempts, pid, plugin_root
         FROM hook_executions WHERE orchestration_id = ?1 ORDER BY executed_at ASC"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let rows = stmt
        .query_map(params![orchestration_id], |row| {
            Ok(HookExecution {
                id: Some(row.get(0)?),
                orchestration_id: row.get(1)?,
                session_id: row.get(2)?,
                task_id: row.get(3)?,
                hook_type: row.get(4)?,
                hook_name: row.get(5)?,
                hook_source: row.get(6)?,
                directory: row.get(7)?,
                duration_ms: row.get(8)?,
                exit_code: row.get(9)?,
                passed: row.get::<_, i32>(10)? != 0,
                output: row.get(11)?,
                error: row.get(12)?,
                if_changed: row.get(13)?,
                command: row.get(14)?,
                executed_at: row.get(15)?,
                status: row.get(16)?,
                consecutive_failures: row.get(17)?,
                max_attempts: row.get(18)?,
                pid: row.get(19)?,
                plugin_root: row.get(20)?,
            })
        })
        .map_err(|e| {
            napi::Error::from_reason(format!("Failed to get orchestration hooks: {}", e))
        })?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

/// Get pending/running hooks for a session (legacy support)
// Note: Exported via lib.rs wrapper
pub fn get_session_pending_hooks(session_id: String) -> napi::Result<Vec<HookExecution>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, orchestration_id, session_id, task_id, hook_type, hook_name, hook_source, directory, duration_ms, exit_code, passed, output, error, if_changed, command, executed_at, status, consecutive_failures, max_attempts, pid, plugin_root
         FROM hook_executions WHERE session_id = ?1 AND status IN ('pending', 'running', 'failed') ORDER BY executed_at ASC"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let rows = stmt
        .query_map(params![session_id], |row| {
            Ok(HookExecution {
                id: Some(row.get(0)?),
                orchestration_id: row.get(1)?,
                session_id: row.get(2)?,
                task_id: row.get(3)?,
                hook_type: row.get(4)?,
                hook_name: row.get(5)?,
                hook_source: row.get(6)?,
                directory: row.get(7)?,
                duration_ms: row.get(8)?,
                exit_code: row.get(9)?,
                passed: row.get::<_, i32>(10)? != 0,
                output: row.get(11)?,
                error: row.get(12)?,
                if_changed: row.get(13)?,
                command: row.get(14)?,
                executed_at: row.get(15)?,
                status: row.get(16)?,
                consecutive_failures: row.get(17)?,
                max_attempts: row.get(18)?,
                pid: row.get(19)?,
                plugin_root: row.get(20)?,
            })
        })
        .map_err(|e| {
            napi::Error::from_reason(format!("Failed to get session pending hooks: {}", e))
        })?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

/// Mark a hook as failed with a given error message
// Note: Exported via lib.rs wrapper
pub fn fail_hook_execution(id: String, error_message: String) -> napi::Result<()> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    conn.execute(
        "UPDATE hook_executions SET status = 'failed', error = ?2, passed = 0 WHERE id = ?1",
        params![id, error_message],
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to fail hook: {}", e)))?;

    Ok(())
}

/// Complete a hook execution (update status, output, error, duration)
// Note: Exported via lib.rs wrapper
pub fn complete_hook_execution(
    id: String,
    success: bool,
    output: Option<String>,
    error: Option<String>,
    duration_ms: i32,
) -> napi::Result<()> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let status = if success { "completed" } else { "failed" };
    let exit_code = if success { 0 } else { 1 };

    conn.execute(
        "UPDATE hook_executions SET status = ?2, passed = ?3, exit_code = ?4, output = ?5, error = ?6, duration_ms = ?7 WHERE id = ?1",
        params![id, status, success as i32, exit_code, output, error, duration_ms],
    ).map_err(|e| napi::Error::from_reason(format!("Failed to complete hook execution: {}", e)))?;

    Ok(())
}

// ============================================================================
// Pending Hooks Queue (for --check mode orchestrations)
// ============================================================================

/// Queue a hook for later execution during --wait
// Note: Exported via lib.rs wrapper
pub fn queue_hook(input: QueuedHookInput) -> napi::Result<String> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO pending_hooks (id, orchestration_id, plugin, hook_name, directory, if_changed, command)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            id,
            input.orchestration_id,
            input.plugin,
            input.hook_name,
            input.directory,
            input.if_changed,
            input.command
        ],
    ).map_err(|e| napi::Error::from_reason(format!("Failed to queue hook: {}", e)))?;

    Ok(id)
}

/// Get all queued hooks for an orchestration
// Note: Exported via lib.rs wrapper
pub fn get_queued_hooks(orchestration_id: String) -> napi::Result<Vec<QueuedHook>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, orchestration_id, plugin, hook_name, directory, if_changed, command, queued_at
         FROM pending_hooks WHERE orchestration_id = ?1 ORDER BY queued_at ASC"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let rows = stmt
        .query_map([orchestration_id], |row| {
            Ok(QueuedHook {
                id: row.get(0)?,
                orchestration_id: row.get(1)?,
                plugin: row.get(2)?,
                hook_name: row.get(3)?,
                directory: row.get(4)?,
                if_changed: row.get(5)?,
                command: row.get(6)?,
                queued_at: row.get(7)?,
            })
        })
        .map_err(|e| napi::Error::from_reason(format!("Failed to query queued hooks: {}", e)))?;

    let mut hooks = Vec::new();
    for row in rows {
        hooks.push(row.map_err(|e| napi::Error::from_reason(format!("Failed to map row: {}", e)))?);
    }

    Ok(hooks)
}

/// Delete queued hooks after they've been executed
// Note: Exported via lib.rs wrapper
pub fn delete_queued_hooks(orchestration_id: String) -> napi::Result<u32> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let deleted = conn
        .execute(
            "DELETE FROM pending_hooks WHERE orchestration_id = ?1",
            params![orchestration_id],
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to delete queued hooks: {}", e)))?;

    Ok(deleted as u32)
}

// ============================================================================
// Async Hook Queue (for PostToolUse async hook execution)
// ============================================================================

/// Input for enqueuing an async hook
#[napi(object)]
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct AsyncHookQueueInputNative {
    pub session_id: String,
    pub cwd: String,
    pub plugin: String,
    pub hook_name: String,
    pub file_paths: Vec<String>,
    pub command: String,
}

/// Output for async hook queue entry
#[napi(object)]
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct AsyncHookQueueEntry {
    pub id: String,
    pub session_id: String,
    pub cwd: String,
    pub plugin: String,
    pub hook_name: String,
    pub file_paths: Vec<String>,
    pub command: String,
    pub status: String,
    pub created_at: String,
}

/// Enqueue a hook for async execution
/// First cancels any pending hooks with the same dedup key (session, cwd, plugin, hook_name)
/// and merges their file paths into the new entry
// Note: Exported via lib.rs wrapper
pub fn enqueue_async_hook(
    _db_path: String,
    input: AsyncHookQueueInputNative,
) -> napi::Result<String> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let id = Uuid::new_v4().to_string();

    // First, collect file paths from any pending hooks with the same dedup key
    // and cancel them
    let mut merged_files: std::collections::HashSet<String> =
        input.file_paths.iter().cloned().collect();

    let mut stmt = conn.prepare(
        "SELECT id, file_paths FROM async_hook_queue
         WHERE session_id = ?1 AND cwd = ?2 AND plugin = ?3 AND hook_name = ?4 AND status = 'pending'"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let rows: Vec<(String, String)> = stmt
        .query_map(
            params![input.session_id, input.cwd, input.plugin, input.hook_name],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to query pending hooks: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    for (_, file_paths_json) in &rows {
        if let Ok(paths) = serde_json::from_str::<Vec<String>>(file_paths_json) {
            for path in paths {
                merged_files.insert(path);
            }
        }
    }

    // Cancel the pending hooks
    if !rows.is_empty() {
        conn.execute(
            "UPDATE async_hook_queue SET status = 'cancelled', completed_at = datetime('now')
             WHERE session_id = ?1 AND cwd = ?2 AND plugin = ?3 AND hook_name = ?4 AND status = 'pending'",
            params![input.session_id, input.cwd, input.plugin, input.hook_name],
        ).map_err(|e| napi::Error::from_reason(format!("Failed to cancel pending hooks: {}", e)))?;
    }

    // Insert the new entry with merged file paths
    let file_paths_json = serde_json::to_string(&merged_files.into_iter().collect::<Vec<_>>())
        .map_err(|e| napi::Error::from_reason(format!("Failed to serialize file paths: {}", e)))?;

    conn.execute(
        "INSERT INTO async_hook_queue (id, session_id, cwd, plugin, hook_name, file_paths, command, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending')",
        params![
            id,
            input.session_id,
            input.cwd,
            input.plugin,
            input.hook_name,
            file_paths_json,
            input.command
        ],
    ).map_err(|e| napi::Error::from_reason(format!("Failed to enqueue async hook: {}", e)))?;

    Ok(id)
}

/// List pending async hooks for a session
// Note: Exported via lib.rs wrapper
pub fn list_pending_async_hooks(
    _db_path: String,
    session_id: String,
) -> napi::Result<Vec<AsyncHookQueueEntry>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, session_id, cwd, plugin, hook_name, file_paths, command, status, created_at
         FROM async_hook_queue WHERE session_id = ?1 AND status = 'pending' ORDER BY created_at ASC"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let rows = stmt
        .query_map([session_id], |row| {
            let file_paths_json: String = row.get(5)?;
            let file_paths: Vec<String> =
                serde_json::from_str(&file_paths_json).unwrap_or_default();
            Ok(AsyncHookQueueEntry {
                id: row.get(0)?,
                session_id: row.get(1)?,
                cwd: row.get(2)?,
                plugin: row.get(3)?,
                hook_name: row.get(4)?,
                file_paths,
                command: row.get(6)?,
                status: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| napi::Error::from_reason(format!("Failed to query pending hooks: {}", e)))?;

    let mut hooks = Vec::new();
    for row in rows {
        hooks.push(row.map_err(|e| napi::Error::from_reason(format!("Failed to map row: {}", e)))?);
    }

    Ok(hooks)
}

/// Check if the async hook queue is empty for a session (no pending or running hooks)
// Note: Exported via lib.rs wrapper
pub fn is_async_hook_queue_empty(_db_path: String, session_id: String) -> napi::Result<bool> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM async_hook_queue WHERE session_id = ?1 AND status IN ('pending', 'running')",
        params![session_id],
        |row| row.get(0),
    ).map_err(|e| napi::Error::from_reason(format!("Failed to count queue: {}", e)))?;

    Ok(count == 0)
}

/// Drain the queue - get all pending hooks and mark as running
/// Used at checkpoint (Stop, PreToolUse for git commit/push)
// Note: Exported via lib.rs wrapper
pub fn drain_async_hook_queue(
    _db_path: String,
    session_id: String,
) -> napi::Result<Vec<AsyncHookQueueEntry>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // First, get all pending hooks
    let mut stmt = conn.prepare(
        "SELECT id, session_id, cwd, plugin, hook_name, file_paths, command, status, created_at
         FROM async_hook_queue WHERE session_id = ?1 AND status = 'pending' ORDER BY created_at ASC"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let rows = stmt
        .query_map([&session_id], |row| {
            let file_paths_json: String = row.get(5)?;
            let file_paths: Vec<String> =
                serde_json::from_str(&file_paths_json).unwrap_or_default();
            Ok(AsyncHookQueueEntry {
                id: row.get(0)?,
                session_id: row.get(1)?,
                cwd: row.get(2)?,
                plugin: row.get(3)?,
                hook_name: row.get(4)?,
                file_paths,
                command: row.get(6)?,
                status: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| napi::Error::from_reason(format!("Failed to query pending hooks: {}", e)))?;

    let mut hooks = Vec::new();
    for row in rows {
        hooks.push(row.map_err(|e| napi::Error::from_reason(format!("Failed to map row: {}", e)))?);
    }

    // Mark them all as running
    conn.execute(
        "UPDATE async_hook_queue SET status = 'running', started_at = datetime('now')
         WHERE session_id = ?1 AND status = 'pending'",
        params![session_id],
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to update hook status: {}", e)))?;

    Ok(hooks)
}

/// Cancel pending hooks matching dedup key and return merged file paths
// Note: Exported via lib.rs wrapper
pub fn cancel_pending_async_hooks(
    _db_path: String,
    session_id: String,
    cwd: String,
    plugin: String,
    hook_name: String,
) -> napi::Result<Vec<String>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut merged_files: std::collections::HashSet<String> = std::collections::HashSet::new();

    let mut stmt = conn.prepare(
        "SELECT file_paths FROM async_hook_queue
         WHERE session_id = ?1 AND cwd = ?2 AND plugin = ?3 AND hook_name = ?4 AND status = 'pending'"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let rows: Vec<String> = stmt
        .query_map(params![session_id, cwd, plugin, hook_name], |row| {
            row.get::<_, String>(0)
        })
        .map_err(|e| napi::Error::from_reason(format!("Failed to query pending hooks: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    for file_paths_json in rows {
        if let Ok(paths) = serde_json::from_str::<Vec<String>>(&file_paths_json) {
            for path in paths {
                merged_files.insert(path);
            }
        }
    }

    // Cancel the pending hooks
    conn.execute(
        "UPDATE async_hook_queue SET status = 'cancelled', completed_at = datetime('now')
         WHERE session_id = ?1 AND cwd = ?2 AND plugin = ?3 AND hook_name = ?4 AND status = 'pending'",
        params![session_id, cwd, plugin, hook_name],
    ).map_err(|e| napi::Error::from_reason(format!("Failed to cancel pending hooks: {}", e)))?;

    Ok(merged_files.into_iter().collect())
}

/// Complete an async hook execution
// Note: Exported via lib.rs wrapper
pub fn complete_async_hook(
    _db_path: String,
    id: String,
    success: bool,
    result: Option<String>,
    error: Option<String>,
) -> napi::Result<()> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let status = if success { "completed" } else { "failed" };

    conn.execute(
        "UPDATE async_hook_queue SET status = ?2, completed_at = datetime('now'), result = ?3, error = ?4
         WHERE id = ?1",
        params![id, status, result, error],
    ).map_err(|e| napi::Error::from_reason(format!("Failed to complete async hook: {}", e)))?;

    Ok(())
}

/// Cancel a specific async hook by ID
// Note: Exported via lib.rs wrapper
pub fn cancel_async_hook(_db_path: String, id: String) -> napi::Result<()> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    conn.execute(
        "UPDATE async_hook_queue SET status = 'cancelled', completed_at = datetime('now')
         WHERE id = ?1",
        params![id],
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to cancel async hook: {}", e)))?;

    Ok(())
}

/// Clear all async hooks for a session (used on SessionEnd to clean up)
/// Returns the number of hooks that were cleared
// Note: Exported via lib.rs wrapper
pub fn clear_async_hook_queue_for_session(
    _db_path: String,
    session_id: String,
) -> napi::Result<u32> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Cancel all pending/running hooks for this session
    let count = conn
        .execute(
            "UPDATE async_hook_queue
         SET status = 'cancelled', completed_at = datetime('now')
         WHERE session_id = ?1 AND status IN ('pending', 'running')",
            params![session_id],
        )
        .map_err(|e| {
            napi::Error::from_reason(format!("Failed to clear async hook queue: {}", e))
        })?;

    Ok(count as u32)
}

// ============================================================================
// Dashboard SQL Aggregation Functions
// ============================================================================

/// Query all dashboard analytics data using SQL aggregation.
/// Replaces ~850 DB round-trips with ~10 SQL queries in one function call.
pub fn query_dashboard_aggregates(cutoff_date: &str) -> napi::Result<DashboardAggregates> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // 1. Tool usage (top 20)
    let tool_usage = {
        let mut stmt = conn
            .prepare(
                "SELECT tool_name, COUNT(*) as cnt
                 FROM messages
                 WHERE tool_name IS NOT NULL AND timestamp > ?1
                 GROUP BY tool_name
                 ORDER BY cnt DESC
                 LIMIT 20",
            )
            .map_err(|e| napi::Error::from_reason(format!("tool_usage prepare: {}", e)))?;
        let rows = stmt
            .query_map(params![cutoff_date], |row| {
                Ok(ToolUsageRow {
                    tool_name: row.get(0)?,
                    count: row.get(1)?,
                })
            })
            .map_err(|e| napi::Error::from_reason(format!("tool_usage query: {}", e)))?;
        rows.filter_map(|r| r.ok()).collect::<Vec<_>>()
    };

    // 2. Subagent usage (from Task tool calls)
    let subagent_usage = {
        let mut stmt = conn
            .prepare(
                "SELECT COALESCE(
                    json_extract(tool_input, '$.subagent_type'),
                    json_extract(tool_input, '$.subagentType'),
                    'general-purpose'
                 ) as stype, COUNT(*) as cnt
                 FROM messages
                 WHERE tool_name = 'Task' AND timestamp > ?1
                 GROUP BY stype
                 ORDER BY cnt DESC",
            )
            .map_err(|e| napi::Error::from_reason(format!("subagent_usage prepare: {}", e)))?;
        let rows = stmt
            .query_map(params![cutoff_date], |row| {
                Ok(SubagentUsageRow {
                    subagent_type: row.get(0)?,
                    count: row.get(1)?,
                })
            })
            .map_err(|e| napi::Error::from_reason(format!("subagent_usage query: {}", e)))?;
        rows.filter_map(|r| r.ok()).collect::<Vec<_>>()
    };

    // 3. Token totals
    let (
        total_input_tokens,
        total_output_tokens,
        total_cache_read_tokens,
        total_sessions,
        total_messages,
    ) = conn
        .query_row(
            "SELECT COALESCE(SUM(input_tokens), 0),
                    COALESCE(SUM(output_tokens), 0),
                    COALESCE(SUM(cache_read_tokens), 0),
                    COUNT(DISTINCT session_id),
                    COUNT(*)
             FROM messages
             WHERE message_type = 'assistant' AND timestamp > ?1",
            params![cutoff_date],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, i64>(4)?,
                ))
            },
        )
        .map_err(|e| napi::Error::from_reason(format!("token totals: {}", e)))?;

    // 4. Daily costs
    let daily_costs = {
        let mut stmt = conn
            .prepare(
                "SELECT date(timestamp) as d,
                        COALESCE(SUM(input_tokens), 0),
                        COALESCE(SUM(output_tokens), 0),
                        COALESCE(SUM(cache_read_tokens), 0),
                        COUNT(DISTINCT session_id)
                 FROM messages
                 WHERE message_type = 'assistant' AND timestamp > ?1
                 GROUP BY d
                 ORDER BY d",
            )
            .map_err(|e| napi::Error::from_reason(format!("daily_costs prepare: {}", e)))?;
        let rows = stmt
            .query_map(params![cutoff_date], |row| {
                Ok(DailyCostRow {
                    date: row.get(0)?,
                    input_tokens: row.get(1)?,
                    output_tokens: row.get(2)?,
                    cache_read_tokens: row.get(3)?,
                    session_count: row.get(4)?,
                })
            })
            .map_err(|e| napi::Error::from_reason(format!("daily_costs query: {}", e)))?;
        rows.filter_map(|r| r.ok()).collect::<Vec<_>>()
    };

    // 5. Per-session stats (costs + effectiveness)
    let session_stats = {
        let mut stmt = conn
            .prepare(
                "SELECT m.session_id,
                        s.slug,
                        COALESCE(SUM(m.input_tokens), 0),
                        COALESCE(SUM(m.output_tokens), 0),
                        COALESCE(SUM(m.cache_read_tokens), 0),
                        COUNT(CASE WHEN m.message_type IN ('human', 'user') THEN 1 END),
                        COUNT(DISTINCT m.tool_name),
                        MIN(m.timestamp),
                        COUNT(*)
                 FROM messages m
                 JOIN sessions s ON s.id = m.session_id
                 WHERE m.timestamp > ?1
                 GROUP BY m.session_id",
            )
            .map_err(|e| napi::Error::from_reason(format!("session_stats prepare: {}", e)))?;
        let rows = stmt
            .query_map(params![cutoff_date], |row| {
                Ok(SessionStatsRow {
                    session_id: row.get(0)?,
                    slug: row.get(1)?,
                    input_tokens: row.get(2)?,
                    output_tokens: row.get(3)?,
                    cache_read_tokens: row.get(4)?,
                    turn_count: row.get(5)?,
                    unique_tools: row.get(6)?,
                    started_at: row.get(7)?,
                    message_count: row.get(8)?,
                })
            })
            .map_err(|e| napi::Error::from_reason(format!("session_stats query: {}", e)))?;
        rows.filter_map(|r| r.ok()).collect::<Vec<_>>()
    };

    // 6. Compaction totals
    let (total_compactions, total_compaction_sessions) = conn
        .query_row(
            "SELECT COUNT(*), COUNT(DISTINCT session_id)
             FROM messages
             WHERE message_type = 'summary' AND timestamp > ?1",
            params![cutoff_date],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)),
        )
        .map_err(|e| napi::Error::from_reason(format!("compaction totals: {}", e)))?;

    // 7. Per-session compaction counts
    let session_compactions = {
        let mut stmt = conn
            .prepare(
                "SELECT session_id, COUNT(*) as cnt
                 FROM messages
                 WHERE message_type = 'summary' AND timestamp > ?1
                 GROUP BY session_id",
            )
            .map_err(|e| napi::Error::from_reason(format!("session_compactions prepare: {}", e)))?;
        let rows = stmt
            .query_map(params![cutoff_date], |row| {
                Ok(SessionCompactionRow {
                    session_id: row.get(0)?,
                    compaction_count: row.get(1)?,
                })
            })
            .map_err(|e| napi::Error::from_reason(format!("session_compactions query: {}", e)))?;
        rows.filter_map(|r| r.ok()).collect::<Vec<_>>()
    };

    // 8. Per-session sentiment
    let session_sentiments = {
        let mut stmt = conn
            .prepare(
                "SELECT session_id, AVG(sentiment_score) as avg_s
                 FROM messages
                 WHERE sentiment_score IS NOT NULL AND timestamp > ?1
                 GROUP BY session_id",
            )
            .map_err(|e| napi::Error::from_reason(format!("session_sentiments prepare: {}", e)))?;
        let rows = stmt
            .query_map(params![cutoff_date], |row| {
                Ok(SessionSentimentRow {
                    session_id: row.get(0)?,
                    avg_sentiment: row.get(1)?,
                })
            })
            .map_err(|e| napi::Error::from_reason(format!("session_sentiments query: {}", e)))?;
        rows.filter_map(|r| r.ok()).collect::<Vec<_>>()
    };

    // 9. Hook health
    let hook_health = {
        let mut stmt = conn
            .prepare(
                "SELECT hook_name,
                        COUNT(*) as total_runs,
                        SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as pass_count,
                        SUM(CASE WHEN passed = 0 THEN 1 ELSE 0 END) as fail_count,
                        AVG(duration_ms) as avg_dur
                 FROM hook_executions
                 WHERE executed_at > ?1
                 GROUP BY hook_name",
            )
            .map_err(|e| napi::Error::from_reason(format!("hook_health prepare: {}", e)))?;
        let rows = stmt
            .query_map(params![cutoff_date], |row| {
                Ok(HookHealthRow {
                    hook_name: row.get(0)?,
                    total_runs: row.get(1)?,
                    pass_count: row.get(2)?,
                    fail_count: row.get(3)?,
                    avg_duration_ms: row.get::<_, f64>(4).unwrap_or(0.0),
                })
            })
            .map_err(|e| napi::Error::from_reason(format!("hook_health query: {}", e)))?;
        rows.filter_map(|r| r.ok()).collect::<Vec<_>>()
    };

    Ok(DashboardAggregates {
        tool_usage,
        subagent_usage,
        total_input_tokens,
        total_output_tokens,
        total_cache_read_tokens,
        total_sessions,
        total_messages,
        daily_costs,
        session_stats,
        total_compactions,
        total_compaction_sessions,
        session_compactions,
        session_sentiments,
        hook_health,
    })
}

/// Query all activity data using SQL aggregation.
/// Replaces ~425 DB round-trips with ~3 SQL queries in one function call.
pub fn query_activity_aggregates(cutoff_date: &str) -> napi::Result<ActivityAggregates> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // 1. Daily activity (with line changes)
    let daily_activity = {
        let mut stmt = conn
            .prepare(
                "SELECT date(timestamp) as d,
                        COUNT(*) as msg_count,
                        COUNT(DISTINCT session_id) as sess_count,
                        COALESCE(SUM(input_tokens), 0),
                        COALESCE(SUM(output_tokens), 0),
                        COALESCE(SUM(cache_read_tokens), 0),
                        COALESCE(SUM(COALESCE(lines_added, 0)), 0),
                        COALESCE(SUM(COALESCE(lines_removed, 0)), 0),
                        COALESCE(SUM(COALESCE(files_changed, 0)), 0)
                 FROM messages
                 WHERE message_type = 'assistant' AND timestamp > ?1
                 GROUP BY d
                 ORDER BY d",
            )
            .map_err(|e| napi::Error::from_reason(format!("daily_activity prepare: {}", e)))?;
        let rows = stmt
            .query_map(params![cutoff_date], |row| {
                Ok(DailyActivityRow {
                    date: row.get(0)?,
                    message_count: row.get(1)?,
                    session_count: row.get(2)?,
                    input_tokens: row.get(3)?,
                    output_tokens: row.get(4)?,
                    cache_read_tokens: row.get(5)?,
                    lines_added: row.get(6)?,
                    lines_removed: row.get(7)?,
                    files_changed: row.get(8)?,
                })
            })
            .map_err(|e| napi::Error::from_reason(format!("daily_activity query: {}", e)))?;
        rows.filter_map(|r| r.ok()).collect::<Vec<_>>()
    };

    // 2. Hourly activity
    let hourly_activity = {
        let mut stmt = conn
            .prepare(
                "SELECT CAST(strftime('%H', timestamp) AS INTEGER) as hr,
                        COUNT(*) as msg_count,
                        COUNT(DISTINCT session_id) as sess_count
                 FROM messages
                 WHERE message_type = 'assistant' AND timestamp > ?1
                 GROUP BY hr
                 ORDER BY hr",
            )
            .map_err(|e| napi::Error::from_reason(format!("hourly_activity prepare: {}", e)))?;
        let rows = stmt
            .query_map(params![cutoff_date], |row| {
                Ok(HourlyActivityRow {
                    hour: row.get(0)?,
                    message_count: row.get(1)?,
                    session_count: row.get(2)?,
                })
            })
            .map_err(|e| napi::Error::from_reason(format!("hourly_activity query: {}", e)))?;
        rows.filter_map(|r| r.ok()).collect::<Vec<_>>()
    };

    // 3. Token totals
    let (
        total_input_tokens,
        total_output_tokens,
        total_cache_read_tokens,
        total_messages,
        total_sessions,
    ) = conn
        .query_row(
            "SELECT COALESCE(SUM(input_tokens), 0),
                    COALESCE(SUM(output_tokens), 0),
                    COALESCE(SUM(cache_read_tokens), 0),
                    COUNT(*),
                    COUNT(DISTINCT session_id)
             FROM messages
             WHERE message_type = 'assistant' AND timestamp > ?1",
            params![cutoff_date],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, i64>(4)?,
                ))
            },
        )
        .map_err(|e| napi::Error::from_reason(format!("activity token totals: {}", e)))?;

    Ok(ActivityAggregates {
        daily_activity,
        hourly_activity,
        total_input_tokens,
        total_output_tokens,
        total_cache_read_tokens,
        total_messages,
        total_sessions,
    })
}

// ============================================================================
// Test Module
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use rusqlite::Connection;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::OnceLock;
    use tempfile::TempDir;

    // Counter to ensure unique database paths across parallel tests
    static TEST_COUNTER: AtomicUsize = AtomicUsize::new(0);

    /// Create a unique temporary database for testing with full schema
    fn create_test_db() -> (TempDir, Connection) {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let counter = TEST_COUNTER.fetch_add(1, Ordering::SeqCst);
        let db_path = temp_dir.path().join(format!("crud_test_{}.db", counter));
        let db_path_str = db_path.to_string_lossy().to_string();

        // Set CLAUDE_CONFIG_DIR to the temp dir so get_db() uses our test database
        std::env::set_var(
            "CLAUDE_CONFIG_DIR",
            temp_dir.path().to_string_lossy().to_string(),
        );

        let conn = Connection::open(&db_path_str).expect("Failed to open test database");
        conn.execute_batch("PRAGMA journal_mode=WAL;").unwrap();
        conn.execute_batch("PRAGMA synchronous=NORMAL;").unwrap();
        conn.execute_batch("PRAGMA foreign_keys=ON;").unwrap();
        conn.execute_batch("PRAGMA busy_timeout=5000;").unwrap();
        conn.execute_batch(include_str!("schema.sql")).unwrap();

        (temp_dir, conn)
    }

    // Shared test database directory - all tests use the same DB
    static TEST_DIR: OnceLock<TempDir> = OnceLock::new();

    /// Helper to initialize the global DB singleton with a test database
    /// All tests share the same database - use unique IDs to avoid conflicts
    fn init_test_db_singleton() -> &'static TempDir {
        TEST_DIR.get_or_init(|| {
            let temp_dir = TempDir::new().expect("Failed to create temp dir");
            std::env::set_var(
                "CLAUDE_CONFIG_DIR",
                temp_dir.path().to_string_lossy().to_string(),
            );
            // Force db initialization
            let _ = db::get_db();
            temp_dir
        })
    }

    // ========================================================================
    // Repo Operations Tests
    // ========================================================================

    #[test]
    fn test_upsert_repo_insert() {
        let _temp_dir = init_test_db_singleton();

        let input = RepoInput {
            remote: "https://github.com/test/repo".to_string(),
            name: "test-repo".to_string(),
            default_branch: Some("main".to_string()),
        };

        let result = upsert_repo(input).expect("Failed to upsert repo");

        assert!(result.id.is_some());
        assert_eq!(result.remote, "https://github.com/test/repo");
        assert_eq!(result.name, "test-repo");
        assert_eq!(result.default_branch, Some("main".to_string()));
        assert!(result.created_at.is_some());
        assert!(result.updated_at.is_some());
    }

    #[test]
    fn test_upsert_repo_update() {
        let _temp_dir = init_test_db_singleton();

        // Insert first
        let input1 = RepoInput {
            remote: "https://github.com/test/update-repo".to_string(),
            name: "original-name".to_string(),
            default_branch: Some("master".to_string()),
        };
        let repo1 = upsert_repo(input1).expect("Failed to insert repo");

        // Update with same remote
        let input2 = RepoInput {
            remote: "https://github.com/test/update-repo".to_string(),
            name: "updated-name".to_string(),
            default_branch: Some("main".to_string()),
        };
        let repo2 = upsert_repo(input2).expect("Failed to update repo");

        // Should be the same record (same ID), but updated fields
        assert_eq!(repo1.id, repo2.id);
        assert_eq!(repo2.name, "updated-name");
        assert_eq!(repo2.default_branch, Some("main".to_string()));
    }

    #[test]
    fn test_get_repo_by_remote_found() {
        let _temp_dir = init_test_db_singleton();

        let input = RepoInput {
            remote: "https://github.com/test/findable".to_string(),
            name: "findable".to_string(),
            default_branch: None,
        };
        upsert_repo(input).expect("Failed to insert repo");

        let result =
            get_repo_by_remote("https://github.com/test/findable").expect("Query should succeed");

        assert!(result.is_some());
        let repo = result.unwrap();
        assert_eq!(repo.name, "findable");
    }

    #[test]
    fn test_get_repo_by_remote_not_found() {
        let _temp_dir = init_test_db_singleton();

        let result = get_repo_by_remote("https://github.com/nonexistent/repo")
            .expect("Query should succeed");

        assert!(result.is_none());
    }

    #[test]
    fn test_list_repos() {
        let _temp_dir = init_test_db_singleton();

        // Insert multiple repos
        for i in 0..3 {
            let input = RepoInput {
                remote: format!("https://github.com/test/list-repo-{}", i),
                name: format!("list-repo-{}", i),
                default_branch: None,
            };
            upsert_repo(input).expect("Failed to insert repo");
        }

        let repos = list_repos().expect("Failed to list repos");
        assert!(repos.len() >= 3);
    }

    // ========================================================================
    // Project Operations Tests
    // ========================================================================

    #[test]
    fn test_upsert_project_insert() {
        let _temp_dir = init_test_db_singleton();

        let input = ProjectInput {
            repo_id: None,
            slug: "test-project-slug".to_string(),
            path: "/path/to/test/project".to_string(),
            relative_path: Some("project".to_string()),
            name: "Test Project".to_string(),
            is_worktree: Some(false),
            source_config_dir: None,
        };

        let result = upsert_project(input).expect("Failed to upsert project");

        assert!(result.id.is_some());
        assert_eq!(result.slug, "test-project-slug");
        assert_eq!(result.path, "/path/to/test/project");
        assert_eq!(result.name, "Test Project");
        assert!(!result.is_worktree);
    }

    #[test]
    fn test_upsert_project_update() {
        let _temp_dir = init_test_db_singleton();

        // Insert first
        let input1 = ProjectInput {
            repo_id: None,
            slug: "update-project-slug".to_string(),
            path: "/original/path".to_string(),
            relative_path: None,
            name: "Original".to_string(),
            is_worktree: None,
            source_config_dir: None,
        };
        let proj1 = upsert_project(input1).expect("Failed to insert project");

        // Update with same slug
        let input2 = ProjectInput {
            repo_id: None,
            slug: "update-project-slug".to_string(),
            path: "/updated/path".to_string(),
            relative_path: None,
            name: "Updated".to_string(),
            is_worktree: Some(true),
            source_config_dir: None,
        };
        let proj2 = upsert_project(input2).expect("Failed to update project");

        assert_eq!(proj1.id, proj2.id);
        assert_eq!(proj2.path, "/updated/path");
        assert_eq!(proj2.name, "Updated");
        assert!(proj2.is_worktree);
    }

    #[test]
    fn test_get_project_by_slug() {
        let _temp_dir = init_test_db_singleton();

        let input = ProjectInput {
            repo_id: None,
            slug: "findable-project".to_string(),
            path: "/path/to/findable".to_string(),
            relative_path: None,
            name: "Findable".to_string(),
            is_worktree: None,
            source_config_dir: None,
        };
        upsert_project(input).expect("Failed to insert project");

        let result = get_project_by_slug("findable-project").expect("Query should succeed");
        assert!(result.is_some());
        assert_eq!(result.unwrap().name, "Findable");
    }

    #[test]
    fn test_get_project_by_path() {
        let _temp_dir = init_test_db_singleton();

        let input = ProjectInput {
            repo_id: None,
            slug: "path-lookup-project".to_string(),
            path: "/unique/path/for/lookup".to_string(),
            relative_path: None,
            name: "PathLookup".to_string(),
            is_worktree: None,
            source_config_dir: None,
        };
        upsert_project(input).expect("Failed to insert project");

        let result = get_project_by_path("/unique/path/for/lookup").expect("Query should succeed");
        assert!(result.is_some());
        assert_eq!(result.unwrap().slug, "path-lookup-project");
    }

    #[test]
    fn test_list_projects_all() {
        let _temp_dir = init_test_db_singleton();

        for i in 0..3 {
            let input = ProjectInput {
                repo_id: None,
                slug: format!("list-project-{}", i),
                path: format!("/path/to/list-project-{}", i),
                relative_path: None,
                name: format!("ListProject{}", i),
                is_worktree: None,
                source_config_dir: None,
            };
            upsert_project(input).expect("Failed to insert project");
        }

        let projects = list_projects(None).expect("Failed to list projects");
        assert!(projects.len() >= 3);
    }

    // ========================================================================
    // Session Operations Tests
    // ========================================================================

    #[test]
    fn test_upsert_session_insert() {
        let _temp_dir = init_test_db_singleton();

        let input = SessionInput {
            id: "test-session-001".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: Some("/path/to/transcript.jsonl".to_string()),
            slug: Some("test-session".to_string()),
            source_config_dir: None,
        };

        let result = upsert_session(input).expect("Failed to upsert session");

        assert_eq!(result.id, "test-session-001");
        assert_eq!(result.status, "active");
        assert_eq!(
            result.transcript_path,
            Some("/path/to/transcript.jsonl".to_string())
        );
        assert_eq!(result.slug, Some("test-session".to_string()));
    }

    #[test]
    fn test_upsert_session_default_status() {
        let _temp_dir = init_test_db_singleton();

        let input = SessionInput {
            id: "default-status-session".to_string(),
            project_id: None,
            status: None, // Should default to "active"
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };

        let result = upsert_session(input).expect("Failed to upsert session");
        assert_eq!(result.status, "active");
    }

    #[test]
    fn test_get_session() {
        let _temp_dir = init_test_db_singleton();

        let input = SessionInput {
            id: "get-session-test".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(input).expect("Failed to insert session");

        let result = get_session("get-session-test").expect("Query should succeed");
        assert!(result.is_some());
        assert_eq!(result.unwrap().id, "get-session-test");
    }

    #[test]
    fn test_get_session_not_found() {
        let _temp_dir = init_test_db_singleton();

        let result = get_session("nonexistent-session").expect("Query should succeed");
        assert!(result.is_none());
    }

    #[test]
    fn test_end_session() {
        let _temp_dir = init_test_db_singleton();

        let input = SessionInput {
            id: "session-to-end".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(input).expect("Failed to insert session");

        let result = end_session("session-to-end").expect("Failed to end session");
        assert!(result);

        // Verify status changed
        let session = get_session("session-to-end")
            .expect("Query should succeed")
            .unwrap();
        assert_eq!(session.status, "completed");
    }

    #[test]
    fn test_list_sessions_no_filters() {
        let _temp_dir = init_test_db_singleton();

        for i in 0..3 {
            let input = SessionInput {
                id: format!("list-session-{}", i),
                project_id: None,
                status: Some("active".to_string()),
                transcript_path: None,
                slug: None,
                source_config_dir: None,
            };
            upsert_session(input).expect("Failed to insert session");
        }

        let sessions = list_sessions(None, None, None).expect("Failed to list sessions");
        assert!(sessions.len() >= 3);
    }

    #[test]
    fn test_list_sessions_with_status_filter() {
        let _temp_dir = init_test_db_singleton();

        // Create active session
        let input1 = SessionInput {
            id: "active-filter-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(input1).expect("Failed to insert session");

        // Create completed session
        let input2 = SessionInput {
            id: "completed-filter-session".to_string(),
            project_id: None,
            status: Some("completed".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(input2).expect("Failed to insert session");

        let active_sessions =
            list_sessions(None, Some("active".to_string()), None).expect("Failed to list sessions");
        assert!(active_sessions.iter().all(|s| s.status == "active"));
    }

    #[test]
    fn test_update_last_indexed_line() {
        let _temp_dir = init_test_db_singleton();

        let input = SessionInput {
            id: "indexed-line-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(input).expect("Failed to insert session");

        update_last_indexed_line("indexed-line-session", 42).expect("Failed to update line");

        let session = get_session("indexed-line-session")
            .expect("Query should succeed")
            .unwrap();
        assert_eq!(session.last_indexed_line, Some(42));
    }

    #[test]
    fn test_reset_all_sessions_for_reindex() {
        let _temp_dir = init_test_db_singleton();

        // Create session with indexed line
        let input = SessionInput {
            id: "reindex-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(input).expect("Failed to insert session");
        update_last_indexed_line("reindex-session", 100).expect("Failed to update line");

        let count = reset_all_sessions_for_reindex().expect("Failed to reset");
        assert!(count >= 1);

        let session = get_session("reindex-session")
            .expect("Query should succeed")
            .unwrap();
        assert_eq!(session.last_indexed_line, Some(0));
    }

    // ========================================================================
    // Session Summary Operations Tests
    // ========================================================================

    #[test]
    fn test_upsert_session_summary() {
        let _temp_dir = init_test_db_singleton();

        // Create session first
        let session_input = SessionInput {
            id: "summary-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let input = SessionSummaryInput {
            session_id: "summary-session".to_string(),
            message_id: "msg-001".to_string(),
            content: Some("This is a test summary".to_string()),
            raw_json: None,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            line_number: 10,
        };

        let result = upsert_session_summary(input).expect("Failed to upsert summary");
        assert_eq!(result.session_id, "summary-session");
        assert_eq!(result.content, Some("This is a test summary".to_string()));
    }

    #[test]
    fn test_get_session_summary() {
        let _temp_dir = init_test_db_singleton();

        // Create session first
        let session_input = SessionInput {
            id: "get-summary-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let input = SessionSummaryInput {
            session_id: "get-summary-session".to_string(),
            message_id: "msg-002".to_string(),
            content: Some("Summary content".to_string()),
            raw_json: None,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            line_number: 20,
        };
        upsert_session_summary(input).expect("Failed to insert summary");

        let result = get_session_summary("get-summary-session").expect("Query should succeed");
        assert!(result.is_some());
        assert_eq!(result.unwrap().content, Some("Summary content".to_string()));
    }

    // ========================================================================
    // Session Compact Operations Tests
    // ========================================================================

    #[test]
    fn test_upsert_session_compact() {
        let _temp_dir = init_test_db_singleton();

        // Create session first
        let session_input = SessionInput {
            id: "compact-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let input = SessionCompactInput {
            session_id: "compact-session".to_string(),
            message_id: "compact-msg-001".to_string(),
            content: Some("Compacted content".to_string()),
            raw_json: None,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            line_number: 30,
            compact_type: Some("auto_compact".to_string()),
        };

        let result = upsert_session_compact(input).expect("Failed to upsert compact");
        assert_eq!(result.session_id, "compact-session");
        assert_eq!(result.compact_type, Some("auto_compact".to_string()));
    }

    #[test]
    fn test_get_session_compact() {
        let _temp_dir = init_test_db_singleton();

        // Create session first
        let session_input = SessionInput {
            id: "get-compact-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let input = SessionCompactInput {
            session_id: "get-compact-session".to_string(),
            message_id: "compact-msg-002".to_string(),
            content: Some("Compact content".to_string()),
            raw_json: None,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            line_number: 40,
            compact_type: Some("compact".to_string()),
        };
        upsert_session_compact(input).expect("Failed to insert compact");

        let result = get_session_compact("get-compact-session").expect("Query should succeed");
        assert!(result.is_some());
    }

    // ========================================================================
    // Session Todos Operations Tests
    // ========================================================================

    #[test]
    fn test_upsert_session_todos() {
        let _temp_dir = init_test_db_singleton();

        // Create session first
        let session_input = SessionInput {
            id: "todos-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let input = SessionTodosInput {
            session_id: "todos-session".to_string(),
            message_id: "todos-msg-001".to_string(),
            todos_json:
                r#"[{"content":"Task 1","status":"pending","active_form":"Working on task 1"}]"#
                    .to_string(),
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            line_number: 50,
        };

        let result = upsert_session_todos(input).expect("Failed to upsert todos");
        assert_eq!(result.session_id, "todos-session");
        assert!(result.todos_json.contains("Task 1"));
    }

    #[test]
    fn test_get_session_todos() {
        let _temp_dir = init_test_db_singleton();

        // Create session first
        let session_input = SessionInput {
            id: "get-todos-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let input = SessionTodosInput {
            session_id: "get-todos-session".to_string(),
            message_id: "todos-msg-002".to_string(),
            todos_json: r#"[{"content":"Task 2","status":"completed","active_form":""}]"#
                .to_string(),
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            line_number: 60,
        };
        upsert_session_todos(input).expect("Failed to insert todos");

        let result = get_session_todos("get-todos-session").expect("Query should succeed");
        assert!(result.is_some());
    }

    // ========================================================================
    // Native Task Operations Tests
    // ========================================================================

    #[test]
    fn test_create_native_task() {
        let _temp_dir = init_test_db_singleton();

        // Create session first
        let session_input = SessionInput {
            id: "native-task-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let input = NativeTaskInput {
            id: "1".to_string(),
            session_id: "native-task-session".to_string(),
            message_id: "task-msg-001".to_string(),
            subject: "Test task".to_string(),
            description: Some("Task description".to_string()),
            active_form: Some("Testing task".to_string()),
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            line_number: 70,
        };

        let result = create_native_task(input).expect("Failed to create native task");
        assert_eq!(result.id, "1");
        assert_eq!(result.subject, "Test task");
        assert_eq!(result.status, "pending");
    }

    #[test]
    fn test_update_native_task() {
        let _temp_dir = init_test_db_singleton();

        // Create session and task first
        let session_input = SessionInput {
            id: "update-task-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let create_input = NativeTaskInput {
            id: "2".to_string(),
            session_id: "update-task-session".to_string(),
            message_id: "task-msg-002".to_string(),
            subject: "Original subject".to_string(),
            description: None,
            active_form: None,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            line_number: 80,
        };
        create_native_task(create_input).expect("Failed to create task");

        let update_input = NativeTaskUpdate {
            id: "2".to_string(),
            session_id: "update-task-session".to_string(),
            message_id: "task-msg-003".to_string(),
            status: Some("completed".to_string()),
            subject: Some("Updated subject".to_string()),
            description: Some("Updated description".to_string()),
            active_form: None,
            owner: None,
            add_blocks: None,
            add_blocked_by: None,
            timestamp: "2024-01-01T01:00:00Z".to_string(),
            line_number: 90,
        };

        let result = update_native_task(update_input).expect("Failed to update task");
        assert!(result.is_some());
        let task = result.unwrap();
        assert_eq!(task.status, "completed");
        assert_eq!(task.subject, "Updated subject");
    }

    #[test]
    fn test_get_session_native_tasks() {
        let _temp_dir = init_test_db_singleton();

        // Create session first
        let session_input = SessionInput {
            id: "list-tasks-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        for i in 0..3 {
            let input = NativeTaskInput {
                id: format!("{}", i + 10),
                session_id: "list-tasks-session".to_string(),
                message_id: format!("task-msg-{}", i),
                subject: format!("Task {}", i),
                description: None,
                active_form: None,
                timestamp: "2024-01-01T00:00:00Z".to_string(),
                line_number: 100 + i,
            };
            create_native_task(input).expect("Failed to create task");
        }

        let tasks =
            get_session_native_tasks("list-tasks-session").expect("Failed to get session tasks");
        assert_eq!(tasks.len(), 3);
    }

    // ========================================================================
    // Message Operations Tests
    // ========================================================================

    #[test]
    fn test_insert_messages_batch_empty() {
        let _temp_dir = init_test_db_singleton();

        let count =
            insert_messages_batch("empty-messages-session", vec![]).expect("Should handle empty");
        assert_eq!(count, 0);
    }

    #[test]
    fn test_insert_messages_batch() {
        let _temp_dir = init_test_db_singleton();

        // Create session first
        let session_input = SessionInput {
            id: "messages-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let messages = vec![
            MessageInput {
                id: "msg-batch-001".to_string(),
                session_id: "messages-session".to_string(),
                agent_id: None,
                parent_id: None,
                message_type: "user".to_string(),
                role: Some("user".to_string()),
                content: Some("Hello".to_string()),
                tool_name: None,
                tool_input: None,
                tool_result: None,
                raw_json: None,
                timestamp: "2024-01-01T00:00:00Z".to_string(),
                line_number: 1,
                source_file_name: None,
                source_file_type: None,
                sentiment_score: None,
                sentiment_level: None,
                frustration_score: None,
                frustration_level: None,
                input_tokens: None,
                output_tokens: None,
                cache_read_tokens: None,
                cache_creation_tokens: None,
                lines_added: None,
                lines_removed: None,
                files_changed: None,
            },
            MessageInput {
                id: "msg-batch-002".to_string(),
                session_id: "messages-session".to_string(),
                agent_id: None,
                parent_id: None,
                message_type: "assistant".to_string(),
                role: Some("assistant".to_string()),
                content: Some("Hi there!".to_string()),
                tool_name: None,
                tool_input: None,
                tool_result: None,
                raw_json: None,
                timestamp: "2024-01-01T00:00:01Z".to_string(),
                line_number: 2,
                source_file_name: None,
                source_file_type: None,
                sentiment_score: None,
                sentiment_level: None,
                frustration_score: None,
                frustration_level: None,
                input_tokens: None,
                output_tokens: None,
                cache_read_tokens: None,
                cache_creation_tokens: None,
                lines_added: None,
                lines_removed: None,
                files_changed: None,
            },
        ];

        let count =
            insert_messages_batch("messages-session", messages).expect("Failed to insert messages");
        assert_eq!(count, 2);
    }

    #[test]
    fn test_get_message() {
        let _temp_dir = init_test_db_singleton();

        // Create session and message
        let session_input = SessionInput {
            id: "get-message-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let messages = vec![MessageInput {
            id: "get-msg-001".to_string(),
            session_id: "get-message-session".to_string(),
            agent_id: None,
            parent_id: None,
            message_type: "user".to_string(),
            role: Some("user".to_string()),
            content: Some("Test message".to_string()),
            tool_name: None,
            tool_input: None,
            tool_result: None,
            raw_json: None,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            line_number: 1,
            source_file_name: None,
            source_file_type: None,
            sentiment_score: None,
            sentiment_level: None,
            frustration_score: None,
            frustration_level: None,
            input_tokens: None,
            output_tokens: None,
            cache_read_tokens: None,
            cache_creation_tokens: None,
            lines_added: None,
            lines_removed: None,
            files_changed: None,
        }];
        insert_messages_batch("get-message-session", messages).expect("Failed to insert");

        let result = get_message("get-msg-001").expect("Query should succeed");
        assert!(result.is_some());
        assert_eq!(result.unwrap().content, Some("Test message".to_string()));
    }

    #[test]
    fn test_get_message_not_found() {
        let _temp_dir = init_test_db_singleton();

        let result = get_message("nonexistent-msg").expect("Query should succeed");
        assert!(result.is_none());
    }

    #[test]
    fn test_list_session_messages() {
        let _temp_dir = init_test_db_singleton();

        // Create session and messages
        let session_input = SessionInput {
            id: "list-messages-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let messages = vec![
            MessageInput {
                id: "list-msg-001".to_string(),
                session_id: "list-messages-session".to_string(),
                agent_id: None,
                parent_id: None,
                message_type: "user".to_string(),
                role: Some("user".to_string()),
                content: Some("Message 1".to_string()),
                tool_name: None,
                tool_input: None,
                tool_result: None,
                raw_json: None,
                timestamp: "2024-01-01T00:00:00Z".to_string(),
                line_number: 1,
                source_file_name: None,
                source_file_type: None,
                sentiment_score: None,
                sentiment_level: None,
                frustration_score: None,
                frustration_level: None,
                input_tokens: None,
                output_tokens: None,
                cache_read_tokens: None,
                cache_creation_tokens: None,
                lines_added: None,
                lines_removed: None,
                files_changed: None,
            },
            MessageInput {
                id: "list-msg-002".to_string(),
                session_id: "list-messages-session".to_string(),
                agent_id: None,
                parent_id: None,
                message_type: "assistant".to_string(),
                role: Some("assistant".to_string()),
                content: Some("Message 2".to_string()),
                tool_name: None,
                tool_input: None,
                tool_result: None,
                raw_json: None,
                timestamp: "2024-01-01T00:00:01Z".to_string(),
                line_number: 2,
                source_file_name: None,
                source_file_type: None,
                sentiment_score: None,
                sentiment_level: None,
                frustration_score: None,
                frustration_level: None,
                input_tokens: None,
                output_tokens: None,
                cache_read_tokens: None,
                cache_creation_tokens: None,
                lines_added: None,
                lines_removed: None,
                files_changed: None,
            },
        ];
        insert_messages_batch("list-messages-session", messages).expect("Failed to insert");

        let result = list_session_messages("list-messages-session", None, None, None, None)
            .expect("Query should succeed");
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_list_session_messages_with_type_filter() {
        let _temp_dir = init_test_db_singleton();

        // Create session and messages
        let session_input = SessionInput {
            id: "filter-messages-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let messages = vec![
            MessageInput {
                id: "filter-msg-001".to_string(),
                session_id: "filter-messages-session".to_string(),
                agent_id: None,
                parent_id: None,
                message_type: "user".to_string(),
                role: Some("user".to_string()),
                content: Some("User message".to_string()),
                tool_name: None,
                tool_input: None,
                tool_result: None,
                raw_json: None,
                timestamp: "2024-01-01T00:00:00Z".to_string(),
                line_number: 1,
                source_file_name: None,
                source_file_type: None,
                sentiment_score: None,
                sentiment_level: None,
                frustration_score: None,
                frustration_level: None,
                input_tokens: None,
                output_tokens: None,
                cache_read_tokens: None,
                cache_creation_tokens: None,
                lines_added: None,
                lines_removed: None,
                files_changed: None,
            },
            MessageInput {
                id: "filter-msg-002".to_string(),
                session_id: "filter-messages-session".to_string(),
                agent_id: None,
                parent_id: None,
                message_type: "assistant".to_string(),
                role: Some("assistant".to_string()),
                content: Some("Assistant message".to_string()),
                tool_name: None,
                tool_input: None,
                tool_result: None,
                raw_json: None,
                timestamp: "2024-01-01T00:00:01Z".to_string(),
                line_number: 2,
                source_file_name: None,
                source_file_type: None,
                sentiment_score: None,
                sentiment_level: None,
                frustration_score: None,
                frustration_level: None,
                input_tokens: None,
                output_tokens: None,
                cache_read_tokens: None,
                cache_creation_tokens: None,
                lines_added: None,
                lines_removed: None,
                files_changed: None,
            },
        ];
        insert_messages_batch("filter-messages-session", messages).expect("Failed to insert");

        let result = list_session_messages(
            "filter-messages-session",
            Some("user".to_string()),
            None,
            None,
            None,
        )
        .expect("Query should succeed");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].message_type, "user");
    }

    #[test]
    fn test_get_message_count() {
        let _temp_dir = init_test_db_singleton();

        // Create session and messages
        let session_input = SessionInput {
            id: "count-messages-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let messages = vec![
            MessageInput {
                id: "count-msg-001".to_string(),
                session_id: "count-messages-session".to_string(),
                agent_id: None,
                parent_id: None,
                message_type: "user".to_string(),
                role: Some("user".to_string()),
                content: Some("Message 1".to_string()),
                tool_name: None,
                tool_input: None,
                tool_result: None,
                raw_json: None,
                timestamp: "2024-01-01T00:00:00Z".to_string(),
                line_number: 1,
                source_file_name: None,
                source_file_type: None,
                sentiment_score: None,
                sentiment_level: None,
                frustration_score: None,
                frustration_level: None,
                input_tokens: None,
                output_tokens: None,
                cache_read_tokens: None,
                cache_creation_tokens: None,
                lines_added: None,
                lines_removed: None,
                files_changed: None,
            },
            MessageInput {
                id: "count-msg-002".to_string(),
                session_id: "count-messages-session".to_string(),
                agent_id: None,
                parent_id: None,
                message_type: "assistant".to_string(),
                role: Some("assistant".to_string()),
                content: Some("Message 2".to_string()),
                tool_name: None,
                tool_input: None,
                tool_result: None,
                raw_json: None,
                timestamp: "2024-01-01T00:00:01Z".to_string(),
                line_number: 2,
                source_file_name: None,
                source_file_type: None,
                sentiment_score: None,
                sentiment_level: None,
                frustration_score: None,
                frustration_level: None,
                input_tokens: None,
                output_tokens: None,
                cache_read_tokens: None,
                cache_creation_tokens: None,
                lines_added: None,
                lines_removed: None,
                files_changed: None,
            },
            MessageInput {
                id: "count-msg-003".to_string(),
                session_id: "count-messages-session".to_string(),
                agent_id: None,
                parent_id: None,
                message_type: "tool_use".to_string(), // Not counted
                role: None,
                content: None,
                tool_name: Some("bash".to_string()),
                tool_input: Some("{}".to_string()),
                tool_result: None,
                raw_json: None,
                timestamp: "2024-01-01T00:00:02Z".to_string(),
                line_number: 3,
                source_file_name: None,
                source_file_type: None,
                sentiment_score: None,
                sentiment_level: None,
                frustration_score: None,
                frustration_level: None,
                input_tokens: None,
                output_tokens: None,
                cache_read_tokens: None,
                cache_creation_tokens: None,
                lines_added: None,
                lines_removed: None,
                files_changed: None,
            },
        ];
        insert_messages_batch("count-messages-session", messages).expect("Failed to insert");

        let count = get_message_count("count-messages-session").expect("Query should succeed");
        // Only user and assistant messages are counted
        assert_eq!(count, 2);
    }

    #[test]
    fn test_get_message_counts_batch() {
        let _temp_dir = init_test_db_singleton();

        // Create sessions with messages
        for i in 0..2 {
            let session_input = SessionInput {
                id: format!("batch-count-session-{}", i),
                project_id: None,
                status: Some("active".to_string()),
                transcript_path: None,
                slug: None,
                source_config_dir: None,
            };
            upsert_session(session_input).expect("Failed to insert session");

            let messages = vec![MessageInput {
                id: format!("batch-count-msg-{}", i),
                session_id: format!("batch-count-session-{}", i),
                agent_id: None,
                parent_id: None,
                message_type: "user".to_string(),
                role: Some("user".to_string()),
                content: Some("Message".to_string()),
                tool_name: None,
                tool_input: None,
                tool_result: None,
                raw_json: None,
                timestamp: "2024-01-01T00:00:00Z".to_string(),
                line_number: 1,
                source_file_name: None,
                source_file_type: None,
                sentiment_score: None,
                sentiment_level: None,
                frustration_score: None,
                frustration_level: None,
                input_tokens: None,
                output_tokens: None,
                cache_read_tokens: None,
                cache_creation_tokens: None,
                lines_added: None,
                lines_removed: None,
                files_changed: None,
            }];
            insert_messages_batch(&format!("batch-count-session-{}", i), messages)
                .expect("Failed to insert");
        }

        let session_ids = vec![
            "batch-count-session-0".to_string(),
            "batch-count-session-1".to_string(),
            "nonexistent-session".to_string(),
        ];

        let counts = get_message_counts_batch(session_ids).expect("Query should succeed");

        assert!(counts.get("batch-count-session-0").unwrap_or(&0) >= &1);
        assert!(counts.get("batch-count-session-1").unwrap_or(&0) >= &1);
        assert_eq!(*counts.get("nonexistent-session").unwrap_or(&0), 0);
    }

    #[test]
    fn test_get_last_indexed_line() {
        let _temp_dir = init_test_db_singleton();

        // Create session
        let session_input = SessionInput {
            id: "last-indexed-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");
        update_last_indexed_line("last-indexed-session", 99).expect("Failed to update");

        let line = get_last_indexed_line("last-indexed-session").expect("Query should succeed");
        assert_eq!(line, 99);
    }

    #[test]
    fn test_get_session_timestamps_batch() {
        let _temp_dir = init_test_db_singleton();

        // Create session with messages
        let session_input = SessionInput {
            id: "timestamps-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let messages = vec![
            MessageInput {
                id: "ts-msg-001".to_string(),
                session_id: "timestamps-session".to_string(),
                agent_id: None,
                parent_id: None,
                message_type: "user".to_string(),
                role: Some("user".to_string()),
                content: Some("First".to_string()),
                tool_name: None,
                tool_input: None,
                tool_result: None,
                raw_json: None,
                timestamp: "2024-01-01T00:00:00Z".to_string(),
                line_number: 1,
                source_file_name: None,
                source_file_type: None,
                sentiment_score: None,
                sentiment_level: None,
                frustration_score: None,
                frustration_level: None,
                input_tokens: None,
                output_tokens: None,
                cache_read_tokens: None,
                cache_creation_tokens: None,
                lines_added: None,
                lines_removed: None,
                files_changed: None,
            },
            MessageInput {
                id: "ts-msg-002".to_string(),
                session_id: "timestamps-session".to_string(),
                agent_id: None,
                parent_id: None,
                message_type: "assistant".to_string(),
                role: Some("assistant".to_string()),
                content: Some("Last".to_string()),
                tool_name: None,
                tool_input: None,
                tool_result: None,
                raw_json: None,
                timestamp: "2024-01-01T01:00:00Z".to_string(),
                line_number: 2,
                source_file_name: None,
                source_file_type: None,
                sentiment_score: None,
                sentiment_level: None,
                frustration_score: None,
                frustration_level: None,
                input_tokens: None,
                output_tokens: None,
                cache_read_tokens: None,
                cache_creation_tokens: None,
                lines_added: None,
                lines_removed: None,
                files_changed: None,
            },
        ];
        insert_messages_batch("timestamps-session", messages).expect("Failed to insert");

        let session_ids = vec!["timestamps-session".to_string()];
        let timestamps = get_session_timestamps_batch(session_ids).expect("Query should succeed");

        let ts = timestamps.get("timestamps-session").unwrap();
        assert_eq!(ts.started_at, Some("2024-01-01T00:00:00Z".to_string()));
        assert_eq!(ts.ended_at, Some("2024-01-01T01:00:00Z".to_string()));
    }

    // ========================================================================
    // FTS5 Escape Tests
    // ========================================================================

    #[test]
    fn test_escape_fts5_query_simple() {
        let result = escape_fts5_query("hello world");
        assert_eq!(result, "\"hello\" \"world\"");
    }

    #[test]
    fn test_escape_fts5_query_with_operators() {
        // Words like AND, OR, NOT are FTS5 operators and need quoting
        let result = escape_fts5_query("hello AND world");
        assert_eq!(result, "\"hello\" \"AND\" \"world\"");
    }

    #[test]
    fn test_escape_fts5_query_with_special_chars() {
        let result = escape_fts5_query("hello:world");
        assert_eq!(result, "\"hello:world\"");
    }

    #[test]
    fn test_escape_fts5_query_with_quotes() {
        let result = escape_fts5_query("hello \"world\"");
        // Internal quotes are escaped by doubling
        assert_eq!(result, "\"hello\" \"world\"");
    }

    // ========================================================================
    // Task Operations Tests
    // ========================================================================

    #[test]
    fn test_create_task() {
        let _temp_dir = init_test_db_singleton();

        // Create session first
        let session_input = SessionInput {
            id: "task-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let input = TaskInput {
            session_id: Some("task-session".to_string()),
            task_id: "task-001".to_string(),
            description: "Test task".to_string(),
            task_type: "feature".to_string(),
            estimated_complexity: Some("medium".to_string()),
        };

        let result = create_task(input).expect("Failed to create task");
        assert_eq!(result.task_id, "task-001");
        assert_eq!(result.description, "Test task");
        assert_eq!(result.task_type, "feature");
    }

    #[test]
    fn test_complete_task() {
        let _temp_dir = init_test_db_singleton();

        // Create session and task
        let session_input = SessionInput {
            id: "complete-task-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let create_input = TaskInput {
            session_id: Some("complete-task-session".to_string()),
            task_id: "task-to-complete".to_string(),
            description: "Task to complete".to_string(),
            task_type: "bugfix".to_string(),
            estimated_complexity: None,
        };
        create_task(create_input).expect("Failed to create task");

        let completion = TaskCompletion {
            task_id: "task-to-complete".to_string(),
            outcome: "success".to_string(),
            confidence: 0.95,
            notes: Some("Task completed successfully".to_string()),
            files_modified: Some(vec!["file1.rs".to_string(), "file2.rs".to_string()]),
            tests_added: Some(2),
        };

        let result = complete_task(completion).expect("Failed to complete task");
        assert_eq!(result.outcome, Some("success".to_string()));
        assert_eq!(result.confidence, Some(0.95));
        assert!(result.completed_at.is_some());
    }

    #[test]
    fn test_fail_task() {
        let _temp_dir = init_test_db_singleton();

        // Create session and task
        let session_input = SessionInput {
            id: "fail-task-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let create_input = TaskInput {
            session_id: Some("fail-task-session".to_string()),
            task_id: "task-to-fail".to_string(),
            description: "Task to fail".to_string(),
            task_type: "refactor".to_string(),
            estimated_complexity: None,
        };
        create_task(create_input).expect("Failed to create task");

        let failure = TaskFailure {
            task_id: "task-to-fail".to_string(),
            reason: "Could not complete due to X".to_string(),
            attempted_solutions: Some(vec!["Solution 1".to_string(), "Solution 2".to_string()]),
            confidence: Some(0.2),
            notes: Some("Additional notes".to_string()),
        };

        let result = fail_task(failure).expect("Failed to fail task");
        assert_eq!(result.outcome, Some("failure".to_string()));
        assert!(result.notes.is_some());
        assert!(result.notes.unwrap().contains("Could not complete"));
    }

    #[test]
    fn test_get_task() {
        let _temp_dir = init_test_db_singleton();

        // Create session and task
        let session_input = SessionInput {
            id: "get-task-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let input = TaskInput {
            session_id: Some("get-task-session".to_string()),
            task_id: "get-task-001".to_string(),
            description: "Get task test".to_string(),
            task_type: "test".to_string(),
            estimated_complexity: None,
        };
        create_task(input).expect("Failed to create task");

        let result = get_task("get-task-001").expect("Query should succeed");
        assert!(result.is_some());
        assert_eq!(result.unwrap().description, "Get task test");
    }

    #[test]
    fn test_query_task_metrics() {
        let _temp_dir = init_test_db_singleton();

        // Create session and tasks
        let session_input = SessionInput {
            id: "metrics-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let task1 = TaskInput {
            session_id: Some("metrics-session".to_string()),
            task_id: "metric-task-1".to_string(),
            description: "Task 1".to_string(),
            task_type: "feature".to_string(),
            estimated_complexity: None,
        };
        create_task(task1).expect("Failed to create task");

        let completion = TaskCompletion {
            task_id: "metric-task-1".to_string(),
            outcome: "success".to_string(),
            confidence: 0.9,
            notes: None,
            files_modified: None,
            tests_added: None,
        };
        complete_task(completion).expect("Failed to complete task");

        let metrics = query_task_metrics(None, None, None).expect("Failed to query metrics");
        assert!(metrics.total_tasks >= 1);
    }

    // ========================================================================
    // Hook Execution Operations Tests
    // ========================================================================

    #[test]
    fn test_record_hook_execution() {
        let _temp_dir = init_test_db_singleton();

        // Create session first
        let session_input = SessionInput {
            id: "hook-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let input = HookExecutionInput {
            session_id: Some("hook-session".to_string()),
            task_id: None,
            hook_type: "Stop".to_string(),
            hook_name: "test-hook".to_string(),
            hook_source: Some("jutsu-typescript".to_string()),
            directory: Some("/path/to/project".to_string()),
            duration_ms: 150,
            exit_code: 0,
            passed: true,
            output: Some("Hook output".to_string()),
            error: None,
            if_changed: None,
            command: Some("npm test".to_string()),
        };

        let result = record_hook_execution(input).expect("Failed to record hook");
        assert!(result.id.is_some());
        assert_eq!(result.hook_name, "test-hook");
        assert!(result.passed);
    }

    #[test]
    fn test_query_hook_stats() {
        let _temp_dir = init_test_db_singleton();

        // Create session and hooks
        let session_input = SessionInput {
            id: "hook-stats-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let input1 = HookExecutionInput {
            session_id: Some("hook-stats-session".to_string()),
            task_id: None,
            hook_type: "Stop".to_string(),
            hook_name: "hook-1".to_string(),
            hook_source: None,
            directory: None,
            duration_ms: 100,
            exit_code: 0,
            passed: true,
            output: None,
            error: None,
            if_changed: None,
            command: None,
        };
        record_hook_execution(input1).expect("Failed to record hook");

        let input2 = HookExecutionInput {
            session_id: Some("hook-stats-session".to_string()),
            task_id: None,
            hook_type: "Stop".to_string(),
            hook_name: "hook-2".to_string(),
            hook_source: None,
            directory: None,
            duration_ms: 200,
            exit_code: 1,
            passed: false,
            output: None,
            error: Some("Error".to_string()),
            if_changed: None,
            command: None,
        };
        record_hook_execution(input2).expect("Failed to record hook");

        let stats = query_hook_stats(None).expect("Failed to query stats");
        assert!(stats.total_executions >= 2);
        assert!(stats.total_passed >= 1);
        assert!(stats.total_failed >= 1);
    }

    // ========================================================================
    // Frustration Events Tests
    // ========================================================================

    #[test]
    fn test_record_frustration() {
        let _temp_dir = init_test_db_singleton();

        // Create session first
        let session_input = SessionInput {
            id: "frustration-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let input = FrustrationEventInput {
            session_id: Some("frustration-session".to_string()),
            task_id: None,
            frustration_level: "moderate".to_string(),
            frustration_score: 0.6,
            user_message: "This is frustrating!".to_string(),
            detected_signals: Some(vec![
                "capitalization".to_string(),
                "punctuation".to_string(),
            ]),
            context: Some("Testing frustration".to_string()),
        };

        let result = record_frustration(input).expect("Failed to record frustration");
        assert!(result.id.is_some());
        assert_eq!(result.frustration_level, "moderate");
    }

    #[test]
    fn test_query_frustration_metrics() {
        let _temp_dir = init_test_db_singleton();

        // Create session and frustration event
        let session_input = SessionInput {
            id: "frustration-metrics-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let input = FrustrationEventInput {
            session_id: Some("frustration-metrics-session".to_string()),
            task_id: None,
            frustration_level: "high".to_string(),
            frustration_score: 0.9,
            user_message: "Very frustrating!".to_string(),
            detected_signals: None,
            context: None,
        };
        record_frustration(input).expect("Failed to record frustration");

        let metrics = query_frustration_metrics(None, 10).expect("Failed to query metrics");
        assert!(metrics.total_frustrations >= 1);
    }

    // ========================================================================
    // Session File Change Operations Tests
    // ========================================================================

    #[test]
    fn test_record_file_change() {
        let _temp_dir = init_test_db_singleton();

        // Create session first
        let session_input = SessionInput {
            id: "file-change-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let input = SessionFileChangeInput {
            session_id: "file-change-session".to_string(),
            file_path: "/path/to/file.rs".to_string(),
            action: "modified".to_string(),
            file_hash_before: Some("abc123".to_string()),
            file_hash_after: Some("def456".to_string()),
            tool_name: Some("Edit".to_string()),
        };

        let result = record_file_change(input).expect("Failed to record file change");
        assert!(result.id.is_some());
        assert_eq!(result.action, "modified");
    }

    #[test]
    fn test_get_session_file_changes() {
        let _temp_dir = init_test_db_singleton();

        // Create session and file changes
        let session_input = SessionInput {
            id: "list-file-changes-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        for i in 0..3 {
            let input = SessionFileChangeInput {
                session_id: "list-file-changes-session".to_string(),
                file_path: format!("/path/to/file{}.rs", i),
                action: "modified".to_string(),
                file_hash_before: None,
                file_hash_after: Some(format!("hash{}", i)),
                tool_name: None,
            };
            record_file_change(input).expect("Failed to record file change");
        }

        let changes =
            get_session_file_changes("list-file-changes-session").expect("Query should succeed");
        assert_eq!(changes.len(), 3);
    }

    #[test]
    fn test_has_session_changes() {
        let _temp_dir = init_test_db_singleton();

        // Create session
        let session_input = SessionInput {
            id: "has-changes-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        // Should be false initially
        let has_changes_before =
            has_session_changes("has-changes-session").expect("Query should succeed");
        assert!(!has_changes_before);

        // Add a change
        let input = SessionFileChangeInput {
            session_id: "has-changes-session".to_string(),
            file_path: "/path/to/changed.rs".to_string(),
            action: "created".to_string(),
            file_hash_before: None,
            file_hash_after: Some("newhash".to_string()),
            tool_name: None,
        };
        record_file_change(input).expect("Failed to record file change");

        // Should be true now
        let has_changes_after =
            has_session_changes("has-changes-session").expect("Query should succeed");
        assert!(has_changes_after);
    }

    // ========================================================================
    // Session File Validation Operations Tests
    // ========================================================================

    #[test]
    fn test_record_file_validation() {
        let _temp_dir = init_test_db_singleton();

        // Create session first
        let session_input = SessionInput {
            id: "validation-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let input = SessionFileValidationInput {
            session_id: "validation-session".to_string(),
            file_path: "/path/to/validated.rs".to_string(),
            file_hash: "abc123".to_string(),
            plugin_name: "jutsu-typescript".to_string(),
            hook_name: "typecheck".to_string(),
            directory: "/project".to_string(),
            command_hash: "cmd123".to_string(),
        };

        let result = record_file_validation(input).expect("Failed to record validation");
        assert!(result.id.is_some());
        assert_eq!(result.file_hash, "abc123");
    }

    #[test]
    fn test_get_file_validation() {
        let _temp_dir = init_test_db_singleton();

        // Create session first
        let session_input = SessionInput {
            id: "get-validation-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let input = SessionFileValidationInput {
            session_id: "get-validation-session".to_string(),
            file_path: "/path/to/file.rs".to_string(),
            file_hash: "xyz789".to_string(),
            plugin_name: "jutsu-rust".to_string(),
            hook_name: "clippy".to_string(),
            directory: "/rust-project".to_string(),
            command_hash: "cmdabc".to_string(),
        };
        record_file_validation(input).expect("Failed to record validation");

        let result = get_file_validation(
            "get-validation-session",
            "/path/to/file.rs",
            "jutsu-rust",
            "clippy",
            "/rust-project",
        )
        .expect("Query should succeed");

        assert!(result.is_some());
        assert_eq!(result.unwrap().file_hash, "xyz789");
    }

    #[test]
    fn test_needs_validation_with_changes() {
        let _temp_dir = init_test_db_singleton();

        // Create session
        let session_input = SessionInput {
            id: "needs-validation-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        // Record a file change
        let change = SessionFileChangeInput {
            session_id: "needs-validation-session".to_string(),
            file_path: "/path/to/unvalidated.rs".to_string(),
            action: "modified".to_string(),
            file_hash_before: Some("old".to_string()),
            file_hash_after: Some("new".to_string()),
            tool_name: None,
        };
        record_file_change(change).expect("Failed to record file change");

        // Should need validation (no validation record yet)
        let needs = needs_validation("needs-validation-session", "plugin", "hook", "/dir", "cmd")
            .expect("Query should succeed");
        assert!(needs);
    }

    // ========================================================================
    // Orchestration Operations Tests
    // ========================================================================

    #[test]
    fn test_create_orchestration() {
        let _temp_dir = init_test_db_singleton();

        let input = OrchestrationInput {
            session_id: None,
            hook_type: "Stop".to_string(),
            project_root: "/path/to/project".to_string(),
        };

        let result = create_orchestration(input).expect("Failed to create orchestration");
        assert!(!result.id.is_empty());
        assert_eq!(result.status, "running");
        assert_eq!(result.hook_type, "Stop");
    }

    #[test]
    fn test_get_orchestration() {
        let _temp_dir = init_test_db_singleton();

        let input = OrchestrationInput {
            session_id: None,
            hook_type: "SessionStart".to_string(),
            project_root: "/another/project".to_string(),
        };
        let created = create_orchestration(input).expect("Failed to create orchestration");

        let result = get_orchestration(created.id.clone()).expect("Query should succeed");
        assert!(result.is_some());
        assert_eq!(result.unwrap().hook_type, "SessionStart");
    }

    #[test]
    fn test_update_orchestration() {
        let _temp_dir = init_test_db_singleton();

        let input = OrchestrationInput {
            session_id: None,
            hook_type: "Stop".to_string(),
            project_root: "/project".to_string(),
        };
        let created = create_orchestration(input).expect("Failed to create orchestration");

        let update = OrchestrationUpdate {
            id: created.id.clone(),
            status: Some("completed".to_string()),
            total_hooks: Some(5),
            completed_hooks: Some(5),
            failed_hooks: Some(0),
            deferred_hooks: Some(0),
        };
        update_orchestration(update).expect("Failed to update orchestration");

        let result = get_orchestration(created.id)
            .expect("Query should succeed")
            .unwrap();
        assert_eq!(result.status, "completed");
        assert_eq!(result.total_hooks, 5);
        assert_eq!(result.completed_hooks, 5);
    }

    #[test]
    fn test_cancel_orchestration() {
        let _temp_dir = init_test_db_singleton();

        let input = OrchestrationInput {
            session_id: None,
            hook_type: "Stop".to_string(),
            project_root: "/project".to_string(),
        };
        let created = create_orchestration(input).expect("Failed to create orchestration");

        cancel_orchestration(created.id.clone()).expect("Failed to cancel orchestration");

        let result = get_orchestration(created.id)
            .expect("Query should succeed")
            .unwrap();
        assert_eq!(result.status, "cancelled");
    }

    // ========================================================================
    // Pending Hook Operations Tests
    // ========================================================================

    #[test]
    fn test_queue_pending_hook() {
        let _temp_dir = init_test_db_singleton();

        // Create orchestration first
        let orch_input = OrchestrationInput {
            session_id: None,
            hook_type: "Stop".to_string(),
            project_root: "/project".to_string(),
        };
        let orch = create_orchestration(orch_input).expect("Failed to create orchestration");

        let input = PendingHookInput {
            orchestration_id: orch.id.clone(),
            session_id: None,
            hook_type: "Stop".to_string(),
            hook_name: "pending-hook".to_string(),
            plugin: "jutsu-test".to_string(),
            directory: "/project".to_string(),
            command: "npm test".to_string(),
            if_changed: None,
            pid: None,
            plugin_root: None,
        };

        let result = queue_pending_hook(input).expect("Failed to queue hook");
        assert!(!result.is_empty());
    }

    #[test]
    fn test_get_pending_hooks() {
        let _temp_dir = init_test_db_singleton();

        // Create orchestration and queue a hook
        let orch_input = OrchestrationInput {
            session_id: None,
            hook_type: "Stop".to_string(),
            project_root: "/project".to_string(),
        };
        let orch = create_orchestration(orch_input).expect("Failed to create orchestration");

        let input = PendingHookInput {
            orchestration_id: orch.id.clone(),
            session_id: None,
            hook_type: "Stop".to_string(),
            hook_name: "get-pending-hook".to_string(),
            plugin: "test-plugin".to_string(),
            directory: "/project".to_string(),
            command: "echo test".to_string(),
            if_changed: None,
            pid: None,
            plugin_root: None,
        };
        queue_pending_hook(input).expect("Failed to queue hook");

        let hooks = get_pending_hooks().expect("Query should succeed");
        assert!(!hooks.is_empty());
    }

    #[test]
    fn test_update_hook_status() {
        let _temp_dir = init_test_db_singleton();

        // Create orchestration and queue a hook
        let orch_input = OrchestrationInput {
            session_id: None,
            hook_type: "Stop".to_string(),
            project_root: "/project".to_string(),
        };
        let orch = create_orchestration(orch_input).expect("Failed to create orchestration");

        let input = PendingHookInput {
            orchestration_id: orch.id.clone(),
            session_id: None,
            hook_type: "Stop".to_string(),
            hook_name: "status-update-hook".to_string(),
            plugin: "test-plugin".to_string(),
            directory: "/project".to_string(),
            command: "echo test".to_string(),
            if_changed: None,
            pid: None,
            plugin_root: None,
        };
        let hook_id = queue_pending_hook(input).expect("Failed to queue hook");

        update_hook_status(hook_id.clone(), "running".to_string())
            .expect("Failed to update status");

        let hooks = get_orchestration_hooks(orch.id).expect("Query should succeed");
        let hook = hooks.iter().find(|h| h.id == Some(hook_id.clone()));
        assert!(hook.is_some());
        assert_eq!(hook.unwrap().status, Some("running".to_string()));
    }

    // ========================================================================
    // Hook Queue Operations Tests
    // ========================================================================

    #[test]
    fn test_queue_hook() {
        let _temp_dir = init_test_db_singleton();

        // Create orchestration first
        let orch_input = OrchestrationInput {
            session_id: None,
            hook_type: "Stop".to_string(),
            project_root: "/project".to_string(),
        };
        let orch = create_orchestration(orch_input).expect("Failed to create orchestration");

        let input = QueuedHookInput {
            orchestration_id: orch.id.clone(),
            plugin: "test-plugin".to_string(),
            hook_name: "queued-hook".to_string(),
            directory: "/project".to_string(),
            if_changed: None,
            command: "npm run lint".to_string(),
        };

        let result = queue_hook(input).expect("Failed to queue hook");
        assert!(!result.is_empty());
    }

    #[test]
    fn test_get_queued_hooks() {
        let _temp_dir = init_test_db_singleton();

        // Create orchestration and queue hooks
        let orch_input = OrchestrationInput {
            session_id: None,
            hook_type: "Stop".to_string(),
            project_root: "/project".to_string(),
        };
        let orch = create_orchestration(orch_input).expect("Failed to create orchestration");

        for i in 0..3 {
            let input = QueuedHookInput {
                orchestration_id: orch.id.clone(),
                plugin: "test-plugin".to_string(),
                hook_name: format!("queued-hook-{}", i),
                directory: "/project".to_string(),
                if_changed: None,
                command: format!("echo {}", i),
            };
            queue_hook(input).expect("Failed to queue hook");
        }

        let hooks = get_queued_hooks(orch.id).expect("Query should succeed");
        assert_eq!(hooks.len(), 3);
    }

    #[test]
    fn test_delete_queued_hooks() {
        let _temp_dir = init_test_db_singleton();

        // Create orchestration and queue hooks
        let orch_input = OrchestrationInput {
            session_id: None,
            hook_type: "Stop".to_string(),
            project_root: "/project".to_string(),
        };
        let orch = create_orchestration(orch_input).expect("Failed to create orchestration");

        let input = QueuedHookInput {
            orchestration_id: orch.id.clone(),
            plugin: "test-plugin".to_string(),
            hook_name: "hook-to-delete".to_string(),
            directory: "/project".to_string(),
            if_changed: None,
            command: "echo delete".to_string(),
        };
        queue_hook(input).expect("Failed to queue hook");

        let deleted = delete_queued_hooks(orch.id.clone()).expect("Failed to delete hooks");
        assert!(deleted >= 1);

        let remaining = get_queued_hooks(orch.id).expect("Query should succeed");
        assert!(remaining.is_empty());
    }

    // ========================================================================
    // Database Reset Operations Tests
    // ========================================================================

    #[test]
    fn test_truncate_derived_tables() {
        let _temp_dir = init_test_db_singleton();

        // Create some data
        let session_input = SessionInput {
            id: "truncate-session".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let messages = vec![MessageInput {
            id: "truncate-msg".to_string(),
            session_id: "truncate-session".to_string(),
            agent_id: None,
            parent_id: None,
            message_type: "user".to_string(),
            role: Some("user".to_string()),
            content: Some("Test".to_string()),
            tool_name: None,
            tool_input: None,
            tool_result: None,
            raw_json: None,
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            line_number: 1,
            source_file_name: None,
            source_file_type: None,
            sentiment_score: None,
            sentiment_level: None,
            frustration_score: None,
            frustration_level: None,
            input_tokens: None,
            output_tokens: None,
            cache_read_tokens: None,
            cache_creation_tokens: None,
            lines_added: None,
            lines_removed: None,
            files_changed: None,
        }];
        insert_messages_batch("truncate-session", messages).expect("Failed to insert");

        // Truncate
        let count = truncate_derived_tables().expect("Failed to truncate");
        assert!(count >= 1);

        // Verify session is gone
        let session = get_session("truncate-session").expect("Query should succeed");
        assert!(session.is_none());
    }

    // ========================================================================
    // Session File Operations Tests
    // ========================================================================

    #[test]
    fn test_upsert_session_file() {
        let _temp_dir = init_test_db_singleton();

        // Create session first
        let session_input = SessionInput {
            id: "session-file-test".to_string(),
            project_id: None,
            status: Some("active".to_string()),
            transcript_path: None,
            slug: None,
            source_config_dir: None,
        };
        upsert_session(session_input).expect("Failed to insert session");

        let result =
            upsert_session_file("session-file-test", "main", "/path/to/session.jsonl", None)
                .expect("Failed to upsert session file");

        assert!(result);
    }

    // ========================================================================
    // Hook Attempt Tracking Tests
    // ========================================================================

    #[test]
    fn test_get_or_create_hook_attempt_new() {
        let _temp_dir = init_test_db_singleton();

        let result = get_or_create_hook_attempt(
            "attempt-session".to_string(),
            "test-plugin".to_string(),
            "test-hook".to_string(),
            "/project".to_string(),
        )
        .expect("Should succeed");

        // New attempt should have defaults
        assert_eq!(result.consecutive_failures, 0);
        assert_eq!(result.max_attempts, 3);
        assert!(!result.is_stuck);
    }

    // ========================================================================
    // Edge Cases and Error Handling
    // ========================================================================

    #[test]
    fn test_empty_batch_operations() {
        let _temp_dir = init_test_db_singleton();

        // Empty message counts batch
        let counts = get_message_counts_batch(vec![]).expect("Should handle empty batch");
        assert!(counts.is_empty());

        // Empty timestamps batch
        let timestamps = get_session_timestamps_batch(vec![]).expect("Should handle empty batch");
        assert!(timestamps.is_empty());
    }

    // ========================================================================
    // Allow dead_code for helper function
    // ========================================================================

    #[allow(dead_code)]
    fn _use_create_test_db() {
        // This function exists to suppress the dead_code warning for create_test_db
        // The function is useful for future tests that need direct connection access
        let (_temp_dir, _conn) = create_test_db();
    }
}
