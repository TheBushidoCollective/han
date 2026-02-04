//! Sentiment analysis for user messages
//!
//! Uses VADER sentiment analysis with additional frustration indicators
//! similar to the TypeScript detect-frustration.ts implementation.

use once_cell::sync::Lazy;
use regex::Regex;
use serde::{Deserialize, Serialize};
use vader_sentiment::SentimentIntensityAnalyzer;

// Pre-compiled regexes - compiled once at startup, None if compilation fails
//
// CAPS_REGEX: Match 5+ consecutive uppercase letters as word (with boundaries)
// Used as fallback when consecutive caps word detection doesn't trigger.
// Note: Single acronyms (HTTPS, README) won't trigger frustration because we
// require 2+ consecutive ALL CAPS words for detection. This regex is only used
// as a fallback for single long shouted words like "NOOOOOO".
static CAPS_REGEX: Lazy<Option<Regex>> = Lazy::new(|| Regex::new(r"\b[A-Z]{5,}\b").ok());
// ENV_VAR_REGEX: Match common environment variable patterns (UPPER_CASE_WITH_UNDERSCORES)
// Examples: CLAUDE_SESSION_ID, GITHUB_PAT, DATABASE_URL, API_KEY
static ENV_VAR_REGEX: Lazy<Option<Regex>> =
    Lazy::new(|| Regex::new(r"\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b").ok());
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

    // ALL CAPS detection
    // First, strip out environment variable patterns to avoid false positives
    // Env vars like CLAUDE_SESSION_ID, GITHUB_PAT, DATABASE_URL should not trigger
    let text_without_env_vars = if let Some(ref env_regex) = *ENV_VAR_REGEX {
        env_regex.replace_all(trimmed, "").to_string()
    } else {
        trimmed.to_string()
    };

    // Check for multiple consecutive ALL CAPS words (stronger signal than single word)
    // "THIS REALLY SUCKS" (3 caps words) is more frustrated than "WOOSH" (1 word)
    // Find longest run of consecutive caps words
    let mut max_consecutive_caps = 0;
    let mut current_run = 0;
    for word in text_without_env_vars.split_whitespace() {
        let clean = word.trim_matches(|c: char| !c.is_alphanumeric());
        if clean.len() >= 2
            && clean
                .chars()
                .all(|c| c.is_uppercase() || !c.is_alphabetic())
        {
            current_run += 1;
            max_consecutive_caps = max_consecutive_caps.max(current_run);
        } else {
            current_run = 0;
        }
    }

    // Score based on consecutive caps words (stronger signal)
    // BUT only if sentiment is not positive - "THIS IS AMAZING" is excitement, not frustration
    let is_positive_sentiment = sentiment_score > 0.5;

    if max_consecutive_caps >= 3 && !is_positive_sentiment {
        signals.push(format!(
            "{} consecutive ALL CAPS words",
            max_consecutive_caps
        ));
        additional_score += 3.0 + (max_consecutive_caps as f64 - 3.0) * 0.5;
    } else if max_consecutive_caps == 2 && !is_positive_sentiment {
        signals.push("2 consecutive ALL CAPS words".to_string());
        additional_score += 2.5;
    } else if !is_positive_sentiment {
        if let Some(ref regex) = *CAPS_REGEX {
            // Fall back to single word with 5+ letters detection
            if regex.is_match(&text_without_env_vars) {
                signals.push("ALL CAPS word detected".to_string());
                additional_score += 2.0;
            }
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
        signals.push(format!(
            "Negative sentiment (score: {:.2})",
            sentiment_score
        ));
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
    let (frustration_score, frustration_level) =
        if total_frustration >= FRUSTRATION_THRESHOLD || sentiment_score <= -2.0 {
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
    fn test_env_vars_not_detected_as_caps() {
        // Environment variables should NOT trigger ALL CAPS detection
        let result = analyze_sentiment("Set the CLAUDE_SESSION_ID variable").unwrap();
        assert!(
            !result.signals.iter().any(|s| s.contains("CAPS")),
            "CLAUDE_SESSION_ID should not trigger ALL CAPS"
        );

        let result = analyze_sentiment("Check GITHUB_PAT and DATABASE_URL").unwrap();
        assert!(
            !result.signals.iter().any(|s| s.contains("CAPS")),
            "Multiple env vars should not trigger ALL CAPS"
        );

        let result = analyze_sentiment("The API_KEY is in .env").unwrap();
        assert!(
            !result.signals.iter().any(|s| s.contains("CAPS")),
            "API_KEY should not trigger ALL CAPS"
        );
    }

    #[test]
    fn test_real_shouting_still_detected() {
        // Actual shouting should still be detected even with env vars present
        // Need 5+ consecutive uppercase letters to trigger (e.g., "WRONG", "BROKEN", "WORKING")
        let result = analyze_sentiment("THIS IS TOTALLY WRONG and check GITHUB_PAT").unwrap();
        assert!(
            result.signals.iter().any(|s| s.contains("CAPS")),
            "Real shouting (TOTALLY, WRONG) should still trigger even with env vars"
        );
    }

    #[test]
    fn test_punctuation_detection() {
        let result = analyze_sentiment("What is going on???").unwrap();
        assert!(result.signals.iter().any(|s| s.contains("punctuation")));
    }

    #[test]
    fn test_negative_command() {
        let result = analyze_sentiment("Just stop. Forget it.").unwrap();
        assert!(result
            .signals
            .iter()
            .any(|s| s.contains("negative command")));
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

    #[test]
    fn test_multiple_caps_words_higher_signal() {
        // Multiple consecutive caps words should have higher frustration than single word
        let single = analyze_sentiment("That's WRONG").unwrap();
        let multiple = analyze_sentiment("THIS IS SO WRONG").unwrap();

        // Multiple caps should have higher frustration score
        let single_score = single.frustration_score.unwrap_or(0.0);
        let multiple_score = multiple.frustration_score.unwrap_or(0.0);
        assert!(
            multiple_score > single_score,
            "Multiple caps words ({}) should score higher than single ({})",
            multiple_score,
            single_score
        );
        assert!(multiple.signals.iter().any(|s| s.contains("consecutive")));
    }

    #[test]
    fn test_positive_shouting_not_frustration() {
        // Positive shouting like "THIS IS AMAZING" should NOT trigger frustration
        let result = analyze_sentiment("THIS IS AMAZING! I LOVE IT!").unwrap();
        assert_eq!(result.sentiment_level, SentimentLevel::Positive);
        assert!(
            !result.signals.iter().any(|s| s.contains("CAPS")),
            "Positive shouting should not trigger CAPS frustration signal"
        );
        assert!(
            result.frustration_level.is_none(),
            "Positive shouting should not have frustration"
        );
    }

    #[test]
    fn test_negative_shouting_is_frustration() {
        // Negative shouting should still be frustration
        let result = analyze_sentiment("THIS REALLY SUCKS").unwrap();
        assert!(
            result.signals.iter().any(|s| s.contains("CAPS")),
            "Negative shouting should trigger CAPS signal"
        );
        assert!(result.frustration_level.is_some());
    }
}
