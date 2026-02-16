//! Memory-related GraphQL types.

use async_graphql::*;
use crate::types::enums::{Confidence, MemoryAgentProgressType};

/// Memory query type (namespace for memory operations).
#[derive(Debug, Clone, SimpleObject)]
pub struct MemoryQuery {
    /// Placeholder - actual memory search is done via dedicated fields.
    pub placeholder: Option<bool>,
}

/// Memory search result.
#[derive(Debug, Clone, SimpleObject)]
pub struct MemorySearchResult {
    pub content: String,
    pub path: String,
    pub score: f64,
    pub domain: Option<String>,
}

/// Memory agent progress update.
#[derive(Debug, Clone, SimpleObject)]
pub struct MemoryAgentProgress {
    pub session_id: String,
    #[graphql(name = "type")]
    pub progress_type: MemoryAgentProgressType,
    pub layer: Option<String>,
    pub content: String,
    pub result_count: Option<i32>,
    pub timestamp: f64,
}

/// Memory agent final result.
#[derive(Debug, Clone, SimpleObject)]
pub struct MemoryAgentResult {
    pub session_id: String,
    pub answer: String,
    pub confidence: Confidence,
    pub citations: Vec<Citation>,
    pub searched_layers: Vec<String>,
    pub success: bool,
    pub error: Option<String>,
}

/// Citation in memory agent results.
#[derive(Debug, Clone, SimpleObject)]
pub struct Citation {
    pub source: String,
    pub excerpt: String,
    pub author: Option<String>,
    pub timestamp: Option<f64>,
    pub browse_url: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn memory_query_construction() {
        let mq = MemoryQuery { placeholder: Some(true) };
        assert_eq!(mq.placeholder, Some(true));
    }

    #[test]
    fn memory_query_placeholder_none() {
        let mq = MemoryQuery { placeholder: None };
        assert!(mq.placeholder.is_none());
    }

    #[test]
    fn memory_search_result_construction() {
        let r = MemorySearchResult {
            content: "Some memory content".into(),
            path: "/project/file.rs".into(),
            score: 0.85,
            domain: Some("project".into()),
        };
        assert_eq!(r.content, "Some memory content");
        assert_eq!(r.path, "/project/file.rs");
        assert!((r.score - 0.85).abs() < f64::EPSILON);
        assert_eq!(r.domain, Some("project".into()));
    }

    #[test]
    fn memory_search_result_domain_none() {
        let r = MemorySearchResult {
            content: "content".into(),
            path: "/path".into(),
            score: 0.5,
            domain: None,
        };
        assert!(r.domain.is_none());
    }

    #[test]
    fn memory_search_result_clone() {
        let r = MemorySearchResult {
            content: "test".into(),
            path: "/p".into(),
            score: 0.9,
            domain: Some("global".into()),
        };
        let r2 = r.clone();
        assert_eq!(r.content, r2.content);
        assert_eq!(r.score, r2.score);
    }

    #[test]
    fn memory_agent_progress_construction() {
        let p = MemoryAgentProgress {
            session_id: "sess-1".into(),
            progress_type: MemoryAgentProgressType::Searching,
            layer: Some("project".into()),
            content: "Searching project memory...".into(),
            result_count: None,
            timestamp: 1700000000.0,
        };
        assert_eq!(p.session_id, "sess-1");
        assert_eq!(p.progress_type, MemoryAgentProgressType::Searching);
        assert_eq!(p.layer, Some("project".into()));
        assert_eq!(p.content, "Searching project memory...");
        assert!(p.result_count.is_none());
        assert!((p.timestamp - 1700000000.0).abs() < f64::EPSILON);
    }

    #[test]
    fn memory_agent_progress_found_with_count() {
        let p = MemoryAgentProgress {
            session_id: "sess-2".into(),
            progress_type: MemoryAgentProgressType::Found,
            layer: Some("session".into()),
            content: "Found 5 results".into(),
            result_count: Some(5),
            timestamp: 1700000001.0,
        };
        assert_eq!(p.progress_type, MemoryAgentProgressType::Found);
        assert_eq!(p.result_count, Some(5));
    }

    #[test]
    fn memory_agent_progress_clone() {
        let p = MemoryAgentProgress {
            session_id: "s".into(),
            progress_type: MemoryAgentProgressType::Complete,
            layer: None,
            content: "done".into(),
            result_count: Some(10),
            timestamp: 1.0,
        };
        let p2 = p.clone();
        assert_eq!(p.session_id, p2.session_id);
        assert_eq!(p.progress_type, p2.progress_type);
    }

    #[test]
    fn memory_agent_result_construction() {
        let r = MemoryAgentResult {
            session_id: "sess-1".into(),
            answer: "The answer is 42".into(),
            confidence: Confidence::High,
            citations: vec![Citation {
                source: "file.md".into(),
                excerpt: "relevant text".into(),
                author: Some("Alice".into()),
                timestamp: Some(1700000000.0),
                browse_url: Some("http://example.com".into()),
            }],
            searched_layers: vec!["project".into(), "global".into()],
            success: true,
            error: None,
        };
        assert_eq!(r.session_id, "sess-1");
        assert_eq!(r.answer, "The answer is 42");
        assert_eq!(r.confidence, Confidence::High);
        assert_eq!(r.citations.len(), 1);
        assert_eq!(r.searched_layers.len(), 2);
        assert!(r.success);
        assert!(r.error.is_none());
    }

    #[test]
    fn memory_agent_result_with_error() {
        let r = MemoryAgentResult {
            session_id: "sess-2".into(),
            answer: "".into(),
            confidence: Confidence::Low,
            citations: vec![],
            searched_layers: vec![],
            success: false,
            error: Some("Search timed out".into()),
        };
        assert!(!r.success);
        assert_eq!(r.error, Some("Search timed out".into()));
        assert!(r.citations.is_empty());
    }

    #[test]
    fn citation_construction_all_fields() {
        let c = Citation {
            source: "blueprint.md".into(),
            excerpt: "Architecture overview...".into(),
            author: Some("Bob".into()),
            timestamp: Some(1700000000.0),
            browse_url: Some("http://example.com/blueprint".into()),
        };
        assert_eq!(c.source, "blueprint.md");
        assert_eq!(c.excerpt, "Architecture overview...");
        assert_eq!(c.author, Some("Bob".into()));
        assert!(c.timestamp.is_some());
        assert!(c.browse_url.is_some());
    }

    #[test]
    fn citation_construction_optional_none() {
        let c = Citation {
            source: "src.md".into(),
            excerpt: "text".into(),
            author: None,
            timestamp: None,
            browse_url: None,
        };
        assert!(c.author.is_none());
        assert!(c.timestamp.is_none());
        assert!(c.browse_url.is_none());
    }

    #[test]
    fn citation_clone() {
        let c = Citation {
            source: "test.md".into(),
            excerpt: "excerpt".into(),
            author: Some("Carol".into()),
            timestamp: Some(1.0),
            browse_url: None,
        };
        let c2 = c.clone();
        assert_eq!(c.source, c2.source);
        assert_eq!(c.author, c2.author);
    }

    #[test]
    fn citation_debug() {
        let c = Citation {
            source: "s".into(),
            excerpt: "e".into(),
            author: None,
            timestamp: None,
            browse_url: None,
        };
        let debug = format!("{:?}", c);
        assert!(debug.contains("Citation"));
    }
}
