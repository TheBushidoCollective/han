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
        "INSERT INTO projects (id, repo_id, slug, path, relative_path, name, is_worktree, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
         ON CONFLICT(slug) DO UPDATE SET
             repo_id = excluded.repo_id,
             path = excluded.path,
             relative_path = excluded.relative_path,
             name = excluded.name,
             is_worktree = excluded.is_worktree,
             updated_at = excluded.updated_at
         RETURNING id, repo_id, slug, path, relative_path, name, is_worktree, created_at, updated_at"
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
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
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
        "SELECT id, repo_id, slug, path, relative_path, name, is_worktree, created_at, updated_at
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
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
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
        "SELECT id, repo_id, slug, path, relative_path, name, is_worktree, created_at, updated_at
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
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
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
            created_at: row.get(7)?,
            updated_at: row.get(8)?,
        })
    }

    if let Some(ref rid) = repo_id {
        let mut stmt = conn.prepare(
            "SELECT id, repo_id, slug, path, relative_path, name, is_worktree, created_at, updated_at
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
            "SELECT id, repo_id, slug, path, relative_path, name, is_worktree, created_at, updated_at
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
            "INSERT INTO sessions (id, project_id, status, transcript_path, slug)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET
             project_id = COALESCE(excluded.project_id, sessions.project_id),
             status = excluded.status,
             transcript_path = COALESCE(excluded.transcript_path, sessions.transcript_path),
             slug = COALESCE(excluded.slug, sessions.slug)
         RETURNING id, project_id, status, transcript_path, slug, last_indexed_line",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare upsert: {}", e)))?;

    stmt.query_row(
        params![
            input.id,
            input.project_id,
            status,
            input.transcript_path,
            input.slug
        ],
        |row| {
            Ok(Session {
                id: row.get(0)?,
                project_id: row.get(1)?,
                status: row.get(2)?,
                transcript_path: row.get(3)?,
                slug: row.get(4)?,
                last_indexed_line: row.get(5)?,
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
            "SELECT id, project_id, status, transcript_path, slug, last_indexed_line
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
            last_indexed_line: row.get(5)?,
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
            "SELECT s.id, s.project_id, s.status, s.transcript_path, s.slug, s.last_indexed_line
             FROM sessions s
             LEFT JOIN (SELECT session_id, MAX(timestamp) as max_ts FROM messages GROUP BY session_id) m
             ON s.id = m.session_id
             WHERE s.project_id = ?1 AND s.status = ?2
             ORDER BY m.max_ts DESC NULLS LAST
             LIMIT ?3"
        }
        (Some(_), None) => {
            "SELECT s.id, s.project_id, s.status, s.transcript_path, s.slug, s.last_indexed_line
             FROM sessions s
             LEFT JOIN (SELECT session_id, MAX(timestamp) as max_ts FROM messages GROUP BY session_id) m
             ON s.id = m.session_id
             WHERE s.project_id = ?1
             ORDER BY m.max_ts DESC NULLS LAST
             LIMIT ?2"
        }
        (None, Some(_)) => {
            "SELECT s.id, s.project_id, s.status, s.transcript_path, s.slug, s.last_indexed_line
             FROM sessions s
             LEFT JOIN (SELECT session_id, MAX(timestamp) as max_ts FROM messages GROUP BY session_id) m
             ON s.id = m.session_id
             WHERE s.status = ?1
             ORDER BY m.max_ts DESC NULLS LAST
             LIMIT ?2"
        }
        (None, None) => {
            "SELECT s.id, s.project_id, s.status, s.transcript_path, s.slug, s.last_indexed_line
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
            last_indexed_line: row.get(5)?,
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

/// Reset all session files for re-indexing
pub fn reset_all_session_files_for_reindex() -> napi::Result<u32> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let count = conn
        .execute("UPDATE session_files SET last_indexed_line = 0", [])
        .map_err(|e| napi::Error::from_reason(format!("Failed to reset session files: {}", e)))?;

    Ok(count as u32)
}

/// List all session files that need indexing (where file has more lines than last_indexed_line)
/// Returns file paths only - caller should check file line counts
pub fn list_unindexed_session_files() -> napi::Result<Vec<SessionFile>> {
    let db = db::get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, file_type, file_path, agent_id, last_indexed_line, last_indexed_at, created_at
             FROM session_files ORDER BY created_at ASC",
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let rows = stmt
        .query_map([], |row| {
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
             (id, session_id, agent_id, parent_id, message_type, role, content, tool_name, tool_input, tool_result, raw_json, timestamp, line_number, source_file_name, source_file_type, sentiment_score, sentiment_level, frustration_score, frustration_level, indexed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
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
            SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as successful,
            SUM(CASE WHEN outcome = 'partial' THEN 1 ELSE 0 END) as partial,
            SUM(CASE WHEN outcome = 'failure' THEN 1 ELSE 0 END) as failed,
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
    let calibration = calculate_calibration_score(&conn, &time_filter)?;

    // Get tasks by type breakdown
    let by_type = get_tasks_by_type(&conn, &time_filter)?;

    // Get tasks by outcome breakdown
    let by_outcome = get_tasks_by_outcome(&conn, &time_filter)?;

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
#[napi]
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
#[napi]
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
#[napi]
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
#[napi]
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
#[napi]
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
#[napi]
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
#[napi]
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
            sql_parts.push(format!("completed_at = datetime('now')"));
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
#[napi]
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
#[napi]
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
#[napi]
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
#[napi]
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
#[napi]
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
#[napi]
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
#[napi]
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
#[napi]
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
#[napi]
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
#[napi]
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
#[napi]
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
