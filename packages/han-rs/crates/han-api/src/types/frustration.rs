//! Frustration summary GraphQL types.

use async_graphql::*;

/// Aggregated frustration metrics for a session.
#[derive(Debug, Clone, SimpleObject)]
pub struct FrustrationSummary {
    pub total_analyzed: Option<i32>,
    pub moderate_count: Option<i32>,
    pub high_count: Option<i32>,
    pub overall_level: Option<String>,
    pub average_score: Option<f64>,
    pub peak_score: Option<f64>,
    pub top_signals: Option<Vec<String>>,
}

impl Default for FrustrationSummary {
    fn default() -> Self {
        Self {
            total_analyzed: Some(0),
            moderate_count: Some(0),
            high_count: Some(0),
            overall_level: Some("none".into()),
            average_score: Some(0.0),
            peak_score: Some(0.0),
            top_signals: Some(vec![]),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frustration_summary_default() {
        let fs = FrustrationSummary::default();
        assert_eq!(fs.total_analyzed, Some(0));
        assert_eq!(fs.overall_level, Some("none".into()));
    }
}
