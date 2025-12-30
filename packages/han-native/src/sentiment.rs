//! Sentiment analysis for user messages
//!
//! Uses VADER sentiment analysis with additional frustration indicators
//! similar to the TypeScript detect-frustration.ts implementation.

use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};
use vader_sentiment::SentimentIntensityAnalyzer;

// Pre-compiled regexes - compiled once at startup, None if compilation fails
static CAPS_REGEX: Lazy<Option<Regex>> = Lazy::new(|| Regex::new(r"[A-Z]{5,}").ok());
static PUNCT_REGEX: Lazy<Option<Regex>> = Lazy::new(|| Regex::new(r"[!?]{2,}").ok());
static NEG_CMD_REGEX: Lazy<Option<Regex>> =
    Lazy::new(|| Regex::new(r"(?i)\b(stop|quit|never mind|forget it|give up)\b").ok());

/// Sentiment level categorization
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SentimentLevel {
    Positive,
    Neutral,
    Negative,
}

impl SentimentLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            SentimentLevel::Positive => "positive",
            SentimentLevel::Neutral => "neutral",
            SentimentLevel::Negative => "negative",
        }
    }
}

/// Frustration level categorization
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FrustrationLevel {
    Low,
    Moderate,
    High,
}

impl FrustrationLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            FrustrationLevel::Low => "low",
            FrustrationLevel::Moderate => "moderate",
            FrustrationLevel::High => "high",
        }
    }
}

/// Result of sentiment analysis on a message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SentimentResult {
    /// Raw VADER compound score (-1 to 1)
    pub sentiment_score: f64,
    /// Categorized sentiment level
    pub sentiment_level: SentimentLevel,
    /// Frustration score (0-10) if frustration detected
    pub frustration_score: Option<f64>,
    /// Frustration level if detected
    pub frustration_level: Option<FrustrationLevel>,
    /// Detected signals
    pub signals: Vec<String>,
}

/// Analyze sentiment of a message
pub fn analyze_sentiment(message: &str) -> Option<SentimentResult> {
    let trimmed = message.trim();
    if trimmed.is_empty() {
        return None;
    }

    // Use VADER for base sentiment analysis
    let analyzer = SentimentIntensityAnalyzer::new();
    let scores = analyzer.polarity_scores(trimmed);

    // VADER compound score is -1 to 1
    // Convert to -5 to 5 scale for consistency with TypeScript version
    let sentiment_score = scores.get("compound").copied().unwrap_or(0.0) * 5.0;

    // Determine sentiment level
    let sentiment_level = if sentiment_score > 0.5 {
        SentimentLevel::Positive
    } else if sentiment_score < -0.5 {
        SentimentLevel::Negative
    } else {
        SentimentLevel::Neutral
    };

    // Check for additional frustration indicators
    let mut signals = Vec::new();
    let mut additional_score = 0.0;

    // ALL CAPS detection (5+ consecutive uppercase letters)
    if let Some(ref regex) = *CAPS_REGEX {
        if regex.is_match(trimmed) {
            signals.push("ALL CAPS detected".to_string());
            additional_score += 2.0;
        }
    }

    // Multiple punctuation (!! or ??)
    if let Some(ref regex) = *PUNCT_REGEX {
        if regex.is_match(trimmed) {
            signals.push("Multiple punctuation marks (!!!/???)".to_string());
            additional_score += 1.0;
        }
    }

    // Terse message (less than 15 chars, no spaces, not empty)
    let is_terse = trimmed.len() < 15 && !trimmed.contains(' ');
    if is_terse {
        signals.push("Very terse message".to_string());
        additional_score += 1.0;
    }

    // Repeated words (check adjacent duplicate words without regex backreferences)
    let words: Vec<&str> = trimmed
        .split_whitespace()
        .map(|w| w.trim_matches(|c: char| !c.is_alphanumeric()))
        .filter(|w| !w.is_empty())
        .collect();
    let mut repeated_count = 0;
    for window in words.windows(2) {
        if window[0].eq_ignore_ascii_case(window[1]) {
            repeated_count += 1;
        }
    }
    if repeated_count > 0 {
        signals.push(format!("{} repeated word(s)", repeated_count));
        additional_score += repeated_count as f64;
    }

    // Negative commands
    if let Some(ref regex) = *NEG_CMD_REGEX {
        let neg_cmd_count = regex.find_iter(trimmed).count();
        if neg_cmd_count > 0 {
            signals.push(format!("{} negative command(s)", neg_cmd_count));
            additional_score += neg_cmd_count as f64 * 2.0;
        }
    }

    // Add negative words signal if sentiment is negative
    let neg_score = scores.get("neg").copied().unwrap_or(0.0);
    if neg_score > 0.1 {
        signals.push(format!("Negative sentiment (score: {:.2})", sentiment_score));
    }

    // Calculate frustration score
    // Base: convert negative sentiment to 0-5 scale (more negative = higher frustration)
    let base_frustration = if sentiment_score < 0.0 {
        (-sentiment_score / 5.0) * 5.0
    } else {
        0.0
    };
    let total_frustration = base_frustration + additional_score;

    // Determine if frustration was detected
    const FRUSTRATION_THRESHOLD: f64 = 2.0;
    let (frustration_score, frustration_level) = if total_frustration >= FRUSTRATION_THRESHOLD || sentiment_score <= -2.0 {
        let level = if total_frustration >= 6.0 || sentiment_score <= -4.0 {
            FrustrationLevel::High
        } else if total_frustration >= 3.0 || sentiment_score <= -3.0 {
            FrustrationLevel::Moderate
        } else {
            FrustrationLevel::Low
        };
        (Some(total_frustration), Some(level))
    } else {
        (None, None)
    };

    Some(SentimentResult {
        sentiment_score,
        sentiment_level,
        frustration_score,
        frustration_level,
        signals,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_positive_sentiment() {
        let result = analyze_sentiment("This is great! I love it!").unwrap();
        assert_eq!(result.sentiment_level, SentimentLevel::Positive);
        assert!(result.sentiment_score > 0.0);
    }

    #[test]
    fn test_negative_sentiment() {
        let result = analyze_sentiment("This is terrible and I hate it").unwrap();
        assert_eq!(result.sentiment_level, SentimentLevel::Negative);
        assert!(result.sentiment_score < 0.0);
    }

    #[test]
    fn test_caps_detection() {
        let result = analyze_sentiment("WHY IS THIS NOT WORKING").unwrap();
        assert!(result.signals.iter().any(|s| s.contains("CAPS")));
    }

    #[test]
    fn test_punctuation_detection() {
        let result = analyze_sentiment("What is going on???").unwrap();
        assert!(result.signals.iter().any(|s| s.contains("punctuation")));
    }

    #[test]
    fn test_negative_command() {
        let result = analyze_sentiment("Just stop. Forget it.").unwrap();
        assert!(result.signals.iter().any(|s| s.contains("negative command")));
        assert!(result.frustration_level.is_some());
    }

    #[test]
    fn test_terse_message() {
        let result = analyze_sentiment("no").unwrap();
        assert!(result.signals.iter().any(|s| s.contains("terse")));
    }

    #[test]
    fn test_empty_message() {
        assert!(analyze_sentiment("").is_none());
        assert!(analyze_sentiment("   ").is_none());
    }
}
