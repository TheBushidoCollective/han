//! JWT generation and validation using HS256.

use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

/// JWT claims payload.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    /// Subject (user ID).
    pub sub: String,
    /// Optional team ID.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub team_id: Option<String>,
    /// Token type.
    pub token_type: TokenType,
    /// Issued at (unix timestamp).
    pub iat: i64,
    /// Expiration (unix timestamp).
    pub exp: i64,
    /// Issuer.
    pub iss: String,
    /// Audience.
    pub aud: String,
}

/// Token type discriminator.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TokenType {
    Access,
    Refresh,
}

const ISSUER: &str = "han-team-platform";
const AUDIENCE: &str = "han-team-api";
const ACCESS_TOKEN_HOURS: i64 = 24;
const REFRESH_TOKEN_DAYS: i64 = 30;

/// Generate an access token for the given user.
pub fn generate_access_token(
    secret: &str,
    user_id: &str,
    team_id: Option<&str>,
) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let claims = Claims {
        sub: user_id.to_string(),
        team_id: team_id.map(|s| s.to_string()),
        token_type: TokenType::Access,
        iat: now.timestamp(),
        exp: (now + Duration::hours(ACCESS_TOKEN_HOURS)).timestamp(),
        iss: ISSUER.to_string(),
        aud: AUDIENCE.to_string(),
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

/// Generate a refresh token for the given user.
pub fn generate_refresh_token(
    secret: &str,
    user_id: &str,
) -> Result<String, jsonwebtoken::errors::Error> {
    let now = Utc::now();
    let claims = Claims {
        sub: user_id.to_string(),
        team_id: None,
        token_type: TokenType::Refresh,
        iat: now.timestamp(),
        exp: (now + Duration::days(REFRESH_TOKEN_DAYS)).timestamp(),
        iss: ISSUER.to_string(),
        aud: AUDIENCE.to_string(),
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

/// Validate a JWT and return the claims.
pub fn validate_token(secret: &str, token: &str) -> Result<Claims, jsonwebtoken::errors::Error> {
    let mut validation = Validation::default();
    validation.set_issuer(&[ISSUER]);
    validation.set_audience(&[AUDIENCE]);

    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )?;
    Ok(data.claims)
}

/// Token pair returned after authentication.
#[derive(Debug, Serialize)]
pub struct TokenPair {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: i64,
}

/// Generate a token pair (access + refresh).
pub fn generate_token_pair(
    secret: &str,
    user_id: &str,
    team_id: Option<&str>,
) -> Result<TokenPair, jsonwebtoken::errors::Error> {
    let access_token = generate_access_token(secret, user_id, team_id)?;
    let refresh_token = generate_refresh_token(secret, user_id)?;
    Ok(TokenPair {
        access_token,
        refresh_token,
        token_type: "Bearer".to_string(),
        expires_in: ACCESS_TOKEN_HOURS * 3600,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_SECRET: &str = "test-secret-that-is-at-least-32-chars-long";

    #[test]
    fn test_generate_and_validate_access_token() {
        let token = generate_access_token(TEST_SECRET, "user-123", None).unwrap();
        let claims = validate_token(TEST_SECRET, &token).unwrap();
        assert_eq!(claims.sub, "user-123");
        assert_eq!(claims.token_type, TokenType::Access);
        assert!(claims.team_id.is_none());
    }

    #[test]
    fn test_generate_and_validate_with_team() {
        let token = generate_access_token(TEST_SECRET, "user-123", Some("team-456")).unwrap();
        let claims = validate_token(TEST_SECRET, &token).unwrap();
        assert_eq!(claims.sub, "user-123");
        assert_eq!(claims.team_id.as_deref(), Some("team-456"));
    }

    #[test]
    fn test_generate_token_pair() {
        let pair = generate_token_pair(TEST_SECRET, "user-123", None).unwrap();
        assert_eq!(pair.token_type, "Bearer");
        assert_eq!(pair.expires_in, 86400);

        let access = validate_token(TEST_SECRET, &pair.access_token).unwrap();
        assert_eq!(access.token_type, TokenType::Access);

        let refresh = validate_token(TEST_SECRET, &pair.refresh_token).unwrap();
        assert_eq!(refresh.token_type, TokenType::Refresh);
    }

    #[test]
    fn test_invalid_secret_fails() {
        let token = generate_access_token(TEST_SECRET, "user-123", None).unwrap();
        let result = validate_token("wrong-secret-that-is-also-32-chars-long!", &token);
        assert!(result.is_err());
    }

    #[test]
    fn test_refresh_token_no_team() {
        let token = generate_refresh_token(TEST_SECRET, "user-123").unwrap();
        let claims = validate_token(TEST_SECRET, &token).unwrap();
        assert!(claims.team_id.is_none());
        assert_eq!(claims.token_type, TokenType::Refresh);
    }
}
