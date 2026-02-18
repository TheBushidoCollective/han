//! Sentiment analysis GraphQL type.

use async_graphql::*;
use crate::node::encode_global_id;

/// Sentiment analysis result for a user message.
#[derive(Debug, Clone)]
pub struct SentimentAnalysis {
    pub raw_id: String,
    pub sentiment_score: Option<f64>,
    pub sentiment_level: Option<String>,
    pub frustration_score: Option<f64>,
    pub frustration_level: Option<String>,
    pub signals: Option<Vec<String>>,
}

#[Object]
impl SentimentAnalysis {
    async fn id(&self) -> ID {
        encode_global_id("SentimentAnalysis", &self.raw_id)
    }

    async fn sentiment_score(&self) -> Option<f64> {
        self.sentiment_score
    }

    async fn sentiment_level(&self) -> Option<&str> {
        self.sentiment_level.as_deref()
    }

    async fn frustration_score(&self) -> Option<f64> {
        self.frustration_score
    }

    async fn frustration_level(&self) -> Option<&str> {
        self.frustration_level.as_deref()
    }

    async fn signals(&self) -> Option<&Vec<String>> {
        self.signals.as_ref()
    }
}

impl Default for SentimentAnalysis {
    fn default() -> Self {
        Self {
            raw_id: String::new(),
            sentiment_score: None,
            sentiment_level: None,
            frustration_score: None,
            frustration_level: None,
            signals: None,
        }
    }
}
