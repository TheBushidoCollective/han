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

    #[test]
    fn test_addr_default_port() {
        let config = Config {
            database_url: String::new(),
            jwt_secret: "x".repeat(32),
            port: 8080,
            github_client_id: String::new(),
            github_client_secret: String::new(),
            public_url: String::new(),
            stripe_secret_key: String::new(),
            stripe_webhook_secret: String::new(),
            master_kek: String::new(),
            stripe_pro_monthly_price_id: String::new(),
            stripe_pro_yearly_price_id: String::new(),
            cors_origins: vec![],
        };

        let addr = config.addr();
        assert_eq!(addr.port(), 8080);
        assert_eq!(addr.ip().to_string(), "0.0.0.0");
    }

    #[test]
    fn test_addr_custom_port() {
        let config = Config {
            database_url: String::new(),
            jwt_secret: "x".repeat(32),
            port: 3000,
            github_client_id: String::new(),
            github_client_secret: String::new(),
            public_url: String::new(),
            stripe_secret_key: String::new(),
            stripe_webhook_secret: String::new(),
            master_kek: String::new(),
            stripe_pro_monthly_price_id: String::new(),
            stripe_pro_yearly_price_id: String::new(),
            cors_origins: vec![],
        };

        assert_eq!(config.addr().port(), 3000);
    }
}
