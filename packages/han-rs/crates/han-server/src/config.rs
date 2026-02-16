//! Server configuration from environment variables.

use std::net::SocketAddr;

/// Server configuration loaded from environment.
#[derive(Debug, Clone)]
pub struct Config {
    /// PostgreSQL connection URL.
    pub database_url: String,
    /// JWT signing secret (min 32 chars).
    pub jwt_secret: String,
    /// Server listen port.
    pub port: u16,
    /// GitHub OAuth client ID.
    pub github_client_id: String,
    /// GitHub OAuth client secret.
    pub github_client_secret: String,
    /// Public URL for OAuth callbacks (e.g. https://api.han.guru).
    pub public_url: String,
    /// Stripe API secret key.
    pub stripe_secret_key: String,
    /// Stripe webhook signing secret.
    pub stripe_webhook_secret: String,
    /// Master key encryption key (base64-encoded, 32 bytes).
    pub master_kek: String,
    /// Stripe Pro monthly price ID.
    pub stripe_pro_monthly_price_id: String,
    /// Stripe Pro yearly price ID.
    pub stripe_pro_yearly_price_id: String,
    /// CORS allowed origins (comma-separated).
    pub cors_origins: Vec<String>,
}

impl Config {
    /// Load configuration from environment variables.
    pub fn from_env() -> Result<Self, String> {
        let database_url = require_env("DATABASE_URL")?;
        let jwt_secret = require_env("JWT_SECRET")?;
        if jwt_secret.len() < 32 {
            return Err("JWT_SECRET must be at least 32 characters".into());
        }

        let port = std::env::var("PORT")
            .unwrap_or_else(|_| "8080".into())
            .parse::<u16>()
            .map_err(|e| format!("Invalid PORT: {e}"))?;

        let github_client_id = require_env("GITHUB_CLIENT_ID")?;
        let github_client_secret = require_env("GITHUB_CLIENT_SECRET")?;
        let public_url = require_env("PUBLIC_URL")?;
        let stripe_secret_key = require_env("STRIPE_SECRET_KEY")?;
        let stripe_webhook_secret = require_env("STRIPE_WEBHOOK_SECRET")?;
        let master_kek = require_env("MASTER_KEK")?;
        let stripe_pro_monthly_price_id =
            std::env::var("STRIPE_PRO_MONTHLY_PRICE_ID").unwrap_or_default();
        let stripe_pro_yearly_price_id =
            std::env::var("STRIPE_PRO_YEARLY_PRICE_ID").unwrap_or_default();

        let cors_origins = std::env::var("CORS_ORIGINS")
            .unwrap_or_else(|_| "https://dashboard.han.guru".into())
            .split(',')
            .map(|s| s.trim().to_string())
            .collect();

        Ok(Self {
            database_url,
            jwt_secret,
            port,
            github_client_id,
            github_client_secret,
            public_url,
            stripe_secret_key,
            stripe_webhook_secret,
            master_kek,
            stripe_pro_monthly_price_id,
            stripe_pro_yearly_price_id,
            cors_origins,
        })
    }

    /// Socket address to bind to.
    pub fn addr(&self) -> SocketAddr {
        SocketAddr::from(([0, 0, 0, 0], self.port))
    }
}

fn require_env(name: &str) -> Result<String, String> {
    std::env::var(name).map_err(|_| format!("Missing required environment variable: {name}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper to build a Config struct directly (no env vars needed).
    fn make_config(port: u16) -> Config {
        Config {
            database_url: String::new(),
            jwt_secret: "x".repeat(32),
            port,
            github_client_id: String::new(),
            github_client_secret: String::new(),
            public_url: String::new(),
            stripe_secret_key: String::new(),
            stripe_webhook_secret: String::new(),
            master_kek: String::new(),
            stripe_pro_monthly_price_id: String::new(),
            stripe_pro_yearly_price_id: String::new(),
            cors_origins: vec![],
        }
    }

    #[test]
    fn test_addr_default_port() {
        let config = make_config(8080);
        let addr = config.addr();
        assert_eq!(addr.port(), 8080);
        assert_eq!(addr.ip().to_string(), "0.0.0.0");
    }

    #[test]
    fn test_addr_custom_port() {
        let config = make_config(3000);
        assert_eq!(config.addr().port(), 3000);
    }

    #[test]
    fn test_addr_returns_correct_socket_addr() {
        let config = make_config(4000);
        let addr = config.addr();
        assert_eq!(addr.port(), 4000);
        assert!(addr.ip().is_unspecified(), "should bind to 0.0.0.0");
    }

    /// Helper to set all required env vars for Config::from_env.
    fn set_required_env_vars() {
        std::env::set_var("DATABASE_URL", "postgres://localhost/test");
        std::env::set_var("JWT_SECRET", "abcdefghijklmnopqrstuvwxyz012345");
        std::env::set_var("GITHUB_CLIENT_ID", "test_client_id");
        std::env::set_var("GITHUB_CLIENT_SECRET", "test_client_secret");
        std::env::set_var("PUBLIC_URL", "https://api.example.com");
        std::env::set_var("STRIPE_SECRET_KEY", "sk_test_123");
        std::env::set_var("STRIPE_WEBHOOK_SECRET", "whsec_test_123");
        std::env::set_var("MASTER_KEK", "dGVzdC1tYXN0ZXIta2VrLWJhc2U2NC1lbmNvZGVk");
    }

    /// Helper to remove all env vars so tests don't leak state.
    fn clear_env_vars() {
        for var in &[
            "DATABASE_URL",
            "JWT_SECRET",
            "PORT",
            "GITHUB_CLIENT_ID",
            "GITHUB_CLIENT_SECRET",
            "PUBLIC_URL",
            "STRIPE_SECRET_KEY",
            "STRIPE_WEBHOOK_SECRET",
            "MASTER_KEK",
            "CORS_ORIGINS",
            "STRIPE_PRO_MONTHLY_PRICE_ID",
            "STRIPE_PRO_YEARLY_PRICE_ID",
            "HAN_TEST_REQUIRE_ENV",
        ] {
            std::env::remove_var(var);
        }
    }

    /// All env-based Config tests run sequentially within a single #[test]
    /// to avoid race conditions from parallel test threads sharing the
    /// process environment. Each sub-test clears env vars before and after.
    #[test]
    fn test_config_from_env_scenarios() {
        // --- Scenario: valid env vars with custom port ---
        clear_env_vars();
        set_required_env_vars();
        std::env::set_var("PORT", "9090");

        let config = Config::from_env().expect("should parse valid env vars");
        assert_eq!(config.database_url, "postgres://localhost/test");
        assert_eq!(config.port, 9090);
        assert_eq!(config.github_client_id, "test_client_id");
        assert_eq!(config.public_url, "https://api.example.com");

        // --- Scenario: default port when PORT is unset ---
        clear_env_vars();
        set_required_env_vars();

        let config = Config::from_env().expect("should use default port");
        assert_eq!(config.port, 8080);

        // --- Scenario: missing DATABASE_URL ---
        clear_env_vars();
        set_required_env_vars();
        std::env::remove_var("DATABASE_URL");

        let result = Config::from_env();
        assert!(result.is_err());
        assert!(
            result.unwrap_err().contains("DATABASE_URL"),
            "error should mention DATABASE_URL"
        );

        // --- Scenario: JWT_SECRET too short ---
        clear_env_vars();
        set_required_env_vars();
        std::env::set_var("JWT_SECRET", "short");

        let result = Config::from_env();
        assert!(result.is_err());
        assert!(
            result.unwrap_err().contains("at least 32 characters"),
            "error should mention minimum length"
        );

        // --- Scenario: JWT_SECRET exactly 32 chars (boundary) ---
        clear_env_vars();
        set_required_env_vars();
        std::env::set_var("JWT_SECRET", &"x".repeat(32));

        let config = Config::from_env().expect("32 chars should be valid");
        assert_eq!(config.jwt_secret.len(), 32);

        // --- Scenario: CORS origins comma-separated with whitespace ---
        clear_env_vars();
        set_required_env_vars();
        std::env::set_var("CORS_ORIGINS", "https://a.com, https://b.com , https://c.com");

        let config = Config::from_env().expect("should parse CORS origins");
        assert_eq!(config.cors_origins.len(), 3);
        assert_eq!(config.cors_origins[0], "https://a.com");
        assert_eq!(config.cors_origins[1], "https://b.com");
        assert_eq!(config.cors_origins[2], "https://c.com");

        // --- Scenario: CORS origins default value ---
        clear_env_vars();
        set_required_env_vars();

        let config = Config::from_env().expect("should use default CORS origin");
        assert_eq!(config.cors_origins, vec!["https://dashboard.han.guru"]);

        // --- Scenario: require_env with missing var ---
        clear_env_vars();
        let result = require_env("TOTALLY_NONEXISTENT_VAR_12345");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("TOTALLY_NONEXISTENT_VAR_12345"));

        // --- Scenario: require_env with present var ---
        std::env::set_var("HAN_TEST_REQUIRE_ENV", "hello");
        let result = require_env("HAN_TEST_REQUIRE_ENV");
        assert_eq!(result.unwrap(), "hello");

        // Final cleanup
        clear_env_vars();
    }
}
