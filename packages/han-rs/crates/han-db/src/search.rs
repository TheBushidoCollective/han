//! Search backend trait and implementations.
//!
//! Provides FTS5-based search for SQLite and a trait for future PostgreSQL support.

use crate::error::DbResult;
use sea_orm::DatabaseConnection;
use serde::{Deserialize, Serialize};

/// A search result from a message search query.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MessageSearchResult {
    pub id: String,
    pub session_id: String,
    pub content: String,
    pub message_type: String,
    pub timestamp: String,
    pub score: f64,
}

/// A search result from generated session summaries.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GeneratedSummarySearchResult {
    pub id: String,
    pub session_id: String,
    pub summary_text: String,
    pub topics: String,
    pub score: f64,
}

/// SQLite FTS5 search implementation.
pub struct SqliteSearch {
    db: DatabaseConnection,
}

impl SqliteSearch {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }
}

/// Escape a query string for FTS5.
/// FTS5 interprets words like AND, OR, NOT, NEAR as operators,
/// and characters like :, *, (, ), ^ as special syntax.
/// This function quotes each word to prevent syntax errors.
pub fn escape_fts5_query(query: &str) -> String {
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

impl SqliteSearch {
    /// Search messages using FTS5 MATCH.
    pub async fn search_messages(
        &self,
        query: &str,
        session_id: Option<&str>,
        limit: u32,
    ) -> DbResult<Vec<MessageSearchResult>> {
        use sea_orm::{ConnectionTrait, Statement};

        let escaped = escape_fts5_query(query);
        if escaped.is_empty() {
            return Ok(vec![]);
        }

        let (sql, params) = if let Some(sid) = session_id {
            (
                "SELECT m.id, m.session_id, m.content, m.message_type, m.timestamp, bm25(messages_fts) AS score
                 FROM messages_fts
                 JOIN messages m ON messages_fts.id = m.id
                 WHERE messages_fts MATCH ?1 AND m.session_id = ?2
                 ORDER BY score
                 LIMIT ?3".to_string(),
                vec![
                    sea_orm::Value::String(Some(Box::new(escaped))),
                    sea_orm::Value::String(Some(Box::new(sid.to_string()))),
                    sea_orm::Value::Int(Some(limit as i32)),
                ],
            )
        } else {
            (
                "SELECT m.id, m.session_id, m.content, m.message_type, m.timestamp, bm25(messages_fts) AS score
                 FROM messages_fts
                 JOIN messages m ON messages_fts.id = m.id
                 WHERE messages_fts MATCH ?1
                 ORDER BY score
                 LIMIT ?2".to_string(),
                vec![
                    sea_orm::Value::String(Some(Box::new(escaped))),
                    sea_orm::Value::Int(Some(limit as i32)),
                ],
            )
        };

        let stmt = Statement::from_sql_and_values(sea_orm::DatabaseBackend::Sqlite, &sql, params);
        let rows = self.db.query_all(stmt).await.map_err(crate::error::DbError::Database)?;

        let mut results = Vec::new();
        for row in rows {
            let result = MessageSearchResult {
                id: row.try_get::<String>("", "id").unwrap_or_default(),
                session_id: row.try_get::<String>("", "session_id").unwrap_or_default(),
                content: row.try_get::<String>("", "content").unwrap_or_default(),
                message_type: row.try_get::<String>("", "message_type").unwrap_or_default(),
                timestamp: row.try_get::<String>("", "timestamp").unwrap_or_default(),
                score: row.try_get::<f64>("", "score").unwrap_or(0.0).abs(),
            };
            results.push(result);
        }

        Ok(results)
    }

    /// Search generated session summaries using FTS5.
    pub async fn search_generated_summaries(
        &self,
        query: &str,
        limit: u32,
    ) -> DbResult<Vec<GeneratedSummarySearchResult>> {
        use sea_orm::{ConnectionTrait, Statement};

        let escaped = escape_fts5_query(query);
        if escaped.is_empty() {
            return Ok(vec![]);
        }

        let sql = "SELECT g.id, g.session_id, g.summary_text, g.topics, bm25(generated_session_summaries_fts) AS score
                    FROM generated_session_summaries_fts
                    JOIN generated_session_summaries g ON generated_session_summaries_fts.id = g.id
                    WHERE generated_session_summaries_fts MATCH ?1
                    ORDER BY score
                    LIMIT ?2";

        let stmt = Statement::from_sql_and_values(
            sea_orm::DatabaseBackend::Sqlite,
            sql,
            vec![
                sea_orm::Value::String(Some(Box::new(escaped))),
                sea_orm::Value::Int(Some(limit as i32)),
            ],
        );

        let rows = self.db.query_all(stmt).await.map_err(crate::error::DbError::Database)?;

        let mut results = Vec::new();
        for row in rows {
            let result = GeneratedSummarySearchResult {
                id: row.try_get::<String>("", "id").unwrap_or_default(),
                session_id: row.try_get::<String>("", "session_id").unwrap_or_default(),
                summary_text: row.try_get::<String>("", "summary_text").unwrap_or_default(),
                topics: row.try_get::<String>("", "topics").unwrap_or_default(),
                score: row.try_get::<f64>("", "score").unwrap_or(0.0).abs(),
            };
            results.push(result);
        }

        Ok(results)
    }
}
