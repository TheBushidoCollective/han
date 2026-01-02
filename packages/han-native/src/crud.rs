//! CRUD operations for Han's unified data store (SQLite)
//!
//! Provides database operations for repos, projects, sessions, tasks,
//! hook cache, and marketplace cache.
//!
//! IMPORTANT: All database access MUST go through the coordinator.

use crate::db;
use crate::schema::*;
use rusqlite::params;
use uuid::Uuid;

// ============================================================================
// Repo Operations
// ============================================================================

pub fn upsert_repo(input: RepoInput) -> napi::Result<Repo> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // Use RETURNING to get the inserted/updated row in one query (avoids re-entrancy deadlock)
    let mut stmt = conn.prepare(
        "INSERT INTO repos (id, remote, name, default_branch, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)
         ON CONFLICT(remote) DO UPDATE SET
             name = excluded.name,
             default_branch = excluded.default_branch,
             updated_at = excluded.updated_at
         RETURNING id, remote, name, default_branch, created_at, updated_at"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare upsert: {}", e)))?;

    stmt.query_row(params![id, input.remote, input.name, input.default_branch, now], |row| {
        Ok(Repo {
            id: Some(row.get(0)?),
            remote: row.get(1)?,
            name: row.get(2)?,
            default_branch: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    }).map_err(|e| napi::Error::from_reason(format!("Failed to upsert repo: {}", e)))
}

pub fn get_repo_by_remote(remote: &str) -> napi::Result<Option<Repo>> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, remote, name, default_branch, created_at, updated_at
         FROM repos WHERE remote = ?1 LIMIT 1"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

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
        Err(e) => Err(napi::Error::from_reason(format!("Failed to get repo: {}", e))),
    }
}

pub fn list_repos() -> napi::Result<Vec<Repo>> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, remote, name, default_branch, created_at, updated_at
         FROM repos ORDER BY name ASC"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let rows = stmt.query_map([], |row| {
        Ok(Repo {
            id: Some(row.get(0)?),
            remote: row.get(1)?,
            name: row.get(2)?,
            default_branch: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    }).map_err(|e| napi::Error::from_reason(format!("Failed to list repos: {}", e)))?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

// ============================================================================
// Project Operations
// ============================================================================

pub fn upsert_project(input: ProjectInput) -> napi::Result<Project> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

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
        params![id, input.repo_id, input.slug, input.path, input.relative_path, input.name, is_worktree, now],
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
        }
    ).map_err(|e| napi::Error::from_reason(format!("Failed to upsert project: {}", e)))
}

pub fn get_project_by_slug(slug: &str) -> napi::Result<Option<Project>> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

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
        Err(e) => Err(napi::Error::from_reason(format!("Failed to get project: {}", e))),
    }
}

pub fn get_project_by_path(path: &str) -> napi::Result<Option<Project>> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

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
        Err(e) => Err(napi::Error::from_reason(format!("Failed to get project: {}", e))),
    }
}

pub fn list_projects(repo_id: Option<String>) -> napi::Result<Vec<Project>> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

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

        let rows: Vec<Project> = stmt.query_map(params![rid], map_row)
            .map_err(|e| napi::Error::from_reason(format!("Failed to list projects: {}", e)))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(rows)
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, repo_id, slug, path, relative_path, name, is_worktree, created_at, updated_at
             FROM projects ORDER BY name ASC"
        ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

        let rows: Vec<Project> = stmt.query_map([], map_row)
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
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let status = input.status.unwrap_or_else(|| "active".to_string());

    // id IS the session UUID - no separate session_id column
    // No timestamps stored - derived from messages
    let mut stmt = conn.prepare(
        "INSERT INTO sessions (id, project_id, status, transcript_path)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET
             project_id = COALESCE(excluded.project_id, sessions.project_id),
             status = excluded.status,
             transcript_path = COALESCE(excluded.transcript_path, sessions.transcript_path)
         RETURNING id, project_id, status, transcript_path, last_indexed_line"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare upsert: {}", e)))?;

    stmt.query_row(
        params![input.id, input.project_id, status, input.transcript_path],
        |row| {
            Ok(Session {
                id: row.get(0)?,
                project_id: row.get(1)?,
                status: row.get(2)?,
                transcript_path: row.get(3)?,
                last_indexed_line: row.get(4)?,
            })
        }
    ).map_err(|e| napi::Error::from_reason(format!("Failed to upsert session: {}", e)))
}

pub fn end_session(session_id: &str) -> napi::Result<bool> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Sessions table uses 'id' as primary key and has 'status' column
    // Timestamps are derived from messages table, not stored in sessions
    conn.execute(
        "UPDATE sessions SET status = 'completed' WHERE id = ?1",
        params![session_id],
    ).map_err(|e| napi::Error::from_reason(format!("Failed to end session: {}", e)))?;

    Ok(true)
}

pub fn get_session(session_id: &str) -> napi::Result<Option<Session>> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // id IS the session UUID - query by id directly
    let mut stmt = conn.prepare(
        "SELECT id, project_id, status, transcript_path, last_indexed_line
         FROM sessions WHERE id = ?1 LIMIT 1"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row(params![session_id], |row| {
        Ok(Session {
            id: row.get(0)?,
            project_id: row.get(1)?,
            status: row.get(2)?,
            transcript_path: row.get(3)?,
            last_indexed_line: row.get(4)?,
        })
    });

    match result {
        Ok(session) => Ok(Some(session)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!("Failed to get session: {}", e))),
    }
}

pub fn list_sessions(
    project_id: Option<String>,
    status: Option<String>,
    limit: Option<u32>,
) -> napi::Result<Vec<Session>> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;
    let limit_val = limit.unwrap_or(100);

    // id IS the session UUID - no separate session_id column
    let sql = match (&project_id, &status) {
        (Some(_), Some(_)) => {
            "SELECT id, project_id, status, transcript_path, last_indexed_line
             FROM sessions WHERE project_id = ?1 AND status = ?2
             LIMIT ?3"
        }
        (Some(_), None) => {
            "SELECT id, project_id, status, transcript_path, last_indexed_line
             FROM sessions WHERE project_id = ?1
             LIMIT ?2"
        }
        (None, Some(_)) => {
            "SELECT id, project_id, status, transcript_path, last_indexed_line
             FROM sessions WHERE status = ?1
             LIMIT ?2"
        }
        (None, None) => {
            "SELECT id, project_id, status, transcript_path, last_indexed_line
             FROM sessions LIMIT ?1"
        }
    };

    let mut stmt = conn.prepare(sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let map_row = |row: &rusqlite::Row| -> rusqlite::Result<Session> {
        Ok(Session {
            id: row.get(0)?,
            project_id: row.get(1)?,
            status: row.get(2)?,
            transcript_path: row.get(3)?,
            last_indexed_line: row.get(4)?,
        })
    };

    let rows: Vec<Session> = match (&project_id, &status) {
        (Some(pid), Some(s)) => {
            stmt.query_map(params![pid, s, limit_val], map_row)
                .map_err(|e| napi::Error::from_reason(format!("Failed to list sessions: {}", e)))?
                .filter_map(|r| r.ok())
                .collect()
        }
        (Some(pid), None) => {
            stmt.query_map(params![pid, limit_val], map_row)
                .map_err(|e| napi::Error::from_reason(format!("Failed to list sessions: {}", e)))?
                .filter_map(|r| r.ok())
                .collect()
        }
        (None, Some(s)) => {
            stmt.query_map(params![s, limit_val], map_row)
                .map_err(|e| napi::Error::from_reason(format!("Failed to list sessions: {}", e)))?
                .filter_map(|r| r.ok())
                .collect()
        }
        (None, None) => {
            stmt.query_map(params![limit_val], map_row)
                .map_err(|e| napi::Error::from_reason(format!("Failed to list sessions: {}", e)))?
                .filter_map(|r| r.ok())
                .collect()
        }
    };

    Ok(rows)
}

/// Update the last indexed line for a session
pub fn update_last_indexed_line(session_id: &str, line_number: i32) -> napi::Result<bool> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // session_id IS the id (primary key)
    conn.execute(
        "UPDATE sessions SET last_indexed_line = ?1 WHERE id = ?2",
        params![line_number, session_id],
    ).map_err(|e| napi::Error::from_reason(format!("Failed to update last indexed line: {}", e)))?;

    Ok(true)
}

/// Reset all sessions for re-indexing
/// Sets last_indexed_line to 0 so all messages will be re-processed
pub fn reset_all_sessions_for_reindex() -> napi::Result<u32> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let count = conn.execute(
        "UPDATE sessions SET last_indexed_line = 0",
        [],
    ).map_err(|e| napi::Error::from_reason(format!("Failed to reset sessions: {}", e)))?;

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
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

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
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

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
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

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
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

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
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let count = conn
        .execute("UPDATE session_files SET last_indexed_line = 0", [])
        .map_err(|e| napi::Error::from_reason(format!("Failed to reset session files: {}", e)))?;

    Ok(count as u32)
}

/// List all session files that need indexing (where file has more lines than last_indexed_line)
/// Returns file paths only - caller should check file line counts
pub fn list_unindexed_session_files() -> napi::Result<Vec<SessionFile>> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

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
// Message Operations
// ============================================================================

/// Insert a batch of messages for a session
pub fn insert_messages_batch(session_id: &str, messages: Vec<MessageInput>) -> napi::Result<u32> {
    if messages.is_empty() {
        return Ok(0);
    }

    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;
    let now = chrono::Utc::now().to_rfc3339();

    // session_id IS the id (primary key) - no lookup needed
    let mut count = 0u32;

    for msg in messages {
        // id IS the message UUID from JSONL - no generated ID
        // Use UPSERT to update fields for existing messages (migration path for old data)
        // NOTE: message_type must be updated to fix sentiment events that were stored with wrong type
        conn.execute(
            "INSERT INTO messages
             (id, session_id, message_type, role, content, tool_name, tool_input, tool_result, raw_json, timestamp, line_number, indexed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
             ON CONFLICT(id) DO UPDATE SET
                message_type = excluded.message_type,
                tool_name = excluded.tool_name,
                content = COALESCE(excluded.content, content),
                raw_json = COALESCE(excluded.raw_json, raw_json),
                indexed_at = excluded.indexed_at",
            params![
                msg.id,  // id IS the message UUID from JSONL
                session_id,  // session_id IS the session's id
                msg.message_type,
                msg.role,
                msg.content,
                msg.tool_name,
                msg.tool_input,
                msg.tool_result,
                msg.raw_json,
                msg.timestamp,
                msg.line_number,
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
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // id IS the message UUID - no separate message_id column
    let mut stmt = conn.prepare(
        "SELECT id, session_id, message_type, role, content,
                tool_name, tool_input, tool_result, raw_json, timestamp, line_number, indexed_at
         FROM messages WHERE id = ?1 LIMIT 1"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row(params![message_id], |row| {
        Ok(Message {
            id: row.get(0)?,
            session_id: row.get(1)?,
            message_type: row.get(2)?,
            role: row.get(3)?,
            content: row.get(4)?,
            tool_name: row.get(5)?,
            tool_input: row.get(6)?,
            tool_result: row.get(7)?,
            raw_json: row.get(8)?,
            timestamp: row.get(9)?,
            line_number: row.get(10)?,
            indexed_at: row.get(11)?,
        })
    });

    match result {
        Ok(message) => Ok(Some(message)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!("Failed to get message: {}", e))),
    }
}

/// List messages for a session (session_id IS the session's id)
pub fn list_session_messages(
    session_id: &str,
    message_type: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> napi::Result<Vec<Message>> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;
    // Default to very high limit when not specified - caller should paginate if needed
    let limit_val = limit.unwrap_or(100_000);
    let offset_val = offset.unwrap_or(0);

    // No JOIN needed - session_id is the FK directly
    // Order by timestamp DESC (newest first) for forward pagination with column-reverse
    // first/after pagination takes from the start, giving us newest messages
    // column-reverse in UI puts first array item at visual bottom = newest at bottom
    // Note: line_number is still stored for incremental indexing, but UI sorts by timestamp
    // because han_events and sentiment events have artificial line_number offsets (1M and 500K)
    let sql = if message_type.is_some() {
        "SELECT id, session_id, message_type, role, content,
                tool_name, tool_input, tool_result, raw_json, timestamp, line_number, indexed_at
         FROM messages
         WHERE session_id = ?1 AND message_type = ?2
         ORDER BY timestamp DESC
         LIMIT ?3 OFFSET ?4"
    } else {
        "SELECT id, session_id, message_type, role, content,
                tool_name, tool_input, tool_result, raw_json, timestamp, line_number, indexed_at
         FROM messages
         WHERE session_id = ?1
         ORDER BY timestamp DESC
         LIMIT ?2 OFFSET ?3"
    };

    let mut stmt = conn.prepare(sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let map_row = |row: &rusqlite::Row| -> rusqlite::Result<Message> {
        Ok(Message {
            id: row.get(0)?,
            session_id: row.get(1)?,
            message_type: row.get(2)?,
            role: row.get(3)?,
            content: row.get(4)?,
            tool_name: row.get(5)?,
            tool_input: row.get(6)?,
            tool_result: row.get(7)?,
            raw_json: row.get(8)?,
            timestamp: row.get(9)?,
            line_number: row.get(10)?,
            indexed_at: row.get(11)?,
        })
    };

    let rows: Vec<Message> = if let Some(ref mtype) = message_type {
        stmt.query_map(params![session_id, mtype, limit_val, offset_val], map_row)
            .map_err(|e| napi::Error::from_reason(format!("Failed to list messages: {}", e)))?
            .filter_map(|r| r.ok())
            .collect()
    } else {
        stmt.query_map(params![session_id, limit_val, offset_val], map_row)
            .map_err(|e| napi::Error::from_reason(format!("Failed to list messages: {}", e)))?
            .filter_map(|r| r.ok())
            .collect()
    };

    Ok(rows)
}

/// Get message count for a session (only user and assistant messages)
pub fn get_message_count(session_id: &str) -> napi::Result<u32> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // session_id IS the primary key (id) in the new schema - no JOIN needed
    let count: u32 = conn.query_row(
        "SELECT COUNT(*) FROM messages
         WHERE session_id = ?1 AND message_type IN ('user', 'assistant')",
        params![session_id],
        |row| row.get(0),
    ).map_err(|e| napi::Error::from_reason(format!("Failed to count messages: {}", e)))?;

    Ok(count)
}

/// Get message counts for multiple sessions in a single query
pub fn get_message_counts_batch(session_ids: Vec<String>) -> napi::Result<std::collections::HashMap<String, u32>> {
    if session_ids.is_empty() {
        return Ok(std::collections::HashMap::new());
    }

    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Initialize all to 0
    let mut result: std::collections::HashMap<String, u32> = session_ids
        .iter()
        .map(|id| (id.clone(), 0))
        .collect();

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

    let mut stmt = conn.prepare(&sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    // Convert session_ids to rusqlite params
    let params: Vec<&dyn rusqlite::ToSql> = session_ids.iter().map(|s| s as &dyn rusqlite::ToSql).collect();

    let rows = stmt.query_map(params.as_slice(), |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, u32>(1)?))
    }).map_err(|e| napi::Error::from_reason(format!("Failed to count messages batch: {}", e)))?;

    for row in rows.flatten() {
        result.insert(row.0, row.1);
    }

    Ok(result)
}

/// Get the highest line number indexed for a session
pub fn get_last_indexed_line(session_id: &str) -> napi::Result<i32> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // session_id IS the primary key (id) in the new schema
    let line: Option<i32> = conn.query_row(
        "SELECT last_indexed_line FROM sessions WHERE id = ?1",
        params![session_id],
        |row| row.get(0),
    ).ok();

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
pub fn get_session_timestamps_batch(session_ids: Vec<String>) -> napi::Result<std::collections::HashMap<String, SessionTimestamps>> {
    if session_ids.is_empty() {
        return Ok(std::collections::HashMap::new());
    }

    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Initialize all to empty timestamps
    let mut result: std::collections::HashMap<String, SessionTimestamps> = session_ids
        .iter()
        .map(|id| (id.clone(), SessionTimestamps {
            session_id: id.clone(),
            started_at: None,
            ended_at: None,
        }))
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

    let mut stmt = conn.prepare(&sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    // Convert session_ids to rusqlite params
    let params: Vec<&dyn rusqlite::ToSql> = session_ids.iter().map(|s| s as &dyn rusqlite::ToSql).collect();

    let rows = stmt.query_map(params.as_slice(), |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, Option<String>>(1)?,
            row.get::<_, Option<String>>(2)?
        ))
    }).map_err(|e| napi::Error::from_reason(format!("Failed to get timestamps batch: {}", e)))?;

    for row in rows.flatten() {
        result.insert(row.0.clone(), SessionTimestamps {
            session_id: row.0,
            started_at: row.1,
            ended_at: row.2,
        });
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
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;
    let limit_val = limit.unwrap_or(50);

    // Escape the query to prevent FTS5 syntax errors
    let escaped_query = escape_fts5_query(query);

    // No JOINs needed - session_id in messages directly references sessions.id
    // id IS the message UUID from JSONL (no separate message_id column)
    let sql = if session_id.is_some() {
        "SELECT m.id, m.session_id, m.message_type, m.role, m.content,
                m.tool_name, m.tool_input, m.tool_result, m.raw_json, m.timestamp, m.line_number, m.indexed_at
         FROM messages m
         JOIN messages_fts ON messages_fts.rowid = m.rowid
         WHERE messages_fts MATCH ?1 AND m.session_id = ?2
         ORDER BY m.timestamp DESC
         LIMIT ?3"
    } else {
        "SELECT m.id, m.session_id, m.message_type, m.role, m.content,
                m.tool_name, m.tool_input, m.tool_result, m.raw_json, m.timestamp, m.line_number, m.indexed_at
         FROM messages m
         JOIN messages_fts ON messages_fts.rowid = m.rowid
         WHERE messages_fts MATCH ?1
         ORDER BY m.timestamp DESC
         LIMIT ?2"
    };

    let mut stmt = conn.prepare(sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare search: {}", e)))?;

    let rows: Vec<Message> = if let Some(ref sid) = session_id {
        stmt.query_map(params![escaped_query, sid, limit_val], |row| {
            Ok(Message {
                id: row.get(0)?,
                session_id: row.get(1)?,
                message_type: row.get(2)?,
                role: row.get(3)?,
                content: row.get(4)?,
                tool_name: row.get(5)?,
                tool_input: row.get(6)?,
                tool_result: row.get(7)?,
                raw_json: row.get(8)?,
                timestamp: row.get(9)?,
                line_number: row.get(10)?,
                indexed_at: row.get(11)?,
            })
        }).map_err(|e| napi::Error::from_reason(format!("Failed to search: {}", e)))?
        .filter_map(|r| r.ok())
        .collect()
    } else {
        stmt.query_map(params![escaped_query, limit_val], |row| {
            Ok(Message {
                id: row.get(0)?,
                session_id: row.get(1)?,
                message_type: row.get(2)?,
                role: row.get(3)?,
                content: row.get(4)?,
                tool_name: row.get(5)?,
                tool_input: row.get(6)?,
                tool_result: row.get(7)?,
                raw_json: row.get(8)?,
                timestamp: row.get(9)?,
                line_number: row.get(10)?,
                indexed_at: row.get(11)?,
            })
        }).map_err(|e| napi::Error::from_reason(format!("Failed to search: {}", e)))?
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
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // Use RETURNING to get the inserted row (avoids re-entrancy deadlock)
    let mut stmt = conn.prepare(
        "INSERT INTO tasks (id, session_id, task_id, description, task_type, started_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         RETURNING id, session_id, task_id, description, task_type, outcome, confidence, notes, files_modified, tests_added, started_at, completed_at"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare insert: {}", e)))?;

    stmt.query_row(
        params![id, input.session_id, input.task_id, input.description, input.task_type, now],
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
        }
    ).map_err(|e| napi::Error::from_reason(format!("Failed to create task: {}", e)))
}

pub fn complete_task(completion: TaskCompletion) -> napi::Result<Task> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let now = chrono::Utc::now().to_rfc3339();
    let files_json = completion.files_modified.as_ref()
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
        }
    ).map_err(|e| napi::Error::from_reason(format!("Failed to complete task: {}", e)))
}

pub fn fail_task(failure: TaskFailure) -> napi::Result<Task> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let now = chrono::Utc::now().to_rfc3339();
    let notes = format!(
        "Failure reason: {}\n{}{}",
        failure.reason,
        failure.notes.as_deref().map(|n| format!("\nNotes: {}", n)).unwrap_or_default(),
        failure.attempted_solutions.as_ref()
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
        }
    ).map_err(|e| napi::Error::from_reason(format!("Failed to fail task: {}", e)))
}

pub fn get_task(task_id: &str) -> napi::Result<Option<Task>> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, session_id, task_id, description, task_type, outcome, confidence, notes, files_modified, tests_added, started_at, completed_at
         FROM tasks WHERE task_id = ?1 LIMIT 1"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row(params![task_id], |row| {
        let files_json: Option<String> = row.get(8)?;
        let files_modified = files_json
            .and_then(|j| serde_json::from_str::<Vec<String>>(&j).ok());

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
        Err(e) => Err(napi::Error::from_reason(format!("Failed to get task: {}", e))),
    }
}

pub fn query_task_metrics(
    task_type: Option<String>,
    outcome: Option<String>,
    period: Option<String>,
) -> napi::Result<TaskMetrics> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

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
        if task_type.is_some() { "AND task_type = ?1" } else { "" },
        if outcome.is_some() { if task_type.is_some() { "AND outcome = ?2" } else { "AND outcome = ?1" } } else { "" },
        time_filter
    );

    let mut stmt = conn.prepare(&base_sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let map_err = |e: rusqlite::Error| napi::Error::from_reason(format!("Failed to query metrics: {}", e));

    let (total, completed, successful, partial, failed, avg_conf, avg_duration): (i64, i64, i64, i64, i64, Option<f64>, Option<f64>) = match (&task_type, &outcome) {
        (Some(tt), Some(o)) => stmt.query_row(params![tt, o], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?))).map_err(map_err)?,
        (Some(tt), None) => stmt.query_row(params![tt], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?))).map_err(map_err)?,
        (None, Some(o)) => stmt.query_row(params![o], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?))).map_err(map_err)?,
        (None, None) => stmt.query_row([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?, row.get(6)?))).map_err(map_err)?,
    };

    // Calculate success rate
    let success_rate = if completed > 0 { successful as f64 / completed as f64 } else { 0.0 };

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

fn calculate_calibration_score(conn: &rusqlite::Connection, time_filter: &str) -> napi::Result<f64> {
    let sql = format!(
        "SELECT confidence, outcome FROM tasks WHERE confidence IS NOT NULL AND outcome IS NOT NULL {}",
        time_filter
    );

    let mut stmt = conn.prepare(&sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare calibration query: {}", e)))?;

    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, f64>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| napi::Error::from_reason(format!("Failed to query calibration: {}", e)))?;

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

fn get_tasks_by_type(conn: &rusqlite::Connection, time_filter: &str) -> napi::Result<std::collections::HashMap<String, i64>> {
    let sql = format!(
        "SELECT task_type, COUNT(*) as count FROM tasks WHERE 1=1 {} GROUP BY task_type",
        time_filter
    );

    let mut stmt = conn.prepare(&sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare type query: {}", e)))?;

    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
    }).map_err(|e| napi::Error::from_reason(format!("Failed to query task types: {}", e)))?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

fn get_tasks_by_outcome(conn: &rusqlite::Connection, time_filter: &str) -> napi::Result<std::collections::HashMap<String, i64>> {
    let sql = format!(
        "SELECT outcome, COUNT(*) as count FROM tasks WHERE outcome IS NOT NULL {} GROUP BY outcome",
        time_filter
    );

    let mut stmt = conn.prepare(&sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare outcome query: {}", e)))?;

    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
    }).map_err(|e| napi::Error::from_reason(format!("Failed to query task outcomes: {}", e)))?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

// ============================================================================
// Hook Cache Operations
// ============================================================================

pub fn set_hook_cache(input: HookCacheInput) -> napi::Result<bool> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let expires_at = input.ttl_seconds.map(|ttl| {
        (chrono::Utc::now() + chrono::Duration::seconds(ttl)).to_rfc3339()
    });

    conn.execute(
        "INSERT INTO hook_cache (id, project_id, cache_key, file_hash, result, cached_at, expires_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(cache_key) DO UPDATE SET
             file_hash = excluded.file_hash,
             result = excluded.result,
             cached_at = excluded.cached_at,
             expires_at = excluded.expires_at",
        params![id, input.project_id, input.cache_key, input.file_hash, input.result, now, expires_at],
    ).map_err(|e| napi::Error::from_reason(format!("Failed to set hook cache: {}", e)))?;

    Ok(true)
}

pub fn get_hook_cache(cache_key: &str) -> napi::Result<Option<HookCacheEntry>> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, project_id, cache_key, file_hash, result, cached_at, expires_at
         FROM hook_cache
         WHERE cache_key = ?1 AND (expires_at IS NULL OR expires_at > datetime('now'))
         LIMIT 1"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row(params![cache_key], |row| {
        Ok(HookCacheEntry {
            id: Some(row.get(0)?),
            project_id: row.get(1)?,
            cache_key: row.get(2)?,
            file_hash: row.get(3)?,
            result: row.get(4)?,
            cached_at: row.get(5)?,
            expires_at: row.get(6)?,
        })
    });

    match result {
        Ok(entry) => Ok(Some(entry)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!("Failed to get cache: {}", e))),
    }
}

pub fn invalidate_hook_cache(cache_key: &str) -> napi::Result<bool> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    conn.execute(
        "DELETE FROM hook_cache WHERE cache_key = ?1",
        params![cache_key],
    ).map_err(|e| napi::Error::from_reason(format!("Failed to invalidate cache: {}", e)))?;

    Ok(true)
}

pub fn cleanup_expired_cache() -> napi::Result<u32> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let count = conn.execute(
        "DELETE FROM hook_cache WHERE expires_at < datetime('now')",
        [],
    ).map_err(|e| napi::Error::from_reason(format!("Failed to cleanup cache: {}", e)))?;

    Ok(count as u32)
}

// ============================================================================
// Marketplace Cache Operations
// ============================================================================

pub fn upsert_marketplace_plugin(input: MarketplacePluginInput) -> napi::Result<bool> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO marketplace_plugins (id, plugin_id, name, description, version, category, metadata, fetched_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(plugin_id) DO UPDATE SET
             name = excluded.name,
             description = excluded.description,
             version = excluded.version,
             category = excluded.category,
             metadata = excluded.metadata,
             fetched_at = excluded.fetched_at",
        params![id, input.plugin_id, input.name, input.description, input.version, input.category, input.metadata, now],
    ).map_err(|e| napi::Error::from_reason(format!("Failed to upsert plugin: {}", e)))?;

    Ok(true)
}

pub fn get_marketplace_plugin(plugin_id: &str) -> napi::Result<Option<MarketplacePlugin>> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, plugin_id, name, description, version, category, metadata, fetched_at
         FROM marketplace_plugins WHERE plugin_id = ?1 LIMIT 1"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row(params![plugin_id], |row| {
        Ok(MarketplacePlugin {
            id: Some(row.get(0)?),
            plugin_id: row.get(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
            version: row.get(4)?,
            category: row.get(5)?,
            metadata: row.get(6)?,
            fetched_at: row.get(7)?,
        })
    });

    match result {
        Ok(plugin) => Ok(Some(plugin)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!("Failed to get plugin: {}", e))),
    }
}

pub fn list_marketplace_plugins(category: Option<String>) -> napi::Result<Vec<MarketplacePlugin>> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let sql = if category.is_some() {
        "SELECT id, plugin_id, name, description, version, category, metadata, fetched_at
         FROM marketplace_plugins WHERE category = ?1 ORDER BY name ASC"
    } else {
        "SELECT id, plugin_id, name, description, version, category, metadata, fetched_at
         FROM marketplace_plugins ORDER BY name ASC"
    };

    let mut stmt = conn.prepare(sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let rows: Vec<MarketplacePlugin> = if let Some(ref cat) = category {
        stmt.query_map(params![cat], |row| {
            Ok(MarketplacePlugin {
                id: Some(row.get(0)?),
                plugin_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                version: row.get(4)?,
                category: row.get(5)?,
                metadata: row.get(6)?,
                fetched_at: row.get(7)?,
            })
        }).map_err(|e| napi::Error::from_reason(format!("Failed to list plugins: {}", e)))?
        .filter_map(|r| r.ok())
        .collect()
    } else {
        stmt.query_map([], |row| {
            Ok(MarketplacePlugin {
                id: Some(row.get(0)?),
                plugin_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                version: row.get(4)?,
                category: row.get(5)?,
                metadata: row.get(6)?,
                fetched_at: row.get(7)?,
            })
        }).map_err(|e| napi::Error::from_reason(format!("Failed to list plugins: {}", e)))?
        .filter_map(|r| r.ok())
        .collect()
    };

    Ok(rows)
}

// ============================================================================
// Hook Execution Operations
// ============================================================================

pub fn record_hook_execution(input: HookExecutionInput) -> napi::Result<HookExecution> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let mut stmt = conn.prepare(
        "INSERT INTO hook_executions (id, session_id, task_id, hook_type, hook_name, hook_source, duration_ms, exit_code, passed, output, error, executed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
         RETURNING id, session_id, task_id, hook_type, hook_name, hook_source, duration_ms, exit_code, passed, output, error, executed_at"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare insert: {}", e)))?;

    stmt.query_row(
        params![id, input.session_id, input.task_id, input.hook_type, input.hook_name, input.hook_source, input.duration_ms, input.exit_code, input.passed as i32, input.output, input.error, now],
        |row| {
            Ok(HookExecution {
                id: Some(row.get(0)?),
                session_id: row.get(1)?,
                task_id: row.get(2)?,
                hook_type: row.get(3)?,
                hook_name: row.get(4)?,
                hook_source: row.get(5)?,
                duration_ms: row.get(6)?,
                exit_code: row.get(7)?,
                passed: row.get::<_, i32>(8)? != 0,
                output: row.get(9)?,
                error: row.get(10)?,
                executed_at: row.get(11)?,
            })
        }
    ).map_err(|e| napi::Error::from_reason(format!("Failed to record hook execution: {}", e)))
}

pub fn query_hook_stats(period: Option<String>) -> napi::Result<HookStats> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

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

    let mut stmt = conn.prepare(&sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let (total, passed, failed, unique_hooks): (i64, i64, i64, i64) = stmt.query_row([], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
    }).map_err(|e| napi::Error::from_reason(format!("Failed to query hook stats: {}", e)))?;

    let pass_rate = if total > 0 { passed as f64 / total as f64 } else { 0.0 };

    // Get by hook type breakdown
    let type_sql = format!(
        "SELECT hook_type, COUNT(*) as count FROM hook_executions WHERE 1=1 {} GROUP BY hook_type",
        time_filter
    );
    let mut type_stmt = conn.prepare(&type_sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare type query: {}", e)))?;

    let type_rows = type_stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
    }).map_err(|e| napi::Error::from_reason(format!("Failed to query hook types: {}", e)))?;

    let by_hook_type: std::collections::HashMap<String, i64> = type_rows.filter_map(|r| r.ok()).collect();

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
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let signals_json = input.detected_signals.map(|s| serde_json::to_string(&s).unwrap_or_default());

    let mut stmt = conn.prepare(
        "INSERT INTO frustration_events (id, session_id, task_id, frustration_level, frustration_score, user_message, detected_signals, context, recorded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         RETURNING id, session_id, task_id, frustration_level, frustration_score, user_message, detected_signals, context, recorded_at"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare insert: {}", e)))?;

    stmt.query_row(
        params![id, input.session_id, input.task_id, input.frustration_level, input.frustration_score, input.user_message, signals_json, input.context, now],
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
        }
    ).map_err(|e| napi::Error::from_reason(format!("Failed to record frustration: {}", e)))
}

pub fn query_frustration_metrics(period: Option<String>, total_tasks: i64) -> napi::Result<FrustrationMetrics> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

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

    let mut stmt = conn.prepare(&sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let (total, significant, weighted): (i64, i64, f64) = stmt.query_row([], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get::<_, f64>(2).unwrap_or(0.0)))
    }).map_err(|e| napi::Error::from_reason(format!("Failed to query frustration metrics: {}", e)))?;

    let frustration_rate = if total_tasks > 0 { total as f64 / total_tasks as f64 } else { 0.0 };
    let significant_rate = if total_tasks > 0 { significant as f64 / total_tasks as f64 } else { 0.0 };

    // Get by level breakdown
    let level_sql = format!(
        "SELECT frustration_level, COUNT(*) as count FROM frustration_events WHERE 1=1 {} GROUP BY frustration_level",
        time_filter
    );
    let mut level_stmt = conn.prepare(&level_sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare level query: {}", e)))?;

    let level_rows = level_stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
    }).map_err(|e| napi::Error::from_reason(format!("Failed to query frustration levels: {}", e)))?;

    let by_level: std::collections::HashMap<String, i64> = level_rows.filter_map(|r| r.ok()).collect();

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
// Checkpoint Operations
// ============================================================================

pub fn create_checkpoint(input: CheckpointInput) -> napi::Result<Checkpoint> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let mut stmt = conn.prepare(
        "INSERT INTO checkpoints (id, session_id, project_path, file_path, file_hash, blob_path, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(session_id, project_path, file_path) DO UPDATE SET
             file_hash = excluded.file_hash,
             blob_path = excluded.blob_path,
             created_at = excluded.created_at
         RETURNING id, session_id, project_path, file_path, file_hash, blob_path, created_at"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare insert: {}", e)))?;

    stmt.query_row(
        params![id, input.session_id, input.project_path, input.file_path, input.file_hash, input.blob_path, now],
        |row| {
            Ok(Checkpoint {
                id: Some(row.get(0)?),
                session_id: row.get(1)?,
                project_path: row.get(2)?,
                file_path: row.get(3)?,
                file_hash: row.get(4)?,
                blob_path: row.get(5)?,
                created_at: row.get(6)?,
            })
        }
    ).map_err(|e| napi::Error::from_reason(format!("Failed to create checkpoint: {}", e)))
}

pub fn get_checkpoint(session_id: &str, file_path: &str) -> napi::Result<Option<Checkpoint>> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, session_id, project_path, file_path, file_hash, blob_path, created_at
         FROM checkpoints WHERE session_id = ?1 AND file_path = ?2 LIMIT 1"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let result = stmt.query_row(params![session_id, file_path], |row| {
        Ok(Checkpoint {
            id: Some(row.get(0)?),
            session_id: row.get(1)?,
            project_path: row.get(2)?,
            file_path: row.get(3)?,
            file_hash: row.get(4)?,
            blob_path: row.get(5)?,
            created_at: row.get(6)?,
        })
    });

    match result {
        Ok(checkpoint) => Ok(Some(checkpoint)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(napi::Error::from_reason(format!("Failed to get checkpoint: {}", e))),
    }
}

pub fn list_checkpoints(session_id: &str) -> napi::Result<Vec<Checkpoint>> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, session_id, project_path, file_path, file_hash, blob_path, created_at
         FROM checkpoints WHERE session_id = ?1 ORDER BY created_at DESC"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let rows = stmt.query_map(params![session_id], |row| {
        Ok(Checkpoint {
            id: Some(row.get(0)?),
            session_id: row.get(1)?,
            project_path: row.get(2)?,
            file_path: row.get(3)?,
            file_hash: row.get(4)?,
            blob_path: row.get(5)?,
            created_at: row.get(6)?,
        })
    }).map_err(|e| napi::Error::from_reason(format!("Failed to list checkpoints: {}", e)))?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

// ============================================================================
// Session File Change Operations
// ============================================================================

pub fn record_file_change(input: SessionFileChangeInput) -> napi::Result<SessionFileChange> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let mut stmt = conn.prepare(
        "INSERT INTO session_file_changes (id, session_id, file_path, action, file_hash_before, file_hash_after, tool_name, recorded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         RETURNING id, session_id, file_path, action, file_hash_before, file_hash_after, tool_name, recorded_at"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare insert: {}", e)))?;

    stmt.query_row(
        params![id, input.session_id, input.file_path, input.action, input.file_hash_before, input.file_hash_after, input.tool_name, now],
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
        }
    ).map_err(|e| napi::Error::from_reason(format!("Failed to record file change: {}", e)))
}

pub fn get_session_file_changes(session_id: &str) -> napi::Result<Vec<SessionFileChange>> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let mut stmt = conn.prepare(
        "SELECT id, session_id, file_path, action, file_hash_before, file_hash_after, tool_name, recorded_at
         FROM session_file_changes WHERE session_id = ?1 ORDER BY recorded_at DESC"
    ).map_err(|e| napi::Error::from_reason(format!("Failed to prepare query: {}", e)))?;

    let rows = stmt.query_map(params![session_id], |row| {
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
    }).map_err(|e| napi::Error::from_reason(format!("Failed to get file changes: {}", e)))?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn has_session_changes(session_id: &str) -> napi::Result<bool> {
    let db = db::get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM session_file_changes WHERE session_id = ?1",
        params![session_id],
        |row| row.get(0)
    ).map_err(|e| napi::Error::from_reason(format!("Failed to check session changes: {}", e)))?;

    Ok(count > 0)
}
