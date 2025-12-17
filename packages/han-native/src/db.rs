//! SurrealDB wrapper for FTS and vector search
//!
//! Uses SurrealDB with SurrealKV backend (pure Rust, no native deps).

use napi_derive::napi;
use serde::{Deserialize, Serialize};
use surrealdb::engine::local::{Db, SurrealKv};
use surrealdb::Surreal;
use std::sync::OnceLock;
use tokio::sync::Mutex;

// Global database connection (lazy initialized)
static DB: OnceLock<Mutex<Option<Surreal<Db>>>> = OnceLock::new();

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

/// A document with vector embedding (used internally, not exposed to napi)
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

/// Internal document structure for SurrealDB
#[derive(Debug, Serialize, Deserialize)]
struct DbDocument {
    id: Option<surrealdb::RecordId>,
    doc_id: String,
    content: String,
    metadata: Option<String>,
    #[serde(default)]
    vector: Option<Vec<f32>>,
}

/// Get or create database connection
async fn get_db(db_path: &str) -> napi::Result<tokio::sync::MutexGuard<'static, Option<Surreal<Db>>>> {
    let cell = DB.get_or_init(|| Mutex::new(None));
    let mut guard = cell.lock().await;

    if guard.is_none() {
        let db = Surreal::new::<SurrealKv>(db_path)
            .await
            .map_err(|e| napi::Error::from_reason(format!("Failed to connect to database: {}", e)))?;

        db.use_ns("han")
            .use_db("memory")
            .await
            .map_err(|e| napi::Error::from_reason(format!("Failed to select namespace: {}", e)))?;

        *guard = Some(db);
    }

    Ok(guard)
}

/// Initialize the database
pub async fn init(db_path: &str) -> napi::Result<bool> {
    let guard = get_db(db_path).await?;
    let db = guard.as_ref().ok_or_else(|| {
        napi::Error::from_reason("Database not initialized".to_string())
    })?;

    // Create FTS analyzer and index definitions
    // Note: SurrealDB creates tables implicitly, but we define analyzers for FTS
    db.query(
        r#"
        DEFINE ANALYZER IF NOT EXISTS content_analyzer TOKENIZERS blank, class FILTERS lowercase, snowball(english);
        "#,
    )
    .await
    .map_err(|e| napi::Error::from_reason(format!("Failed to create analyzer: {}", e)))?;

    Ok(true)
}

/// Index documents for FTS
pub async fn fts_index(
    db_path: &str,
    table_name: &str,
    documents: Vec<FtsDocument>,
) -> napi::Result<u32> {
    if documents.is_empty() {
        return Ok(0);
    }

    let count = documents.len() as u32;
    let guard = get_db(db_path).await?;
    let db = guard.as_ref().ok_or_else(|| {
        napi::Error::from_reason("Database not initialized".to_string())
    })?;

    // Ensure FTS index exists on the table
    let index_query = format!(
        r#"
        DEFINE INDEX IF NOT EXISTS {table}_content_fts ON {table}
        FIELDS content SEARCH ANALYZER content_analyzer BM25(1.2, 0.75);
        "#,
        table = table_name
    );
    db.query(&index_query)
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to create FTS index: {}", e)))?;

    // Insert documents
    for doc in documents {
        let record = DbDocument {
            id: None,
            doc_id: doc.id.clone(),
            content: doc.content,
            metadata: doc.metadata,
            vector: None,
        };

        // Use upsert to handle duplicates
        let query = format!(
            r#"
            UPSERT INTO {table} {{ doc_id: $doc_id, content: $content, metadata: $metadata }}
            WHERE doc_id = $doc_id;
            "#,
            table = table_name
        );

        db.query(&query)
            .bind(("doc_id", record.doc_id))
            .bind(("content", record.content))
            .bind(("metadata", record.metadata))
            .await
            .map_err(|e| napi::Error::from_reason(format!("Failed to insert document: {}", e)))?;
    }

    Ok(count)
}

/// Search documents using FTS (BM25)
pub async fn fts_search(
    db_path: &str,
    table_name: &str,
    query: &str,
    limit: Option<u32>,
) -> napi::Result<Vec<FtsSearchResult>> {
    let limit = limit.unwrap_or(10);
    let query_owned = query.to_string();
    let guard = get_db(db_path).await?;
    let db = guard.as_ref().ok_or_else(|| {
        napi::Error::from_reason("Database not initialized".to_string())
    })?;

    // FTS search with BM25 scoring
    let search_query = format!(
        r#"
        SELECT doc_id, content, metadata, search::score(1) AS score
        FROM {table}
        WHERE content @1@ $query
        ORDER BY score DESC
        LIMIT $limit;
        "#,
        table = table_name
    );

    let mut response = db
        .query(&search_query)
        .bind(("query", query_owned))
        .bind(("limit", limit))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to search: {}", e)))?;

    #[derive(Debug, Deserialize)]
    struct SearchRow {
        doc_id: String,
        content: String,
        metadata: Option<String>,
        score: f64,
    }

    let rows: Vec<SearchRow> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse results: {}", e)))?;

    let results = rows
        .into_iter()
        .map(|row| FtsSearchResult {
            id: row.doc_id,
            content: row.content,
            metadata: row.metadata,
            score: row.score,
        })
        .collect();

    Ok(results)
}

/// Delete documents by ID
pub async fn fts_delete(
    db_path: &str,
    table_name: &str,
    ids: Vec<String>,
) -> napi::Result<u32> {
    if ids.is_empty() {
        return Ok(0);
    }

    let count = ids.len() as u32;
    let guard = get_db(db_path).await?;
    let db = guard.as_ref().ok_or_else(|| {
        napi::Error::from_reason("Database not initialized".to_string())
    })?;

    for id in ids {
        let query = format!(
            r#"DELETE FROM {table} WHERE doc_id = $doc_id;"#,
            table = table_name
        );

        db.query(&query)
            .bind(("doc_id", id))
            .await
            .map_err(|e| napi::Error::from_reason(format!("Failed to delete document: {}", e)))?;
    }

    Ok(count)
}

/// Index documents with vectors
pub async fn vector_index(
    db_path: &str,
    table_name: &str,
    documents: Vec<VectorDocument>,
) -> napi::Result<u32> {
    if documents.is_empty() {
        return Ok(0);
    }

    let count = documents.len() as u32;
    let guard = get_db(db_path).await?;
    let db = guard.as_ref().ok_or_else(|| {
        napi::Error::from_reason("Database not initialized".to_string())
    })?;

    // Ensure vector index exists (HNSW for approximate nearest neighbor)
    let dim = documents.first().map(|d| d.vector.len()).unwrap_or(384);
    let index_query = format!(
        r#"
        DEFINE INDEX IF NOT EXISTS {table}_vector_idx ON {table}
        FIELDS vector HNSW DIMENSION {dim} DIST COSINE;
        "#,
        table = table_name,
        dim = dim
    );
    db.query(&index_query)
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to create vector index: {}", e)))?;

    // Insert documents
    for doc in documents {
        let query = format!(
            r#"
            UPSERT INTO {table} {{
                doc_id: $doc_id,
                content: $content,
                metadata: $metadata,
                vector: $vector
            }}
            WHERE doc_id = $doc_id;
            "#,
            table = table_name
        );

        db.query(&query)
            .bind(("doc_id", doc.id))
            .bind(("content", doc.content))
            .bind(("metadata", doc.metadata))
            .bind(("vector", doc.vector))
            .await
            .map_err(|e| napi::Error::from_reason(format!("Failed to insert document: {}", e)))?;
    }

    Ok(count)
}

/// Search documents using vector similarity
pub async fn vector_search(
    db_path: &str,
    table_name: &str,
    query_vector: Vec<f32>,
    limit: Option<u32>,
) -> napi::Result<Vec<VectorSearchResult>> {
    let limit = limit.unwrap_or(10);
    let guard = get_db(db_path).await?;
    let db = guard.as_ref().ok_or_else(|| {
        napi::Error::from_reason("Database not initialized".to_string())
    })?;

    // Vector similarity search using KNN
    let search_query = format!(
        r#"
        SELECT doc_id, content, metadata, vector::distance::knn() AS distance
        FROM {table}
        WHERE vector <|{limit}|> $query_vector
        ORDER BY distance ASC;
        "#,
        table = table_name,
        limit = limit
    );

    let mut response = db
        .query(&search_query)
        .bind(("query_vector", query_vector))
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to search: {}", e)))?;

    #[derive(Debug, Deserialize)]
    struct VectorRow {
        doc_id: String,
        content: String,
        metadata: Option<String>,
        distance: f64,
    }

    let rows: Vec<VectorRow> = response
        .take(0)
        .map_err(|e| napi::Error::from_reason(format!("Failed to parse results: {}", e)))?;

    // Convert distance to similarity score (1 - distance for cosine)
    let results = rows
        .into_iter()
        .map(|row| VectorSearchResult {
            id: row.doc_id,
            content: row.content,
            metadata: row.metadata,
            score: 1.0 - row.distance, // Higher is more similar
        })
        .collect();

    Ok(results)
}
