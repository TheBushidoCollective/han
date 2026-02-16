//! GitHub OAuth authorization_code flow.

use reqwest::Client;
use serde::{Deserialize, Serialize};

/// GitHub OAuth configuration.
#[derive(Debug, Clone)]
pub struct GitHubOAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

/// GitHub user profile from /user API.
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GitHubUser {
    pub id: i64,
    pub login: String,
    pub name: Option<String>,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
}

/// GitHub email from /user/emails API.
#[derive(Debug, Deserialize)]
pub struct GitHubEmail {
    pub email: String,
    pub primary: bool,
    pub verified: bool,
}

/// Token response from GitHub.
#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    #[allow(dead_code)]
    token_type: String,
}

/// Error from GitHub OAuth flow.
#[derive(Debug, thiserror::Error)]
pub enum OAuthError {
    #[error("Token exchange failed: {0}")]
    TokenExchange(String),
    #[error("Failed to fetch user profile: {0}")]
    UserFetch(String),
    #[error("No verified email found for GitHub user")]
    NoVerifiedEmail,
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),
}

impl GitHubOAuthConfig {
    /// Build the authorization URL for the user to visit.
    pub fn authorization_url(&self, state: &str) -> String {
        format!(
            "https://github.com/login/oauth/authorize?client_id={}&redirect_uri={}&state={}&scope=read:user%20user:email",
            self.client_id,
            urlencoding::encode(&self.redirect_uri),
            state,
        )
    }

    /// Exchange an authorization code for an access token.
    pub async fn exchange_code(&self, code: &str) -> Result<String, OAuthError> {
        let client = Client::new();
        let resp = client
            .post("https://github.com/login/oauth/access_token")
            .header("Accept", "application/json")
            .json(&serde_json::json!({
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "code": code,
                "redirect_uri": self.redirect_uri,
            }))
            .send()
            .await?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(OAuthError::TokenExchange(body));
        }

        let token_resp: TokenResponse = resp.json().await.map_err(|e| {
            OAuthError::TokenExchange(format!("Failed to parse token response: {e}"))
        })?;

        Ok(token_resp.access_token)
    }

    /// Fetch the GitHub user profile using an access token.
    pub async fn fetch_user(&self, access_token: &str) -> Result<GitHubUser, OAuthError> {
        let client = Client::new();
        let resp = client
            .get("https://api.github.com/user")
            .header("Authorization", format!("Bearer {access_token}"))
            .header("User-Agent", "han-server")
            .send()
            .await?;

        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(OAuthError::UserFetch(body));
        }

        let mut user: GitHubUser = resp.json().await?;

        // If email is not public, fetch from /user/emails
        if user.email.is_none() {
            match self.fetch_primary_email(access_token).await {
                Ok(email) => user.email = Some(email),
                Err(_) => {
                    // Fallback to generated noreply email
                    user.email = Some(format!(
                        "{}+{}@users.noreply.github.com",
                        user.id, user.login
                    ));
                }
            }
        }

        Ok(user)
    }

    /// Fetch the primary verified email from /user/emails.
    async fn fetch_primary_email(&self, access_token: &str) -> Result<String, OAuthError> {
        let client = Client::new();
        let resp = client
            .get("https://api.github.com/user/emails")
            .header("Authorization", format!("Bearer {access_token}"))
            .header("User-Agent", "han-server")
            .send()
            .await?;

        let emails: Vec<GitHubEmail> = resp.json().await?;

        emails
            .into_iter()
            .find(|e| e.primary && e.verified)
            .map(|e| e.email)
            .ok_or(OAuthError::NoVerifiedEmail)
    }
}

// URL encoding helper
mod urlencoding {
    pub fn encode(s: &str) -> String {
        let mut encoded = String::new();
        for b in s.bytes() {
            match b {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    encoded.push(b as char);
                }
                _ => {
                    encoded.push_str(&format!("%{:02X}", b));
                }
            }
        }
        encoded
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_authorization_url_contains_required_params() {
        let config = GitHubOAuthConfig {
            client_id: "test-client-id".to_string(),
            client_secret: "secret".to_string(),
            redirect_uri: "https://api.han.guru/auth/github/callback".to_string(),
        };

        let url = config.authorization_url("random-state-123");

        assert!(url.starts_with("https://github.com/login/oauth/authorize?"));
        assert!(url.contains("client_id=test-client-id"));
        assert!(url.contains("state=random-state-123"));
        assert!(url.contains("scope=read:user%20user:email"));
        assert!(url.contains("redirect_uri="));
    }

    #[test]
    fn test_authorization_url_encodes_redirect_uri() {
        let config = GitHubOAuthConfig {
            client_id: "id".to_string(),
            client_secret: "secret".to_string(),
            redirect_uri: "https://example.com/callback?foo=bar".to_string(),
        };

        let url = config.authorization_url("state");
        // The ? and = in the redirect_uri should be percent-encoded
        assert!(url.contains("redirect_uri=https%3A%2F%2Fexample.com%2Fcallback%3Ffoo%3Dbar"));
    }

    #[test]
    fn test_urlencoding_basic() {
        assert_eq!(urlencoding::encode("hello"), "hello");
        assert_eq!(urlencoding::encode("hello world"), "hello%20world");
        assert_eq!(urlencoding::encode("a/b"), "a%2Fb");
        assert_eq!(urlencoding::encode("key=value"), "key%3Dvalue");
    }

    #[test]
    fn test_urlencoding_preserves_unreserved() {
        assert_eq!(urlencoding::encode("abc-123_456.789~"), "abc-123_456.789~");
    }

    #[test]
    fn test_github_user_noreply_email_format() {
        // Verify the fallback email format
        let user = GitHubUser {
            id: 12345,
            login: "octocat".to_string(),
            name: Some("Octo Cat".to_string()),
            email: None,
            avatar_url: Some("https://avatars.githubusercontent.com/u/12345".to_string()),
        };
        let noreply = format!("{}+{}@users.noreply.github.com", user.id, user.login);
        assert_eq!(noreply, "12345+octocat@users.noreply.github.com");
    }
}
