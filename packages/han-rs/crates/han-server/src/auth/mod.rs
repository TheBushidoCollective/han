//! Authentication module: JWT, GitHub OAuth, API keys, and middleware.

pub mod api_key;
pub mod jwt;
pub mod middleware;
pub mod oauth;

#[cfg(test)]
mod tests {
    /// Verify that JWT types and functions are accessible via the auth module.
    #[test]
    fn test_jwt_api_accessible() {
        use super::jwt::{
            generate_access_token, generate_refresh_token, generate_token_pair, validate_token,
            Claims, TokenPair, TokenType,
        };

        let secret = "test-secret-that-is-at-least-32-chars-long";
        let token = generate_access_token(secret, "user-1", None).unwrap();
        let claims = validate_token(secret, &token).unwrap();
        assert_eq!(claims.sub, "user-1");
        assert_eq!(claims.token_type, TokenType::Access);

        let refresh = generate_refresh_token(secret, "user-2").unwrap();
        let refresh_claims = validate_token(secret, &refresh).unwrap();
        assert_eq!(refresh_claims.token_type, TokenType::Refresh);

        let pair: TokenPair = generate_token_pair(secret, "user-3", Some("team-1")).unwrap();
        assert_eq!(pair.token_type, "Bearer");
        assert!(pair.expires_in > 0);

        // Verify Claims derives work
        let cloned: Claims = claims.clone();
        assert_eq!(cloned.sub, "user-1");
        let debug_str = format!("{:?}", cloned);
        assert!(debug_str.contains("user-1"));
    }

    /// Verify that API key types and functions are accessible via the auth module.
    #[test]
    fn test_api_key_api_accessible() {
        use super::api_key::{generate_api_key, hash_api_key};

        let key = generate_api_key();
        assert!(key.starts_with("han_"));

        let hash = hash_api_key(&key);
        assert_eq!(hash.len(), 64); // SHA-256 hex digest
    }

    /// Verify that middleware types are accessible via the auth module.
    #[test]
    fn test_middleware_types_accessible() {
        use super::middleware::{AuthMethod, AuthUser};

        let user = AuthUser {
            user_id: "test-user".to_string(),
            team_id: Some("test-team".to_string()),
            auth_method: AuthMethod::Jwt,
        };
        let cloned = user.clone();
        assert_eq!(cloned.user_id, "test-user");
        assert_eq!(cloned.team_id.as_deref(), Some("test-team"));

        let api_user = AuthUser {
            user_id: "api-user".to_string(),
            team_id: None,
            auth_method: AuthMethod::ApiKey,
        };
        assert!(api_user.team_id.is_none());
        let debug = format!("{:?}", api_user);
        assert!(debug.contains("ApiKey"));
    }

    /// Verify that OAuth types are accessible via the auth module.
    #[test]
    fn test_oauth_types_accessible() {
        use super::oauth::{GitHubEmail, GitHubOAuthConfig, GitHubUser, OAuthError};

        let config = GitHubOAuthConfig {
            client_id: "cid".to_string(),
            client_secret: "csec".to_string(),
            redirect_uri: "https://example.com/cb".to_string(),
        };
        let url = config.authorization_url("state123");
        assert!(url.contains("client_id=cid"));
        assert!(url.contains("state=state123"));

        let user = GitHubUser {
            id: 42,
            login: "octocat".to_string(),
            name: Some("Octo Cat".to_string()),
            email: Some("octo@example.com".to_string()),
            avatar_url: None,
        };
        let cloned = user.clone();
        assert_eq!(cloned.id, 42);
        assert_eq!(cloned.login, "octocat");

        let email = GitHubEmail {
            email: "test@example.com".to_string(),
            primary: true,
            verified: true,
        };
        let debug = format!("{:?}", email);
        assert!(debug.contains("test@example.com"));

        // Verify OAuthError variants exist
        let err = OAuthError::NoVerifiedEmail;
        let err_str = format!("{}", err);
        assert!(err_str.contains("No verified email"));
    }
}
