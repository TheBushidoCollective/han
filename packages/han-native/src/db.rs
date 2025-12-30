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
    let conn = open_database(&path)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open database: {}", e)))?;

    // Try to set, ignore if already set by another thread
    let _ = DB.set(conn);

    DB.get()
        .ok_or_else(|| napi::Error::from_reason("Database initialization failed".to_string()))
}

/// Open a database at a specific path
fn open_database(path: &str) -> Result<Mutex<Connection>, rusqlite::Error> {
    let conn = Connection::open(path)?;

    // Enable WAL mode for concurrent reads
    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    conn.execute_batch("PRAGMA synchronous=NORMAL;")?;
    conn.execute_batch("PRAGMA cache_size=-64000;")?; // 64MB cache
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;

    // Initialize schema
    conn.execute_batch(include_str!("schema.sql"))?;

    // Run migrations for existing databases
    run_migrations(&conn)?;

    Ok(Mutex::new(conn))
}

/// Run database migrations for schema updates
fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
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
        open_database(db_path)
            .map_err(|e| napi::Error::from_reason(format!("Failed to initialize database: {}", e)))?;
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
    let legacy_dir = home.join(".claude").join("han").join("memory").join("index");

    if legacy_dir.exists() {
        // Remove the entire directory
        std::fs::remove_dir_all(&legacy_dir)
            .map_err(|e| napi::Error::from_reason(format!("Failed to remove legacy database: {}", e)))?;
        tracing::info!("Removed legacy SurrealDB database at {:?}", legacy_dir);
        return Ok(true);
    }

    Ok(false)
}

/// Check if legacy SurrealDB files exist
#[napi]
pub fn has_legacy_database() -> bool {
    if let Some(home) = dirs::home_dir() {
        let legacy_dir = home.join(".claude").join("han").join("memory").join("index");
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
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

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
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

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

    let mut stmt = conn.prepare(&sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare search: {}", e)))?;

    let results = stmt.query_map(params![escaped_query, limit], |row| {
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
pub fn fts_delete(
    _db_path: &str,
    table_name: &str,
    ids: Vec<String>,
) -> napi::Result<u32> {
    if ids.is_empty() {
        return Ok(0);
    }

    let count = ids.len() as u32;
    let db = get_db()?;
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

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
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

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
        let vec_blob: Vec<u8> = doc.vector.iter()
            .flat_map(|f| f.to_le_bytes())
            .collect();

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
    let conn = db.lock().map_err(|e| napi::Error::from_reason(e.to_string()))?;

    // Convert query vector to blob
    let vec_blob: Vec<u8> = query_vector.iter()
        .flat_map(|f| f.to_le_bytes())
        .collect();

    // sqlite-vec KNN search
    let sql = format!(
        "SELECT doc_id, content, metadata, distance
         FROM {}_vec
         WHERE embedding MATCH ?1
         ORDER BY distance
         LIMIT ?2;",
        table_name
    );

    let mut stmt = conn.prepare(&sql)
        .map_err(|e| napi::Error::from_reason(format!("Failed to prepare vector search: {}", e)))?;

    let results = stmt.query_map(params![vec_blob, limit], |row| {
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
