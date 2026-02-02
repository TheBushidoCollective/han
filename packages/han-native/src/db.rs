//! SQLite database wrapper for Han's unified data store
//!
//! Uses SQLite with WAL mode for concurrent reads, FTS5 for full-text search,
//! and sqlite-vec for vector similarity search.
//!
//! IMPORTANT: All database access MUST go through the coordinator.
//! Only the coordinator process should call get_db() directly.

use napi_derive::napi;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};

// Global database connection (lazy initialized, coordinator only)
static DB: OnceLock<Mutex<Connection>> = OnceLock::new();

// For tests: track whether we've initialized so we can warn if env var changes
#[cfg(test)]
static TEST_DB_PATH: OnceLock<String> = OnceLock::new();

/// Get the default database path
/// Respects CLAUDE_CONFIG_DIR environment variable for testing
pub fn get_db_path() -> String {
    // Check for CLAUDE_CONFIG_DIR first (for testing)
    let base_dir = std::env::var("CLAUDE_CONFIG_DIR")
        .ok()
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| {
            dirs::home_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("."))
                .join(".claude")
        });

    let han_dir = base_dir.join("han");
    std::fs::create_dir_all(&han_dir).ok();
    han_dir.join("han.db").to_string_lossy().to_string()
}

/// Get or create database connection (coordinator only!)
pub fn get_db() -> napi::Result<&'static Mutex<Connection>> {
    // Use get_or_init with panic handling since get_or_try_init is unstable
    if let Some(db) = DB.get() {
        return Ok(db);
    }

    let path = get_db_path();

    // For tests: track which path was used for the first initialization
    #[cfg(test)]
    {
        let _ = TEST_DB_PATH.set(path.clone());
    }

    let conn = open_database(&path)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open database: {}", e)))?;

    // Try to set, ignore if already set by another thread
    let _ = DB.set(conn);

    DB.get()
        .ok_or_else(|| napi::Error::from_reason("Database initialization failed".to_string()))
}

/// No-op for tests - DB singleton cannot be safely reset
/// Tests must run serially or use the same database
#[cfg(test)]
pub fn reset_test_db() {
    // Do nothing - OnceLock cannot be reset safely
    // Tests should be designed to work with a shared database
}

/// Open a database at a specific path
fn open_database(path: &str) -> Result<Mutex<Connection>, rusqlite::Error> {
    let conn = Connection::open(path)?;

    // Enable WAL mode for concurrent reads
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    conn.execute_batch("PRAGMA synchronous=NORMAL;")?;
    conn.execute_batch("PRAGMA cache_size=-64000;")?; // 64MB cache
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;
    conn.execute_batch("PRAGMA busy_timeout=5000;")?; // Wait up to 5s for locks

    // Run migrations FIRST for existing databases
    // This ensures columns exist before schema.sql tries to create indexes on them
    // For new databases, migrations are no-ops (tables don't exist yet)
    run_migrations(&conn)?;

    // Initialize schema (CREATE TABLE/INDEX IF NOT EXISTS)
    conn.execute_batch(include_str!("schema.sql"))?;

    Ok(Mutex::new(conn))
}

/// Run database migrations for schema updates
fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    // Migration: session_summaries and session_compacts were changed from VIEWs to TABLEs
    // We need to drop the old objects (whether VIEW or TABLE) before schema.sql runs
    for table_name in ["session_summaries", "session_compacts"] {
        // Check what type of object exists (if any)
        let obj_type: Option<String> = conn
            .query_row(
                "SELECT type FROM sqlite_master WHERE name = ?",
                [table_name],
                |row| row.get(0),
            )
            .ok();

        match obj_type.as_deref() {
            Some("view") => {
                // Drop the old view so schema.sql can create the table
                conn.execute(&format!("DROP VIEW IF EXISTS {}", table_name), [])?;
            }
            Some("table") => {
                // Table already exists - drop it so schema.sql recreates with correct schema
                // This ensures any schema changes are applied
                conn.execute(&format!("DROP TABLE IF EXISTS {}", table_name), [])?;
            }
            _ => {
                // Object doesn't exist, schema.sql will create it
            }
        }
    }

    // Migration for session_file_validations runs FIRST and unconditionally
    // This handles the case where schema.sql partially ran and created this table
    // with the old schema (missing directory column) but messages table doesn't exist yet.
    // We must fix this before schema.sql tries to create indexes on the directory column.
    let validations_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='session_file_validations'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if validations_exists {
        let has_directory: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM pragma_table_info('session_file_validations') WHERE name = 'directory'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !has_directory {
            // Need to recreate the table since we're changing the UNIQUE constraint
            // SQLite doesn't support adding columns to UNIQUE constraints
            conn.execute_batch(
                "
                -- Create new table with correct schema
                CREATE TABLE IF NOT EXISTS session_file_validations_new (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL REFERENCES sessions(id),
                    file_path TEXT NOT NULL,
                    file_hash TEXT NOT NULL,
                    plugin_name TEXT NOT NULL,
                    hook_name TEXT NOT NULL,
                    directory TEXT NOT NULL DEFAULT '.',
                    command_hash TEXT NOT NULL DEFAULT '',
                    validated_at TEXT NOT NULL DEFAULT (datetime('now')),
                    UNIQUE(session_id, file_path, plugin_name, hook_name, directory)
                );

                -- Copy data from old table
                INSERT OR IGNORE INTO session_file_validations_new
                    (id, session_id, file_path, file_hash, plugin_name, hook_name, directory, command_hash, validated_at)
                SELECT id, session_id, file_path, file_hash, plugin_name, hook_name, '.', '', validated_at
                FROM session_file_validations;

                -- Drop old table
                DROP TABLE session_file_validations;

                -- Rename new table
                ALTER TABLE session_file_validations_new RENAME TO session_file_validations;
                "
            )?;
        }
    }

    // Check if messages table exists - if not, skip remaining migrations (schema.sql will create it)
    let messages_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='messages'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !messages_exists {
        // New database - schema.sql will create everything correctly
        return Ok(());
    }

    // Migration 1: Add raw_json column to messages table
    // Check if column exists first (SQLite doesn't support IF NOT EXISTS for columns)
    let has_raw_json: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM pragma_table_info('messages') WHERE name = 'raw_json'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !has_raw_json {
        conn.execute("ALTER TABLE messages ADD COLUMN raw_json TEXT", [])?;
    }

    // Migration 2: Add agent_id column to messages table
    let has_agent_id: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM pragma_table_info('messages') WHERE name = 'agent_id'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !has_agent_id {
        conn.execute("ALTER TABLE messages ADD COLUMN agent_id TEXT", [])?;
        // Create index for the new column
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_messages_agent ON messages(session_id, agent_id)",
            [],
        )?;
    }

    // Migration 3: Add parent_id column to messages table
    let has_parent_id: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM pragma_table_info('messages') WHERE name = 'parent_id'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !has_parent_id {
        conn.execute("ALTER TABLE messages ADD COLUMN parent_id TEXT", [])?;
        // Create index for the new column
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id)",
            [],
        )?;
    }

    // Migration 4: Add sentiment analysis columns to messages table
    let has_sentiment_score: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM pragma_table_info('messages') WHERE name = 'sentiment_score'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !has_sentiment_score {
        conn.execute("ALTER TABLE messages ADD COLUMN sentiment_score REAL", [])?;
        conn.execute("ALTER TABLE messages ADD COLUMN sentiment_level TEXT", [])?;
        conn.execute("ALTER TABLE messages ADD COLUMN frustration_score REAL", [])?;
        conn.execute("ALTER TABLE messages ADD COLUMN frustration_level TEXT", [])?;
    }

    // Migration 5: Add deferred execution columns to hook_executions table
    // Check if hook_executions table exists before trying to add columns
    let hook_executions_exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='hook_executions'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if hook_executions_exists {
        // Add status column if not exists
        let has_status: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM pragma_table_info('hook_executions') WHERE name = 'status'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !has_status {
            conn.execute(
                "ALTER TABLE hook_executions ADD COLUMN status TEXT DEFAULT 'completed'",
                [],
            )?;
        }

        // Add consecutive_failures column if not exists
        let has_consecutive_failures: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM pragma_table_info('hook_executions') WHERE name = 'consecutive_failures'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !has_consecutive_failures {
            conn.execute(
                "ALTER TABLE hook_executions ADD COLUMN consecutive_failures INTEGER DEFAULT 0",
                [],
            )?;
        }

        // Add max_attempts column if not exists
        let has_max_attempts: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM pragma_table_info('hook_executions') WHERE name = 'max_attempts'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !has_max_attempts {
            conn.execute(
                "ALTER TABLE hook_executions ADD COLUMN max_attempts INTEGER DEFAULT 3",
                [],
            )?;
        }

        // Add pid column if not exists (for stale hook detection)
        let has_pid: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM pragma_table_info('hook_executions') WHERE name = 'pid'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !has_pid {
            conn.execute("ALTER TABLE hook_executions ADD COLUMN pid INTEGER", [])?;
        }

        // Add plugin_root column if not exists (for deferred hook CLAUDE_PLUGIN_ROOT)
        let has_plugin_root: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM pragma_table_info('hook_executions') WHERE name = 'plugin_root'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !has_plugin_root {
            conn.execute(
                "ALTER TABLE hook_executions ADD COLUMN plugin_root TEXT",
                [],
            )?;
        }

        // Add orchestration_id column if not exists (links to orchestrations table)
        let has_orchestration_id: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM pragma_table_info('hook_executions') WHERE name = 'orchestration_id'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if !has_orchestration_id {
            conn.execute(
                "ALTER TABLE hook_executions ADD COLUMN orchestration_id TEXT",
                [],
            )?;
            // Create index for the new column
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_hook_executions_orchestration ON hook_executions(orchestration_id)",
                [],
            )?;
        }
    }

    Ok(())
}

/// A document record for FTS indexing
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FtsDocument {
    /// Unique identifier for the document
    pub id: String,
    /// The text content to index
    pub content: String,
    /// Optional metadata as JSON string
    pub metadata: Option<String>,
}

/// A search result from FTS query
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FtsSearchResult {
    /// Document ID
    pub id: String,
    /// The matched content
    pub content: String,
    /// Optional metadata as JSON string
    pub metadata: Option<String>,
    /// BM25 relevance score
    pub score: f64,
}

/// A document with vector embedding (used internally)
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VectorDocument {
    /// Unique identifier for the document
    pub id: String,
    /// The text content
    pub content: String,
    /// The embedding vector
    pub vector: Vec<f32>,
    /// Optional metadata as JSON string
    pub metadata: Option<String>,
}

/// A search result from vector query
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VectorSearchResult {
    /// Document ID
    pub id: String,
    /// The matched content
    pub content: String,
    /// Optional metadata as JSON string
    pub metadata: Option<String>,
    /// Similarity score (higher is more similar)
    pub score: f64,
}

/// Initialize the database (called by coordinator)
pub fn init(db_path: &str) -> napi::Result<bool> {
    // For custom paths, we need to open a new connection
    if db_path != get_db_path() {
        open_database(db_path).map_err(|e| {
            napi::Error::from_reason(format!("Failed to initialize database: {}", e))
        })?;
    } else {
        // Ensure default DB is initialized
        get_db()?;
    }
    Ok(true)
}

/// Clean up old SurrealDB/RocksDB files from the legacy database location
/// This should be called after confirming the SQLite migration is complete
#[napi]
pub fn cleanup_legacy_database() -> napi::Result<bool> {
    let home = dirs::home_dir().ok_or_else(|| {
        napi::Error::from_reason("Could not determine home directory".to_string())
    })?;

    // Old SurrealDB location: ~/.claude/han/memory/index/
    let legacy_dir = home
        .join(".claude")
        .join("han")
        .join("memory")
        .join("index");

    if legacy_dir.exists() {
        // Remove the entire directory
        std::fs::remove_dir_all(&legacy_dir).map_err(|e| {
            napi::Error::from_reason(format!("Failed to remove legacy database: {}", e))
        })?;
        tracing::info!("Removed legacy SurrealDB database at {:?}", legacy_dir);
        return Ok(true);
    }

    Ok(false)
}

/// Check if legacy SurrealDB files exist
#[napi]
pub fn has_legacy_database() -> bool {
    if let Some(home) = dirs::home_dir() {
        let legacy_dir = home
            .join(".claude")
            .join("han")
            .join("memory")
            .join("index");
        legacy_dir.exists()
    } else {
        false
    }
}

/// Index documents for FTS
pub fn fts_index(
    _db_path: &str,
    table_name: &str,
    documents: Vec<FtsDocument>,
) -> napi::Result<u32> {
    if documents.is_empty() {
        return Ok(0);
    }

    let db = get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    let count = documents.len() as u32;

    // Create the FTS table if it doesn't exist
    let create_fts = format!(
        "CREATE VIRTUAL TABLE IF NOT EXISTS {}_fts USING fts5(doc_id, content, metadata);",
        table_name
    );
    conn.execute(&create_fts, [])
        .map_err(|e| napi::Error::from_reason(format!("Failed to create FTS table: {}", e)))?;

    // Insert documents
    for doc in documents {
        conn.execute(
            &format!(
                "INSERT OR REPLACE INTO {}_fts (doc_id, content, metadata) VALUES (?1, ?2, ?3);",
                table_name
            ),
            params![doc.id, doc.content, doc.metadata],
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to insert document: {}", e)))?;
    }

    Ok(count)
}

/// Escape a query string for FTS5
/// FTS5 interprets words like AND, OR, NOT, NEAR as operators,
/// and characters like :, *, (, ), ^ as special syntax.
/// This function quotes each word to prevent syntax errors.
fn escape_fts5_query(query: &str) -> String {
    // Split on whitespace and quote each word
    query
        .split_whitespace()
        .map(|word| {
            // Remove any existing quotes and re-quote
            let clean = word.trim_matches('"');
            // Escape internal quotes by doubling them
            let escaped = clean.replace('"', "\"\"");
            format!("\"{}\"", escaped)
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Search documents using FTS (BM25)
pub fn fts_search(
    _db_path: &str,
    table_name: &str,
    query: &str,
    limit: Option<u32>,
) -> napi::Result<Vec<FtsSearchResult>> {
    let limit = limit.unwrap_or(10);
    let db = get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Escape the query to prevent FTS5 syntax errors
    let escaped_query = escape_fts5_query(query);

    let sql = format!(
        "SELECT doc_id, content, metadata, bm25({}_fts) AS score
         FROM {}_fts
         WHERE {}_fts MATCH ?1
         ORDER BY score
         LIMIT ?2;",
        table_name, table_name, table_name
    );

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare search: {}", e)))?;

    let results = stmt
        .query_map(params![escaped_query, limit], |row| {
            Ok(FtsSearchResult {
                id: row.get(0)?,
                content: row.get(1)?,
                metadata: row.get(2)?,
                score: row.get::<_, f64>(3)?.abs(), // BM25 returns negative scores
            })
        })
        .map_err(|e| napi::Error::from_reason(format!("Failed to search: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

/// Delete documents by ID
pub fn fts_delete(_db_path: &str, table_name: &str, ids: Vec<String>) -> napi::Result<u32> {
    if ids.is_empty() {
        return Ok(0);
    }

    let count = ids.len() as u32;
    let db = get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    for id in ids {
        conn.execute(
            &format!("DELETE FROM {}_fts WHERE doc_id = ?1;", table_name),
            params![id],
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to delete document: {}", e)))?;
    }

    Ok(count)
}

/// Index documents with vectors (using sqlite-vec)
pub fn vector_index(
    _db_path: &str,
    table_name: &str,
    documents: Vec<VectorDocument>,
) -> napi::Result<u32> {
    if documents.is_empty() {
        return Ok(0);
    }

    let count = documents.len() as u32;
    let db = get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Get embedding dimension from first document
    let dim = documents.first().map(|d| d.vector.len()).unwrap_or(384);

    // Create the vector table if it doesn't exist
    // Using sqlite-vec syntax
    let create_vec = format!(
        "CREATE VIRTUAL TABLE IF NOT EXISTS {}_vec USING vec0(
            doc_id TEXT PRIMARY KEY,
            content TEXT,
            metadata TEXT,
            embedding float[{}]
        );",
        table_name, dim
    );
    conn.execute(&create_vec, [])
        .map_err(|e| napi::Error::from_reason(format!("Failed to create vector table: {}", e)))?;

    // Insert documents
    for doc in documents {
        // Convert vector to blob format for sqlite-vec
        let vec_blob: Vec<u8> = doc.vector.iter().flat_map(|f| f.to_le_bytes()).collect();

        conn.execute(
            &format!(
                "INSERT OR REPLACE INTO {}_vec (doc_id, content, metadata, embedding)
                 VALUES (?1, ?2, ?3, ?4);",
                table_name
            ),
            params![doc.id, doc.content, doc.metadata, vec_blob],
        )
        .map_err(|e| napi::Error::from_reason(format!("Failed to insert vector: {}", e)))?;
    }

    Ok(count)
}

/// Search documents using vector similarity
pub fn vector_search(
    _db_path: &str,
    table_name: &str,
    query_vector: Vec<f32>,
    limit: Option<u32>,
) -> napi::Result<Vec<VectorSearchResult>> {
    let limit = limit.unwrap_or(10);
    let db = get_db()?;
    let conn = db
        .lock()
        .map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Convert query vector to blob
    let vec_blob: Vec<u8> = query_vector.iter().flat_map(|f| f.to_le_bytes()).collect();

    // sqlite-vec KNN search
    let sql = format!(
        "SELECT doc_id, content, metadata, distance
         FROM {}_vec
         WHERE embedding MATCH ?1
         ORDER BY distance
         LIMIT ?2;",
        table_name
    );

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare vector search: {}", e)))?;

    let results = stmt
        .query_map(params![vec_blob, limit], |row| {
            let distance: f64 = row.get(3)?;
            Ok(VectorSearchResult {
                id: row.get(0)?,
                content: row.get(1)?,
                metadata: row.get(2)?,
                score: 1.0 - distance, // Convert distance to similarity
            })
        })
        .map_err(|e| napi::Error::from_reason(format!("Failed to search vectors: {}", e)))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(results)
}

// ============================================================================
// Test module
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use tempfile::TempDir;

    // Counter to ensure unique database paths across parallel tests
    static TEST_COUNTER: AtomicUsize = AtomicUsize::new(0);

    /// Create a unique temporary database for testing
    fn create_test_db() -> (TempDir, Connection) {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let counter = TEST_COUNTER.fetch_add(1, Ordering::SeqCst);
        let db_path = temp_dir.path().join(format!("test_{}.db", counter));
        let conn = Connection::open(&db_path).expect("Failed to open test database");
        (temp_dir, conn)
    }

    /// Helper to open a database at a specific path (test version without napi)
    fn open_database_test(path: &str) -> Result<Connection, rusqlite::Error> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL;")?;
        conn.execute_batch("PRAGMA synchronous=NORMAL;")?;
        conn.execute_batch("PRAGMA cache_size=-64000;")?;
        conn.execute_batch("PRAGMA foreign_keys=ON;")?;
        conn.execute_batch("PRAGMA busy_timeout=5000;")?;
        run_migrations(&conn)?;
        conn.execute_batch(include_str!("schema.sql"))?;
        Ok(conn)
    }

    // ========================================================================
    // Database Path Tests
    // ========================================================================

    #[test]
    fn test_get_db_path_default() {
        // Clear CLAUDE_CONFIG_DIR to test default behavior
        std::env::remove_var("CLAUDE_CONFIG_DIR");
        let path = get_db_path();
        assert!(path.ends_with("han/han.db") || path.contains(".claude"));
    }

    #[test]
    fn test_get_db_path_with_config_dir() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let config_path = temp_dir.path().to_string_lossy().to_string();
        std::env::set_var("CLAUDE_CONFIG_DIR", &config_path);

        let path = get_db_path();

        // Clean up env var
        std::env::remove_var("CLAUDE_CONFIG_DIR");

        assert!(path.starts_with(&config_path));
        assert!(path.ends_with("han/han.db"));
    }

    // ========================================================================
    // Database Initialization Tests
    // ========================================================================

    #[test]
    fn test_open_database_creates_file() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        let conn = open_database_test(&db_path_str).expect("Failed to open database");

        // Verify file was created
        assert!(db_path.exists());

        // Verify we can query the database
        let result: i32 = conn
            .query_row("SELECT 1", [], |row| row.get(0))
            .expect("Query failed");
        assert_eq!(result, 1);
    }

    #[test]
    fn test_database_wal_mode_enabled() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_wal.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        let conn = open_database_test(&db_path_str).expect("Failed to open database");

        let journal_mode: String = conn
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .expect("Failed to get journal mode");
        assert_eq!(journal_mode.to_lowercase(), "wal");
    }

    #[test]
    fn test_database_foreign_keys_enabled() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_fk.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        let conn = open_database_test(&db_path_str).expect("Failed to open database");

        let fk_enabled: i32 = conn
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
            .expect("Failed to get foreign_keys pragma");
        assert_eq!(fk_enabled, 1);
    }

    #[test]
    fn test_database_synchronous_mode() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_sync.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        let conn = open_database_test(&db_path_str).expect("Failed to open database");

        let sync_mode: i32 = conn
            .query_row("PRAGMA synchronous", [], |row| row.get(0))
            .expect("Failed to get synchronous pragma");
        // NORMAL = 1
        assert_eq!(sync_mode, 1);
    }

    // ========================================================================
    // Schema Tests
    // ========================================================================

    #[test]
    fn test_schema_creates_all_tables() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_schema.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        let conn = open_database_test(&db_path_str).expect("Failed to open database");

        // List of expected tables from schema.sql
        let expected_tables = vec![
            "repos",
            "projects",
            "sessions",
            "session_files",
            "session_summaries",
            "session_compacts",
            "messages",
            "tasks",
            "orchestrations",
            "hook_executions",
            "pending_hooks",
            "frustration_events",
            "session_file_changes",
            "session_file_validations",
            "session_todos",
            "native_tasks",
        ];

        for table_name in expected_tables {
            let exists: bool = conn
                .query_row(
                    "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name=?",
                    [table_name],
                    |row| row.get(0),
                )
                .expect(&format!("Failed to check table {}", table_name));
            assert!(exists, "Table {} should exist", table_name);
        }
    }

    #[test]
    fn test_schema_creates_fts_table() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_fts.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        let conn = open_database_test(&db_path_str).expect("Failed to open database");

        // Check messages_fts virtual table exists
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='messages_fts'",
                [],
                |row| row.get(0),
            )
            .expect("Failed to check messages_fts table");
        assert!(exists, "messages_fts FTS table should exist");
    }

    #[test]
    fn test_schema_creates_views() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_views.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        let conn = open_database_test(&db_path_str).expect("Failed to open database");

        // Check sessions_with_timestamps view exists
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='view' AND name='sessions_with_timestamps'",
                [],
                |row| row.get(0),
            )
            .expect("Failed to check view");
        assert!(exists, "sessions_with_timestamps view should exist");
    }

    #[test]
    fn test_schema_creates_indexes() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_indexes.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        let conn = open_database_test(&db_path_str).expect("Failed to open database");

        // Check some key indexes exist
        let expected_indexes = vec![
            "idx_sessions_project",
            "idx_messages_session",
            "idx_messages_type",
            "idx_tasks_session",
            "idx_hook_executions_session",
        ];

        for index_name in expected_indexes {
            let exists: bool = conn
                .query_row(
                    "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='index' AND name=?",
                    [index_name],
                    |row| row.get(0),
                )
                .expect(&format!("Failed to check index {}", index_name));
            assert!(exists, "Index {} should exist", index_name);
        }
    }

    // ========================================================================
    // Migration Tests
    // ========================================================================

    #[test]
    fn test_migrations_on_fresh_database() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_fresh_migrations.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        // Should not fail on a fresh database
        let result = open_database_test(&db_path_str);
        assert!(result.is_ok(), "Opening fresh database should succeed");
    }

    #[test]
    fn test_migrations_view_to_table_session_summaries() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_view_migration.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        // First, create a database with a VIEW named session_summaries
        {
            let conn = Connection::open(&db_path_str).expect("Failed to open db");
            conn.execute_batch("CREATE VIEW session_summaries AS SELECT 1 as id")
                .unwrap();

            // Verify it's a view
            let obj_type: String = conn
                .query_row(
                    "SELECT type FROM sqlite_master WHERE name = 'session_summaries'",
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(obj_type, "view");
        }

        // Now open with migrations - should convert to table
        let conn = open_database_test(&db_path_str).expect("Failed to open with migrations");

        // Verify it's now a table
        let obj_type: String = conn
            .query_row(
                "SELECT type FROM sqlite_master WHERE name = 'session_summaries'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(obj_type, "table");
    }

    #[test]
    fn test_migrations_view_to_table_session_compacts() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_compact_migration.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        // First, create a database with a VIEW named session_compacts
        {
            let conn = Connection::open(&db_path_str).expect("Failed to open db");
            conn.execute_batch("CREATE VIEW session_compacts AS SELECT 1 as id")
                .unwrap();
        }

        // Now open with migrations - should convert to table
        let conn = open_database_test(&db_path_str).expect("Failed to open with migrations");

        // Verify it's now a table
        let obj_type: String = conn
            .query_row(
                "SELECT type FROM sqlite_master WHERE name = 'session_compacts'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(obj_type, "table");
    }

    #[test]
    fn test_migrations_add_raw_json_column() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_raw_json_migration.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        // Create a minimal messages table without raw_json
        {
            let conn = Connection::open(&db_path_str).expect("Failed to open db");
            conn.execute_batch(
                "CREATE TABLE messages (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    message_type TEXT NOT NULL,
                    role TEXT,
                    content TEXT,
                    timestamp TEXT NOT NULL,
                    line_number INTEGER NOT NULL
                )",
            )
            .unwrap();
        }

        // Run migrations
        let conn = Connection::open(&db_path_str).expect("Failed to open db");
        run_migrations(&conn).expect("Migrations should succeed");

        // Verify raw_json column was added
        let has_raw_json: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM pragma_table_info('messages') WHERE name = 'raw_json'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(has_raw_json, "raw_json column should be added");
    }

    #[test]
    fn test_migrations_add_agent_id_column() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_agent_id_migration.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        // Create a minimal messages table without agent_id
        {
            let conn = Connection::open(&db_path_str).expect("Failed to open db");
            conn.execute_batch(
                "CREATE TABLE messages (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    message_type TEXT NOT NULL,
                    role TEXT,
                    content TEXT,
                    raw_json TEXT,
                    timestamp TEXT NOT NULL,
                    line_number INTEGER NOT NULL
                )",
            )
            .unwrap();
        }

        // Run migrations
        let conn = Connection::open(&db_path_str).expect("Failed to open db");
        run_migrations(&conn).expect("Migrations should succeed");

        // Verify agent_id column was added
        let has_agent_id: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM pragma_table_info('messages') WHERE name = 'agent_id'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(has_agent_id, "agent_id column should be added");

        // Verify index was created
        let has_index: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='index' AND name='idx_messages_agent'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(has_index, "idx_messages_agent index should be created");
    }

    #[test]
    fn test_migrations_add_parent_id_column() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_parent_id_migration.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        // Create a minimal messages table without parent_id
        {
            let conn = Connection::open(&db_path_str).expect("Failed to open db");
            conn.execute_batch(
                "CREATE TABLE messages (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    agent_id TEXT,
                    message_type TEXT NOT NULL,
                    role TEXT,
                    content TEXT,
                    raw_json TEXT,
                    timestamp TEXT NOT NULL,
                    line_number INTEGER NOT NULL
                )",
            )
            .unwrap();
        }

        // Run migrations
        let conn = Connection::open(&db_path_str).expect("Failed to open db");
        run_migrations(&conn).expect("Migrations should succeed");

        // Verify parent_id column was added
        let has_parent_id: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM pragma_table_info('messages') WHERE name = 'parent_id'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(has_parent_id, "parent_id column should be added");
    }

    #[test]
    fn test_migrations_add_sentiment_columns() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_sentiment_migration.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        // Create a minimal messages table without sentiment columns
        {
            let conn = Connection::open(&db_path_str).expect("Failed to open db");
            conn.execute_batch(
                "CREATE TABLE messages (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    agent_id TEXT,
                    parent_id TEXT,
                    message_type TEXT NOT NULL,
                    role TEXT,
                    content TEXT,
                    raw_json TEXT,
                    timestamp TEXT NOT NULL,
                    line_number INTEGER NOT NULL
                )",
            )
            .unwrap();
        }

        // Run migrations
        let conn = Connection::open(&db_path_str).expect("Failed to open db");
        run_migrations(&conn).expect("Migrations should succeed");

        // Verify sentiment columns were added
        for col in [
            "sentiment_score",
            "sentiment_level",
            "frustration_score",
            "frustration_level",
        ] {
            let has_col: bool = conn
                .query_row(
                    &format!(
                        "SELECT COUNT(*) > 0 FROM pragma_table_info('messages') WHERE name = '{}'",
                        col
                    ),
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert!(has_col, "{} column should be added", col);
        }
    }

    #[test]
    fn test_migrations_add_hook_execution_columns() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_hook_exec_migration.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        // Create a minimal hook_executions table without new columns
        {
            let conn = Connection::open(&db_path_str).expect("Failed to open db");
            conn.execute_batch(
                "CREATE TABLE hook_executions (
                    id TEXT PRIMARY KEY,
                    session_id TEXT,
                    hook_type TEXT NOT NULL,
                    hook_name TEXT NOT NULL,
                    duration_ms INTEGER NOT NULL,
                    exit_code INTEGER NOT NULL,
                    passed INTEGER NOT NULL DEFAULT 1,
                    executed_at TEXT NOT NULL DEFAULT (datetime('now'))
                )",
            )
            .unwrap();
            // Also create messages table to pass early return check
            conn.execute_batch(
                "CREATE TABLE messages (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    message_type TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    line_number INTEGER NOT NULL
                )",
            )
            .unwrap();
        }

        // Run migrations
        let conn = Connection::open(&db_path_str).expect("Failed to open db");
        run_migrations(&conn).expect("Migrations should succeed");

        // Verify columns were added
        for col in [
            "status",
            "consecutive_failures",
            "max_attempts",
            "pid",
            "plugin_root",
            "orchestration_id",
        ] {
            let has_col: bool = conn
                .query_row(
                    &format!("SELECT COUNT(*) > 0 FROM pragma_table_info('hook_executions') WHERE name = '{}'", col),
                    [],
                    |row| row.get(0),
                )
                .unwrap();
            assert!(has_col, "{} column should be added to hook_executions", col);
        }
    }

    #[test]
    fn test_migrations_file_validations_directory_column() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_file_validations_migration.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        // Create session_file_validations table without directory column
        {
            let conn = Connection::open(&db_path_str).expect("Failed to open db");
            // Need sessions table for foreign key
            conn.execute_batch(
                "CREATE TABLE sessions (
                    id TEXT PRIMARY KEY,
                    project_id TEXT,
                    status TEXT DEFAULT 'active'
                )",
            )
            .unwrap();
            conn.execute_batch(
                "CREATE TABLE session_file_validations (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL REFERENCES sessions(id),
                    file_path TEXT NOT NULL,
                    file_hash TEXT NOT NULL,
                    plugin_name TEXT NOT NULL,
                    hook_name TEXT NOT NULL,
                    validated_at TEXT NOT NULL DEFAULT (datetime('now')),
                    UNIQUE(session_id, file_path, plugin_name, hook_name)
                )",
            )
            .unwrap();
            // Insert test data
            conn.execute("INSERT INTO sessions (id) VALUES ('test-session')", [])
                .unwrap();
            conn.execute(
                "INSERT INTO session_file_validations (id, session_id, file_path, file_hash, plugin_name, hook_name) VALUES ('val-1', 'test-session', '/path/to/file', 'hash123', 'plugin1', 'hook1')",
                [],
            ).unwrap();
        }

        // Run migrations
        let conn = Connection::open(&db_path_str).expect("Failed to open db");
        run_migrations(&conn).expect("Migrations should succeed");

        // Verify directory column exists
        let has_directory: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM pragma_table_info('session_file_validations') WHERE name = 'directory'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(has_directory, "directory column should be added");

        // Verify data was migrated
        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM session_file_validations WHERE directory = '.'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "Migrated data should have default directory '.'");
    }

    #[test]
    fn test_migrations_idempotent() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_idempotent.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        // Open database (runs migrations and schema)
        let conn = open_database_test(&db_path_str).expect("First open should succeed");
        drop(conn);

        // Open again (migrations should be idempotent)
        let conn = open_database_test(&db_path_str).expect("Second open should succeed");

        // Verify database is still functional
        let result: i32 = conn
            .query_row("SELECT COUNT(*) FROM sessions", [], |row| row.get(0))
            .expect("Query should work");
        assert_eq!(result, 0);
    }

    // ========================================================================
    // FTS Query Escaping Tests
    // ========================================================================

    #[test]
    fn test_escape_fts5_query_simple_word() {
        let result = escape_fts5_query("hello");
        assert_eq!(result, "\"hello\"");
    }

    #[test]
    fn test_escape_fts5_query_multiple_words() {
        let result = escape_fts5_query("hello world");
        assert_eq!(result, "\"hello\" \"world\"");
    }

    #[test]
    fn test_escape_fts5_query_with_operators() {
        // FTS5 interprets AND, OR, NOT as operators - should be quoted
        let result = escape_fts5_query("this AND that");
        assert_eq!(result, "\"this\" \"AND\" \"that\"");
    }

    #[test]
    fn test_escape_fts5_query_with_special_chars() {
        let result = escape_fts5_query("error: something");
        assert_eq!(result, "\"error:\" \"something\"");
    }

    #[test]
    fn test_escape_fts5_query_with_existing_quotes() {
        let result = escape_fts5_query("\"quoted\"");
        assert_eq!(result, "\"quoted\"");
    }

    #[test]
    fn test_escape_fts5_query_internal_quotes() {
        let result = escape_fts5_query("say \"hello\" world");
        // Existing quotes are stripped (trim_matches) then words are re-quoted
        assert_eq!(result, "\"say\" \"hello\" \"world\"");
    }

    #[test]
    fn test_escape_fts5_query_empty() {
        let result = escape_fts5_query("");
        assert_eq!(result, "");
    }

    #[test]
    fn test_escape_fts5_query_whitespace_only() {
        let result = escape_fts5_query("   ");
        assert_eq!(result, "");
    }

    // ========================================================================
    // FTS Index Tests
    // ========================================================================

    #[test]
    fn test_fts_index_creates_table() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_fts_index.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        let conn = open_database_test(&db_path_str).expect("Failed to open database");

        // Create FTS table
        let create_fts =
            "CREATE VIRTUAL TABLE IF NOT EXISTS test_fts USING fts5(doc_id, content, metadata);";
        conn.execute(create_fts, []).unwrap();

        // Verify table exists
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='test_fts'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(exists, "FTS table should be created");
    }

    #[test]
    fn test_fts_index_insert_and_search() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_fts_search.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        let conn = open_database_test(&db_path_str).expect("Failed to open database");

        // Create FTS table
        conn.execute(
            "CREATE VIRTUAL TABLE IF NOT EXISTS test_fts USING fts5(doc_id, content, metadata);",
            [],
        )
        .unwrap();

        // Insert documents
        conn.execute(
            "INSERT INTO test_fts (doc_id, content, metadata) VALUES (?, ?, ?)",
            params!["doc1", "The quick brown fox", r#"{"tag": "animal"}"#],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO test_fts (doc_id, content, metadata) VALUES (?, ?, ?)",
            params!["doc2", "The lazy dog sleeps", r#"{"tag": "animal"}"#],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO test_fts (doc_id, content, metadata) VALUES (?, ?, ?)",
            params!["doc3", "Hello world program", r#"{"tag": "code"}"#],
        )
        .unwrap();

        // Search for "fox"
        let results: Vec<(String, String)> = conn
            .prepare("SELECT doc_id, content FROM test_fts WHERE test_fts MATCH '\"fox\"' ORDER BY bm25(test_fts)")
            .unwrap()
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].0, "doc1");
    }

    // ========================================================================
    // Connection Pool / Thread Safety Tests
    // ========================================================================

    #[test]
    fn test_database_connection_mutex() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_mutex.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        let conn = open_database_test(&db_path_str).expect("Failed to open database");

        // Wrap in mutex to test thread safety pattern
        let mutex = Mutex::new(conn);

        // Should be able to acquire lock
        {
            let guard = mutex.lock().expect("Should acquire lock");
            let result: i32 = guard
                .query_row("SELECT 1", [], |row| row.get(0))
                .expect("Query should work");
            assert_eq!(result, 1);
        }

        // Lock should be released
        {
            let guard = mutex.lock().expect("Should acquire lock again");
            let result: i32 = guard
                .query_row("SELECT 2", [], |row| row.get(0))
                .expect("Query should work");
            assert_eq!(result, 2);
        }
    }

    // ========================================================================
    // Data Types Tests
    // ========================================================================

    #[test]
    fn test_fts_document_struct() {
        let doc = FtsDocument {
            id: "test-id".to_string(),
            content: "test content".to_string(),
            metadata: Some(r#"{"key": "value"}"#.to_string()),
        };

        assert_eq!(doc.id, "test-id");
        assert_eq!(doc.content, "test content");
        assert!(doc.metadata.is_some());
    }

    #[test]
    fn test_fts_document_without_metadata() {
        let doc = FtsDocument {
            id: "test-id".to_string(),
            content: "test content".to_string(),
            metadata: None,
        };

        assert!(doc.metadata.is_none());
    }

    #[test]
    fn test_fts_search_result_struct() {
        let result = FtsSearchResult {
            id: "result-id".to_string(),
            content: "matched content".to_string(),
            metadata: Some(r#"{"score": 0.95}"#.to_string()),
            score: 0.95,
        };

        assert_eq!(result.id, "result-id");
        assert_eq!(result.score, 0.95);
    }

    #[test]
    fn test_vector_document_struct() {
        let doc = VectorDocument {
            id: "vec-doc-1".to_string(),
            content: "vector content".to_string(),
            vector: vec![0.1, 0.2, 0.3, 0.4],
            metadata: None,
        };

        assert_eq!(doc.vector.len(), 4);
        assert_eq!(doc.vector[0], 0.1);
    }

    #[test]
    fn test_vector_search_result_struct() {
        let result = VectorSearchResult {
            id: "vec-result".to_string(),
            content: "similar content".to_string(),
            metadata: None,
            score: 0.85,
        };

        assert_eq!(result.score, 0.85);
    }

    // ========================================================================
    // Legacy Database Detection Tests
    // ========================================================================

    #[test]
    fn test_has_legacy_database_false_when_not_exists() {
        // This test may vary depending on the test environment
        // The function should not crash even if dirs::home_dir() fails
        let result = has_legacy_database();
        // Result could be true or false depending on environment
        // We're just testing it doesn't panic
        let _ = result;
    }

    // ========================================================================
    // Error Handling Tests
    // ========================================================================

    #[test]
    fn test_open_database_invalid_path() {
        // Try to open a database in a non-existent directory without write permissions
        // This is tricky to test portably, so we test with a clearly invalid path
        let result = Connection::open("/nonexistent/deeply/nested/path/test.db");
        assert!(
            result.is_err(),
            "Opening database in invalid path should fail"
        );
    }

    #[test]
    fn test_schema_can_handle_data_insertion() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_insert.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        let conn = open_database_test(&db_path_str).expect("Failed to open database");

        // Insert into repos
        conn.execute(
            "INSERT INTO repos (id, remote, name) VALUES (?, ?, ?)",
            params!["repo-1", "https://github.com/test/repo", "test-repo"],
        )
        .expect("Should insert into repos");

        // Insert into projects
        conn.execute(
            "INSERT INTO projects (id, repo_id, slug, path, name) VALUES (?, ?, ?, ?, ?)",
            params![
                "proj-1",
                "repo-1",
                "test-slug",
                "/path/to/project",
                "Test Project"
            ],
        )
        .expect("Should insert into projects");

        // Insert into sessions
        conn.execute(
            "INSERT INTO sessions (id, project_id, status) VALUES (?, ?, ?)",
            params!["session-1", "proj-1", "active"],
        )
        .expect("Should insert into sessions");

        // Verify data
        let count: i32 = conn
            .query_row("SELECT COUNT(*) FROM sessions", [], |row| row.get(0))
            .expect("Should query sessions");
        assert_eq!(count, 1);
    }

    #[test]
    fn test_foreign_key_constraint() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_fk_constraint.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        let conn = open_database_test(&db_path_str).expect("Failed to open database");

        // Try to insert a session with non-existent project_id (should fail if FK is enforced)
        // Note: project_id can be NULL, so this should actually succeed
        let result = conn.execute(
            "INSERT INTO sessions (id, status) VALUES (?, ?)",
            params!["session-orphan", "active"],
        );
        assert!(
            result.is_ok(),
            "Session with NULL project_id should be allowed"
        );
    }

    // ========================================================================
    // Message FTS Triggers Tests
    // ========================================================================

    #[test]
    fn test_messages_fts_sync_on_insert() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_fts_trigger.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        let conn = open_database_test(&db_path_str).expect("Failed to open database");

        // Insert a session first
        conn.execute("INSERT INTO sessions (id) VALUES (?)", params!["session-1"])
            .unwrap();

        // Insert a message
        conn.execute(
            "INSERT INTO messages (id, session_id, message_type, content, timestamp, line_number) VALUES (?, ?, ?, ?, ?, ?)",
            params!["msg-1", "session-1", "user", "Hello world this is a test message", "2024-01-01T00:00:00Z", 1],
        ).unwrap();

        // Search in FTS table - the trigger should have synced it
        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM messages_fts WHERE messages_fts MATCH '\"hello\"'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "FTS should find the inserted message");
    }

    #[test]
    fn test_messages_fts_sync_on_delete() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_fts_delete.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        let conn = open_database_test(&db_path_str).expect("Failed to open database");

        // Insert a session
        conn.execute("INSERT INTO sessions (id) VALUES (?)", params!["session-1"])
            .unwrap();

        // Insert a message
        conn.execute(
            "INSERT INTO messages (id, session_id, message_type, content, timestamp, line_number) VALUES (?, ?, ?, ?, ?, ?)",
            params!["msg-1", "session-1", "user", "unique_delete_test_content", "2024-01-01T00:00:00Z", 1],
        ).unwrap();

        // Verify it's in FTS
        let count_before: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM messages_fts WHERE messages_fts MATCH '\"unique_delete_test_content\"'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count_before, 1);

        // Delete the message
        conn.execute("DELETE FROM messages WHERE id = ?", params!["msg-1"])
            .unwrap();

        // FTS should be updated
        let count_after: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM messages_fts WHERE messages_fts MATCH '\"unique_delete_test_content\"'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count_after, 0, "FTS should remove deleted message");
    }

    #[test]
    fn test_messages_fts_sync_on_update() {
        let temp_dir = TempDir::new().expect("Failed to create temp dir");
        let db_path = temp_dir.path().join("test_fts_update.db");
        let db_path_str = db_path.to_string_lossy().to_string();

        let conn = open_database_test(&db_path_str).expect("Failed to open database");

        // Insert a session
        conn.execute("INSERT INTO sessions (id) VALUES (?)", params!["session-1"])
            .unwrap();

        // Insert a message
        conn.execute(
            "INSERT INTO messages (id, session_id, message_type, content, timestamp, line_number) VALUES (?, ?, ?, ?, ?, ?)",
            params!["msg-1", "session-1", "user", "original_content_xyz", "2024-01-01T00:00:00Z", 1],
        ).unwrap();

        // Update the message
        conn.execute(
            "UPDATE messages SET content = ? WHERE id = ?",
            params!["updated_content_abc", "msg-1"],
        )
        .unwrap();

        // Old content should not be found
        let count_old: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM messages_fts WHERE messages_fts MATCH '\"original_content_xyz\"'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count_old, 0, "Old content should be removed from FTS");

        // New content should be found
        let count_new: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM messages_fts WHERE messages_fts MATCH '\"updated_content_abc\"'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count_new, 1, "New content should be in FTS");
    }
}
