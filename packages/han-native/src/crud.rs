//! CRUD operations for Han's unified data store
//!
//! Provides database operations for repos, projects, sessions, tasks,
//! hook cache, and marketplace cache.

use crate::schema::*;
use surrealdb::engine::local::Db;
use surrealdb::Surreal;
use serde::Deserialize;

// ============================================================================
// Repo Operations
// ============================================================================

pub async fn upsert_repo(db: &Surreal<Db>, input: RepoInput) -> napi::Result<Repo> {
    #[derive(Debug, Deserialize)]
    struct DbRepo {
        id: Option<surrealdb::RecordId>,
        remote: String,
        name: String,
        default_branch: Option<String>,
        created_at: Option<String>,
        updated_at: Option<String>,
    }

    let remote = input.remote.clone();
    let name = input.name.clone();
    let default_branch = input.default_branch.clone();

    // Use remote as the record ID for upsert
    let mut response = db
        .query(
            r#"
            UPSERT type::thing("repo", $remote) CONTENT {
                remote: $remote,
                name: $name,
                default_branch: $default_branch,
                updated_at: time::now()
            };
            "#,
        )
        .bind(("remote", remote))
        .bind(("name", name))
        .bind(("default_branch", default_branch))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to upsert repo: {}", e)))?;

    let rows: Vec<DbRepo> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse repo result: {}", e)))?;

    let row = rows.into_iter().next().ok_or_else(|| {
        napi::Error::from_reason("No repo returned from upsert".to_string())
    })?;

    Ok(Repo {
        id: row.id.map(|r| r.to_string()),
        remote: row.remote,
        name: row.name,
        default_branch: row.default_branch,
        created_at: row.created_at,
        updated_at: row.updated_at,
    })
}

pub async fn get_repo_by_remote(db: &Surreal<Db>, remote: &str) -> napi::Result<Option<Repo>> {
    #[derive(Debug, Deserialize)]
    struct DbRepo {
        id: Option<surrealdb::RecordId>,
        remote: String,
        name: String,
        default_branch: Option<String>,
        created_at: Option<String>,
        updated_at: Option<String>,
    }

    let remote_owned = remote.to_string();
    let mut response = db
        .query("SELECT * FROM repo WHERE remote = $remote LIMIT 1;")
        .bind(("remote", remote_owned))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to get repo: {}", e)))?;

    let rows: Vec<DbRepo> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse repo result: {}", e)))?;

    Ok(rows.into_iter().next().map(|row| Repo {
        id: row.id.map(|r| r.to_string()),
        remote: row.remote,
        name: row.name,
        default_branch: row.default_branch,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }))
}

pub async fn list_repos(db: &Surreal<Db>) -> napi::Result<Vec<Repo>> {
    #[derive(Debug, Deserialize)]
    struct DbRepo {
        id: Option<surrealdb::RecordId>,
        remote: String,
        name: String,
        default_branch: Option<String>,
        created_at: Option<String>,
        updated_at: Option<String>,
    }

    let mut response = db
        .query("SELECT * FROM repo ORDER BY name ASC;")
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to list repos: {}", e)))?;

    let rows: Vec<DbRepo> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse repos: {}", e)))?;

    Ok(rows.into_iter().map(|row| Repo {
        id: row.id.map(|r| r.to_string()),
        remote: row.remote,
        name: row.name,
        default_branch: row.default_branch,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }).collect())
}

// ============================================================================
// Project Operations
// ============================================================================

pub async fn upsert_project(db: &Surreal<Db>, input: ProjectInput) -> napi::Result<Project> {
    #[derive(Debug, Deserialize)]
    struct DbProject {
        id: Option<surrealdb::RecordId>,
        repo: Option<surrealdb::RecordId>,
        slug: String,
        path: String,
        relative_path: Option<String>,
        name: String,
        is_worktree: bool,
        created_at: Option<String>,
        updated_at: Option<String>,
    }

    let repo_ref = input.repo_id.as_ref().map(|id| format!("repo:{}", id));
    let slug = input.slug.clone();
    let path = input.path.clone();
    let relative_path = input.relative_path.clone();
    let name = input.name.clone();
    let is_worktree = input.is_worktree.unwrap_or(false);

    // Use slug as the record ID for upsert
    let mut response = db
        .query(
            r#"
            UPSERT type::thing("project", $slug) CONTENT {
                repo: $repo,
                slug: $slug,
                path: $path,
                relative_path: $relative_path,
                name: $name,
                is_worktree: $is_worktree,
                updated_at: time::now()
            };
            "#,
        )
        .bind(("repo", repo_ref))
        .bind(("slug", slug))
        .bind(("path", path))
        .bind(("relative_path", relative_path))
        .bind(("name", name))
        .bind(("is_worktree", is_worktree))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to upsert project: {}", e)))?;

    let rows: Vec<DbProject> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse project result: {}", e)))?;

    let row = rows.into_iter().next().ok_or_else(|| {
        napi::Error::from_reason("No project returned from upsert".to_string())
    })?;

    Ok(Project {
        id: row.id.map(|r| r.to_string()),
        repo_id: row.repo.map(|r| r.to_string()),
        slug: row.slug,
        path: row.path,
        relative_path: row.relative_path,
        name: row.name,
        is_worktree: row.is_worktree,
        created_at: row.created_at,
        updated_at: row.updated_at,
    })
}

pub async fn get_project_by_slug(db: &Surreal<Db>, slug: &str) -> napi::Result<Option<Project>> {
    #[derive(Debug, Deserialize)]
    struct DbProject {
        id: Option<surrealdb::RecordId>,
        repo: Option<surrealdb::RecordId>,
        slug: String,
        path: String,
        relative_path: Option<String>,
        name: String,
        is_worktree: bool,
        created_at: Option<String>,
        updated_at: Option<String>,
    }

    let slug_owned = slug.to_string();
    let mut response = db
        .query("SELECT * FROM project WHERE slug = $slug LIMIT 1;")
        .bind(("slug", slug_owned))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to get project: {}", e)))?;

    let rows: Vec<DbProject> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse project: {}", e)))?;

    Ok(rows.into_iter().next().map(|row| Project {
        id: row.id.map(|r| r.to_string()),
        repo_id: row.repo.map(|r| r.to_string()),
        slug: row.slug,
        path: row.path,
        relative_path: row.relative_path,
        name: row.name,
        is_worktree: row.is_worktree,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }))
}

pub async fn get_project_by_path(db: &Surreal<Db>, path: &str) -> napi::Result<Option<Project>> {
    #[derive(Debug, Deserialize)]
    struct DbProject {
        id: Option<surrealdb::RecordId>,
        repo: Option<surrealdb::RecordId>,
        slug: String,
        path: String,
        relative_path: Option<String>,
        name: String,
        is_worktree: bool,
        created_at: Option<String>,
        updated_at: Option<String>,
    }

    let path_owned = path.to_string();
    let mut response = db
        .query("SELECT * FROM project WHERE path = $path LIMIT 1;")
        .bind(("path", path_owned))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to get project: {}", e)))?;

    let rows: Vec<DbProject> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse project: {}", e)))?;

    Ok(rows.into_iter().next().map(|row| Project {
        id: row.id.map(|r| r.to_string()),
        repo_id: row.repo.map(|r| r.to_string()),
        slug: row.slug,
        path: row.path,
        relative_path: row.relative_path,
        name: row.name,
        is_worktree: row.is_worktree,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }))
}

pub async fn list_projects(db: &Surreal<Db>, repo_id: Option<String>) -> napi::Result<Vec<Project>> {
    #[derive(Debug, Deserialize)]
    struct DbProject {
        id: Option<surrealdb::RecordId>,
        repo: Option<surrealdb::RecordId>,
        slug: String,
        path: String,
        relative_path: Option<String>,
        name: String,
        is_worktree: bool,
        created_at: Option<String>,
        updated_at: Option<String>,
    }

    let query = if repo_id.is_some() {
        "SELECT * FROM project WHERE repo = $repo ORDER BY name ASC;"
    } else {
        "SELECT * FROM project ORDER BY name ASC;"
    };

    let repo_ref = repo_id.map(|id| format!("repo:{}", id));
    let mut response = db
        .query(query)
        .bind(("repo", repo_ref))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to list projects: {}", e)))?;

    let rows: Vec<DbProject> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse projects: {}", e)))?;

    Ok(rows.into_iter().map(|row| Project {
        id: row.id.map(|r| r.to_string()),
        repo_id: row.repo.map(|r| r.to_string()),
        slug: row.slug,
        path: row.path,
        relative_path: row.relative_path,
        name: row.name,
        is_worktree: row.is_worktree,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }).collect())
}

// ============================================================================
// Session Operations
// ============================================================================

pub async fn upsert_session(db: &Surreal<Db>, input: SessionInput) -> napi::Result<Session> {
    #[derive(Debug, Deserialize)]
    struct DbSession {
        id: Option<surrealdb::RecordId>,
        project: Option<surrealdb::RecordId>,
        session_id: String,
        started_at: Option<String>,
        ended_at: Option<String>,
        status: String,
        transcript_path: Option<String>,
        updated_at: Option<String>,
    }

    let session_id = input.session_id.clone();
    let status = input.status.clone().unwrap_or_else(|| "active".to_string());
    let transcript_path = input.transcript_path.clone();

    // Use session_id as the record ID for upsert
    let mut response = db
        .query(
            r#"
            UPSERT type::thing("session", $session_id) CONTENT {
                project: type::thing("project", $project_slug),
                session_id: $session_id,
                status: $status,
                transcript_path: $transcript_path,
                updated_at: time::now()
            };
            "#,
        )
        // Extract just the slug from project reference
        .bind(("project_slug", input.project_id.as_ref().map(|id| {
            id.strip_prefix("project:").unwrap_or(id).trim_matches(|c| c == '⟨' || c == '⟩').to_string()
        })))
        .bind(("session_id", session_id))
        .bind(("status", status))
        .bind(("transcript_path", transcript_path))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to upsert session: {}", e)))?;

    let rows: Vec<DbSession> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse session: {}", e)))?;

    let row = rows.into_iter().next().ok_or_else(|| {
        napi::Error::from_reason("No session returned from upsert".to_string())
    })?;

    Ok(Session {
        id: row.id.map(|r| r.to_string()),
        project_id: row.project.map(|r| r.to_string()),
        session_id: row.session_id,
        started_at: row.started_at,
        ended_at: row.ended_at,
        status: row.status,
        transcript_path: row.transcript_path,
        updated_at: row.updated_at,
    })
}

pub async fn end_session(db: &Surreal<Db>, session_id: &str) -> napi::Result<bool> {
    let session_id_owned = session_id.to_string();
    db.query(
        r#"
        UPDATE session SET status = 'completed', ended_at = time::now(), updated_at = time::now()
        WHERE session_id = $session_id;
        "#,
    )
    .bind(("session_id", session_id_owned))
    .await
    .map_err(|e| napi::Error::from_reason(format!("Failed to end session: {}", e)))?;

    Ok(true)
}

pub async fn get_session(db: &Surreal<Db>, session_id: &str) -> napi::Result<Option<Session>> {
    #[derive(Debug, Deserialize)]
    struct DbSession {
        id: Option<surrealdb::RecordId>,
        project: Option<surrealdb::RecordId>,
        session_id: String,
        started_at: Option<String>,
        ended_at: Option<String>,
        status: String,
        transcript_path: Option<String>,
        updated_at: Option<String>,
    }

    let session_id_owned = session_id.to_string();
    let mut response = db
        .query("SELECT * FROM session WHERE session_id = $session_id LIMIT 1;")
        .bind(("session_id", session_id_owned))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to get session: {}", e)))?;

    let rows: Vec<DbSession> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse session: {}", e)))?;

    Ok(rows.into_iter().next().map(|row| Session {
        id: row.id.map(|r| r.to_string()),
        project_id: row.project.map(|r| r.to_string()),
        session_id: row.session_id,
        started_at: row.started_at,
        ended_at: row.ended_at,
        status: row.status,
        transcript_path: row.transcript_path,
        updated_at: row.updated_at,
    }))
}

pub async fn list_sessions(
    db: &Surreal<Db>,
    project_id: Option<String>,
    status: Option<String>,
    limit: Option<u32>,
) -> napi::Result<Vec<Session>> {
    #[derive(Debug, Deserialize)]
    struct DbSession {
        id: Option<surrealdb::RecordId>,
        project: Option<surrealdb::RecordId>,
        session_id: String,
        started_at: Option<String>,
        ended_at: Option<String>,
        status: String,
        transcript_path: Option<String>,
        updated_at: Option<String>,
    }

    let limit_val = limit.unwrap_or(100);
    let project_ref = project_id.map(|id| format!("project:{}", id));

    let mut response = db
        .query(
            r#"
            SELECT * FROM session
            WHERE ($project IS NONE OR project = $project)
              AND ($status IS NONE OR status = $status)
            ORDER BY started_at DESC
            LIMIT $limit;
            "#,
        )
        .bind(("project", project_ref))
        .bind(("status", status))
        .bind(("limit", limit_val))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to list sessions: {}", e)))?;

    let rows: Vec<DbSession> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse sessions: {}", e)))?;

    Ok(rows.into_iter().map(|row| Session {
        id: row.id.map(|r| r.to_string()),
        project_id: row.project.map(|r| r.to_string()),
        session_id: row.session_id,
        started_at: row.started_at,
        ended_at: row.ended_at,
        status: row.status,
        transcript_path: row.transcript_path,
        updated_at: row.updated_at,
    }).collect())
}

// ============================================================================
// Task Operations
// ============================================================================

pub async fn create_task(db: &Surreal<Db>, input: TaskInput) -> napi::Result<Task> {
    #[derive(Debug, Deserialize)]
    struct DbTask {
        id: Option<surrealdb::RecordId>,
        session: Option<surrealdb::RecordId>,
        task_id: String,
        description: String,
        task_type: String,
        outcome: Option<String>,
        confidence: Option<f64>,
        notes: Option<String>,
        files_modified: Option<Vec<String>>,
        tests_added: Option<i32>,
        started_at: Option<String>,
        completed_at: Option<String>,
    }

    let session_ref = input.session_id.as_ref().map(|id| format!("session:{}", id));
    let task_id = input.task_id.clone();
    let description = input.description.clone();
    let task_type = input.task_type.clone();

    let mut response = db
        .query(
            r#"
            CREATE task SET
                session = $session,
                task_id = $task_id,
                description = $description,
                task_type = $task_type,
                started_at = time::now();
            "#,
        )
        .bind(("session", session_ref))
        .bind(("task_id", task_id))
        .bind(("description", description))
        .bind(("task_type", task_type))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to create task: {}", e)))?;

    let rows: Vec<DbTask> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse task: {}", e)))?;

    let row = rows.into_iter().next().ok_or_else(|| {
        napi::Error::from_reason("No task returned from create".to_string())
    })?;

    Ok(Task {
        id: row.id.map(|r| r.to_string()),
        session_id: row.session.map(|r| r.to_string()),
        task_id: row.task_id,
        description: row.description,
        task_type: row.task_type,
        outcome: row.outcome,
        confidence: row.confidence,
        notes: row.notes,
        files_modified: row.files_modified,
        tests_added: row.tests_added,
        started_at: row.started_at,
        completed_at: row.completed_at,
    })
}

pub async fn complete_task(db: &Surreal<Db>, completion: TaskCompletion) -> napi::Result<Task> {
    #[derive(Debug, Deserialize)]
    struct DbTask {
        id: Option<surrealdb::RecordId>,
        session: Option<surrealdb::RecordId>,
        task_id: String,
        description: String,
        task_type: String,
        outcome: Option<String>,
        confidence: Option<f64>,
        notes: Option<String>,
        files_modified: Option<Vec<String>>,
        tests_added: Option<i32>,
        started_at: Option<String>,
        completed_at: Option<String>,
    }

    let task_id = completion.task_id.clone();
    let outcome = completion.outcome.clone();
    let confidence = completion.confidence;
    let notes = completion.notes.clone();
    let files_modified = completion.files_modified.clone();
    let tests_added = completion.tests_added;

    let mut response = db
        .query(
            r#"
            UPDATE task SET
                outcome = $outcome,
                confidence = $confidence,
                notes = $notes,
                files_modified = $files_modified,
                tests_added = $tests_added,
                completed_at = time::now()
            WHERE task_id = $task_id;
            "#,
        )
        .bind(("task_id", task_id))
        .bind(("outcome", outcome))
        .bind(("confidence", confidence))
        .bind(("notes", notes))
        .bind(("files_modified", files_modified))
        .bind(("tests_added", tests_added))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to complete task: {}", e)))?;

    let rows: Vec<DbTask> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse task: {}", e)))?;

    let row = rows.into_iter().next().ok_or_else(|| {
        napi::Error::from_reason("No task found with that ID".to_string())
    })?;

    Ok(Task {
        id: row.id.map(|r| r.to_string()),
        session_id: row.session.map(|r| r.to_string()),
        task_id: row.task_id,
        description: row.description,
        task_type: row.task_type,
        outcome: row.outcome,
        confidence: row.confidence,
        notes: row.notes,
        files_modified: row.files_modified,
        tests_added: row.tests_added,
        started_at: row.started_at,
        completed_at: row.completed_at,
    })
}

pub async fn fail_task(db: &Surreal<Db>, failure: TaskFailure) -> napi::Result<Task> {
    #[derive(Debug, Deserialize)]
    struct DbTask {
        id: Option<surrealdb::RecordId>,
        session: Option<surrealdb::RecordId>,
        task_id: String,
        description: String,
        task_type: String,
        outcome: Option<String>,
        confidence: Option<f64>,
        notes: Option<String>,
        files_modified: Option<Vec<String>>,
        tests_added: Option<i32>,
        started_at: Option<String>,
        completed_at: Option<String>,
    }

    let task_id = failure.task_id.clone();
    let confidence = failure.confidence;
    let notes = format!(
        "Failure reason: {}\n{}{}",
        failure.reason,
        failure.notes.as_deref().map(|n| format!("\nNotes: {}", n)).unwrap_or_default(),
        failure.attempted_solutions.as_ref()
            .map(|sols| format!("\nAttempted solutions:\n- {}", sols.join("\n- ")))
            .unwrap_or_default()
    );

    let mut response = db
        .query(
            r#"
            UPDATE task SET
                outcome = 'failure',
                confidence = $confidence,
                notes = $notes,
                completed_at = time::now()
            WHERE task_id = $task_id;
            "#,
        )
        .bind(("task_id", task_id))
        .bind(("confidence", confidence))
        .bind(("notes", notes))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to fail task: {}", e)))?;

    let rows: Vec<DbTask> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse task: {}", e)))?;

    let row = rows.into_iter().next().ok_or_else(|| {
        napi::Error::from_reason("No task found with that ID".to_string())
    })?;

    Ok(Task {
        id: row.id.map(|r| r.to_string()),
        session_id: row.session.map(|r| r.to_string()),
        task_id: row.task_id,
        description: row.description,
        task_type: row.task_type,
        outcome: row.outcome,
        confidence: row.confidence,
        notes: row.notes,
        files_modified: row.files_modified,
        tests_added: row.tests_added,
        started_at: row.started_at,
        completed_at: row.completed_at,
    })
}

pub async fn get_task(db: &Surreal<Db>, task_id: &str) -> napi::Result<Option<Task>> {
    #[derive(Debug, Deserialize)]
    struct DbTask {
        id: Option<surrealdb::RecordId>,
        session: Option<surrealdb::RecordId>,
        task_id: String,
        description: String,
        task_type: String,
        outcome: Option<String>,
        confidence: Option<f64>,
        notes: Option<String>,
        files_modified: Option<Vec<String>>,
        tests_added: Option<i32>,
        started_at: Option<String>,
        completed_at: Option<String>,
    }

    let task_id_owned = task_id.to_string();
    let mut response = db
        .query("SELECT * FROM task WHERE task_id = $task_id LIMIT 1;")
        .bind(("task_id", task_id_owned))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to get task: {}", e)))?;

    let rows: Vec<DbTask> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse task: {}", e)))?;

    Ok(rows.into_iter().next().map(|row| Task {
        id: row.id.map(|r| r.to_string()),
        session_id: row.session.map(|r| r.to_string()),
        task_id: row.task_id,
        description: row.description,
        task_type: row.task_type,
        outcome: row.outcome,
        confidence: row.confidence,
        notes: row.notes,
        files_modified: row.files_modified,
        tests_added: row.tests_added,
        started_at: row.started_at,
        completed_at: row.completed_at,
    }))
}

pub async fn query_task_metrics(
    db: &Surreal<Db>,
    task_type: Option<String>,
    outcome: Option<String>,
    period: Option<String>,
) -> napi::Result<TaskMetrics> {
    #[derive(Debug, Deserialize)]
    struct MetricsRow {
        total: i64,
        successful: i64,
        partial: i64,
        failed: i64,
        avg_conf: Option<f64>,
    }

    // Calculate time filter based on period
    let time_filter = match period.as_deref() {
        Some("day") => "AND started_at > time::now() - 1d",
        Some("week") => "AND started_at > time::now() - 1w",
        Some("month") => "AND started_at > time::now() - 4w",
        _ => "",
    };

    let query = format!(
        r#"
        SELECT
            count() AS total,
            count(outcome = 'success') AS successful,
            count(outcome = 'partial') AS partial,
            count(outcome = 'failure') AS failed,
            math::mean(confidence) AS avg_conf
        FROM task
        WHERE ($task_type IS NONE OR task_type = $task_type)
          AND ($outcome IS NONE OR outcome = $outcome)
          {}
        GROUP ALL;
        "#,
        time_filter
    );

    let mut response = db
        .query(&query)
        .bind(("task_type", task_type))
        .bind(("outcome", outcome))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to query metrics: {}", e)))?;

    let rows: Vec<MetricsRow> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse metrics: {}", e)))?;

    let row = rows.into_iter().next().unwrap_or(MetricsRow {
        total: 0,
        successful: 0,
        partial: 0,
        failed: 0,
        avg_conf: None,
    });

    // Get tasks by type breakdown
    #[derive(Debug, Deserialize)]
    struct TypeCount {
        task_type: String,
        count: i64,
    }

    let mut type_response = db
        .query("SELECT task_type, count() AS count FROM task GROUP BY task_type;")
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to query task types: {}", e)))?;

    let type_rows: Vec<TypeCount> = type_response.take(0).unwrap_or_default();

    let tasks_by_type: std::collections::HashMap<String, i64> = type_rows
        .into_iter()
        .map(|r| (r.task_type, r.count))
        .collect();

    Ok(TaskMetrics {
        total_tasks: row.total,
        successful_tasks: row.successful,
        partial_tasks: row.partial,
        failed_tasks: row.failed,
        avg_confidence: row.avg_conf.unwrap_or(0.0),
        tasks_by_type: serde_json::to_string(&tasks_by_type).unwrap_or_default(),
    })
}

// ============================================================================
// Hook Cache Operations
// ============================================================================

pub async fn set_hook_cache(db: &Surreal<Db>, input: HookCacheInput) -> napi::Result<bool> {
    let project_ref = input.project_id.as_ref().map(|id| format!("project:{}", id));
    let cache_key = input.cache_key.clone();
    let file_hash = input.file_hash.clone();
    let result = serde_json::from_str::<serde_json::Value>(&input.result).unwrap_or_default();
    let expires_at = input.ttl_seconds.map(|ttl| format!("time::now() + {}s", ttl));

    // Use cache_key as the record ID for upsert
    db.query(
        r#"
        UPSERT type::thing("hook_cache", $cache_key) CONTENT {
            project: $project,
            cache_key: $cache_key,
            file_hash: $file_hash,
            result: $result,
            cached_at: time::now(),
            expires_at: $expires_at
        };
        "#,
    )
    .bind(("project", project_ref))
    .bind(("cache_key", cache_key))
    .bind(("file_hash", file_hash))
    .bind(("result", result))
    .bind(("expires_at", expires_at))
    .await
    .map_err(|e| napi::Error::from_reason(format!("Failed to set hook cache: {}", e)))?;

    Ok(true)
}

pub async fn get_hook_cache(db: &Surreal<Db>, cache_key: &str) -> napi::Result<Option<HookCacheEntry>> {
    #[derive(Debug, Deserialize)]
    struct DbCache {
        id: Option<surrealdb::RecordId>,
        project: Option<surrealdb::RecordId>,
        cache_key: String,
        file_hash: String,
        result: serde_json::Value,
        cached_at: Option<String>,
        expires_at: Option<String>,
    }

    let cache_key_owned = cache_key.to_string();
    let mut response = db
        .query(
            r#"
            SELECT * FROM hook_cache
            WHERE cache_key = $cache_key
              AND (expires_at IS NONE OR expires_at > time::now())
            LIMIT 1;
            "#,
        )
        .bind(("cache_key", cache_key_owned))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to get hook cache: {}", e)))?;

    let rows: Vec<DbCache> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse cache: {}", e)))?;

    Ok(rows.into_iter().next().map(|row| HookCacheEntry {
        id: row.id.map(|r| r.to_string()),
        project_id: row.project.map(|r| r.to_string()),
        cache_key: row.cache_key,
        file_hash: row.file_hash,
        result: row.result.to_string(),
        cached_at: row.cached_at,
        expires_at: row.expires_at,
    }))
}

pub async fn invalidate_hook_cache(db: &Surreal<Db>, cache_key: &str) -> napi::Result<bool> {
    let cache_key_owned = cache_key.to_string();
    db.query("DELETE FROM hook_cache WHERE cache_key = $cache_key;")
        .bind(("cache_key", cache_key_owned))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to invalidate cache: {}", e)))?;

    Ok(true)
}

pub async fn cleanup_expired_cache(db: &Surreal<Db>) -> napi::Result<u32> {
    #[derive(Debug, Deserialize)]
    struct CountResult {
        count: u32,
    }

    let mut response = db
        .query(
            r#"
            LET $expired = SELECT count() AS count FROM hook_cache WHERE expires_at < time::now();
            DELETE FROM hook_cache WHERE expires_at < time::now();
            RETURN $expired;
            "#,
        )
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to cleanup cache: {}", e)))?;

    let rows: Vec<CountResult> = response.take(0).unwrap_or_default();
    Ok(rows.into_iter().next().map(|r| r.count).unwrap_or(0))
}

// ============================================================================
// Marketplace Cache Operations
// ============================================================================

pub async fn upsert_marketplace_plugin(db: &Surreal<Db>, input: MarketplacePluginInput) -> napi::Result<bool> {
    let plugin_id = input.plugin_id.clone();
    let name = input.name.clone();
    let description = input.description.clone();
    let version = input.version.clone();
    let category = input.category.clone();
    let metadata = input.metadata.as_ref().and_then(|m| serde_json::from_str::<serde_json::Value>(m).ok());

    // Use plugin_id as the record ID for upsert
    db.query(
        r#"
        UPSERT type::thing("marketplace_plugin", $plugin_id) CONTENT {
            plugin_id: $plugin_id,
            name: $name,
            description: $description,
            version: $version,
            category: $category,
            metadata: $metadata,
            fetched_at: time::now()
        };
        "#,
    )
    .bind(("plugin_id", plugin_id))
    .bind(("name", name))
    .bind(("description", description))
    .bind(("version", version))
    .bind(("category", category))
    .bind(("metadata", metadata))
    .await
    .map_err(|e| napi::Error::from_reason(format!("Failed to upsert marketplace plugin: {}", e)))?;

    Ok(true)
}

pub async fn get_marketplace_plugin(db: &Surreal<Db>, plugin_id: &str) -> napi::Result<Option<MarketplacePlugin>> {
    #[derive(Debug, Deserialize)]
    struct DbPlugin {
        id: Option<surrealdb::RecordId>,
        plugin_id: String,
        name: String,
        description: Option<String>,
        version: Option<String>,
        category: Option<String>,
        metadata: Option<serde_json::Value>,
        fetched_at: Option<String>,
    }

    let plugin_id_owned = plugin_id.to_string();
    let mut response = db
        .query("SELECT * FROM marketplace_plugin WHERE plugin_id = $plugin_id LIMIT 1;")
        .bind(("plugin_id", plugin_id_owned))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to get plugin: {}", e)))?;

    let rows: Vec<DbPlugin> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse plugin: {}", e)))?;

    Ok(rows.into_iter().next().map(|row| MarketplacePlugin {
        id: row.id.map(|r| r.to_string()),
        plugin_id: row.plugin_id,
        name: row.name,
        description: row.description,
        version: row.version,
        category: row.category,
        metadata: row.metadata.map(|m| m.to_string()),
        fetched_at: row.fetched_at,
    }))
}

pub async fn list_marketplace_plugins(db: &Surreal<Db>, category: Option<String>) -> napi::Result<Vec<MarketplacePlugin>> {
    #[derive(Debug, Deserialize)]
    struct DbPlugin {
        id: Option<surrealdb::RecordId>,
        plugin_id: String,
        name: String,
        description: Option<String>,
        version: Option<String>,
        category: Option<String>,
        metadata: Option<serde_json::Value>,
        fetched_at: Option<String>,
    }

    let mut response = db
        .query(
            r#"
            SELECT * FROM marketplace_plugin
            WHERE ($category IS NONE OR category = $category)
            ORDER BY name ASC;
            "#,
        )
        .bind(("category", category))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to list plugins: {}", e)))?;

    let rows: Vec<DbPlugin> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse plugins: {}", e)))?;

    Ok(rows.into_iter().map(|row| MarketplacePlugin {
        id: row.id.map(|r| r.to_string()),
        plugin_id: row.plugin_id,
        name: row.name,
        description: row.description,
        version: row.version,
        category: row.category,
        metadata: row.metadata.map(|m| m.to_string()),
        fetched_at: row.fetched_at,
    }).collect())
}

// ============================================================================
// Message Operations (Session Indexing)
// ============================================================================

/// Insert a batch of messages for a session
pub async fn insert_messages_batch(db: &Surreal<Db>, session_id: &str, messages: Vec<MessageInput>) -> napi::Result<u32> {
    let session_ref = format!("session:{}", session_id);
    let mut count = 0u32;

    for msg in messages {
        let tool_input = msg.tool_input.as_ref().and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok());

        db.query(
            r#"
            INSERT INTO message {
                session: $session,
                message_id: $message_id,
                message_type: $message_type,
                role: $role,
                content: $content,
                tool_name: $tool_name,
                tool_input: $tool_input,
                tool_result: $tool_result,
                timestamp: $timestamp,
                line_number: $line_number
            };
            "#,
        )
        .bind(("session", session_ref.clone()))
        .bind(("message_id", msg.message_id))
        .bind(("message_type", msg.message_type))
        .bind(("role", msg.role))
        .bind(("content", msg.content))
        .bind(("tool_name", msg.tool_name))
        .bind(("tool_input", tool_input))
        .bind(("tool_result", msg.tool_result))
        .bind(("timestamp", msg.timestamp))
        .bind(("line_number", msg.line_number))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to insert message: {}", e)))?;

        count += 1;
    }

    Ok(count)
}

/// Get a message by ID
pub async fn get_message(db: &Surreal<Db>, message_id: &str) -> napi::Result<Option<Message>> {
    #[derive(Debug, Deserialize)]
    struct DbMessage {
        id: Option<surrealdb::RecordId>,
        session: surrealdb::RecordId,
        message_id: String,
        message_type: String,
        role: Option<String>,
        content: Option<String>,
        tool_name: Option<String>,
        tool_input: Option<serde_json::Value>,
        tool_result: Option<String>,
        timestamp: String,
        line_number: i32,
        indexed_at: Option<String>,
    }

    let message_id_owned = message_id.to_string();
    let mut response = db
        .query("SELECT * FROM message WHERE message_id = $message_id LIMIT 1;")
        .bind(("message_id", message_id_owned))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to get message: {}", e)))?;

    let rows: Vec<DbMessage> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse message: {}", e)))?;

    Ok(rows.into_iter().next().map(|row| Message {
        id: row.id.map(|r| r.to_string()),
        session_id: row.session.to_string(),
        message_id: row.message_id,
        message_type: row.message_type,
        role: row.role,
        content: row.content,
        tool_name: row.tool_name,
        tool_input: row.tool_input.map(|v| v.to_string()),
        tool_result: row.tool_result,
        timestamp: row.timestamp,
        line_number: row.line_number,
        indexed_at: row.indexed_at,
    }))
}

/// List messages for a session
pub async fn list_session_messages(
    db: &Surreal<Db>,
    session_id: &str,
    message_type: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> napi::Result<Vec<Message>> {
    #[derive(Debug, Deserialize)]
    struct DbMessage {
        id: Option<surrealdb::RecordId>,
        session: surrealdb::RecordId,
        message_id: String,
        message_type: String,
        role: Option<String>,
        content: Option<String>,
        tool_name: Option<String>,
        tool_input: Option<serde_json::Value>,
        tool_result: Option<String>,
        timestamp: String,
        line_number: i32,
        indexed_at: Option<String>,
    }

    let session_ref = format!("session:{}", session_id);
    let limit_val = limit.unwrap_or(1000);
    let offset_val = offset.unwrap_or(0);

    let mut response = db
        .query(
            r#"
            SELECT * FROM message
            WHERE session = $session
              AND ($message_type IS NONE OR message_type = $message_type)
            ORDER BY line_number ASC
            LIMIT $limit
            START $offset;
            "#,
        )
        .bind(("session", session_ref))
        .bind(("message_type", message_type))
        .bind(("limit", limit_val))
        .bind(("offset", offset_val))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to list messages: {}", e)))?;

    let rows: Vec<DbMessage> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse messages: {}", e)))?;

    Ok(rows.into_iter().map(|row| Message {
        id: row.id.map(|r| r.to_string()),
        session_id: row.session.to_string(),
        message_id: row.message_id,
        message_type: row.message_type,
        role: row.role,
        content: row.content,
        tool_name: row.tool_name,
        tool_input: row.tool_input.map(|v| v.to_string()),
        tool_result: row.tool_result,
        timestamp: row.timestamp,
        line_number: row.line_number,
        indexed_at: row.indexed_at,
    }).collect())
}

/// Get message count for a session
pub async fn get_message_count(db: &Surreal<Db>, session_id: &str) -> napi::Result<u32> {
    #[derive(Debug, Deserialize)]
    struct CountResult {
        count: u32,
    }

    let session_ref = format!("session:{}", session_id);
    let mut response = db
        .query("SELECT count() AS count FROM message WHERE session = $session GROUP ALL;")
        .bind(("session", session_ref))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to count messages: {}", e)))?;

    let rows: Vec<CountResult> = response.take(0).unwrap_or_default();
    Ok(rows.into_iter().next().map(|r| r.count).unwrap_or(0))
}

/// Get the highest line number indexed for a session (for incremental indexing)
pub async fn get_last_indexed_line(db: &Surreal<Db>, session_id: &str) -> napi::Result<i32> {
    #[derive(Debug, Deserialize)]
    struct LineResult {
        max_line: Option<i32>,
    }

    let session_ref = format!("session:{}", session_id);
    let mut response = db
        .query("SELECT math::max(line_number) AS max_line FROM message WHERE session = $session GROUP ALL;")
        .bind(("session", session_ref))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to get last line: {}", e)))?;

    let rows: Vec<LineResult> = response.take(0).unwrap_or_default();
    Ok(rows.into_iter().next().and_then(|r| r.max_line).unwrap_or(0))
}

/// Search messages by content using FTS
pub async fn search_messages(
    db: &Surreal<Db>,
    query: &str,
    session_id: Option<String>,
    limit: Option<u32>,
) -> napi::Result<Vec<Message>> {
    #[derive(Debug, Deserialize)]
    struct DbMessage {
        id: Option<surrealdb::RecordId>,
        session: surrealdb::RecordId,
        message_id: String,
        message_type: String,
        role: Option<String>,
        content: Option<String>,
        tool_name: Option<String>,
        tool_input: Option<serde_json::Value>,
        tool_result: Option<String>,
        timestamp: String,
        line_number: i32,
        indexed_at: Option<String>,
    }

    let session_ref = session_id.map(|id| format!("session:{}", id));
    let limit_val = limit.unwrap_or(50);
    let query_owned = query.to_string();

    let mut response = db
        .query(
            r#"
            SELECT * FROM message
            WHERE content @@ $query
              AND ($session IS NONE OR session = $session)
            ORDER BY timestamp DESC
            LIMIT $limit;
            "#,
        )
        .bind(("query", query_owned))
        .bind(("session", session_ref))
        .bind(("limit", limit_val))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to search messages: {}", e)))?;

    let rows: Vec<DbMessage> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse search results: {}", e)))?;

    Ok(rows.into_iter().map(|row| Message {
        id: row.id.map(|r| r.to_string()),
        session_id: row.session.to_string(),
        message_id: row.message_id,
        message_type: row.message_type,
        role: row.role,
        content: row.content,
        tool_name: row.tool_name,
        tool_input: row.tool_input.map(|v| v.to_string()),
        tool_result: row.tool_result,
        timestamp: row.timestamp,
        line_number: row.line_number,
        indexed_at: row.indexed_at,
    }).collect())
}
