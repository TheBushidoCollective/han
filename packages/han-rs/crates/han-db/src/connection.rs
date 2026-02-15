//! Database connection factory with SQLite PRAGMAs and Postgres support.

use sea_orm::{ConnectOptions, Database, DatabaseConnection, DbErr};
use std::time::Duration;

/// Database configuration supporting SQLite and PostgreSQL.
pub enum DbConfig {
    /// SQLite with file path (e.g., "~/.han/han.db")
    Sqlite { path: String },
    /// PostgreSQL with connection URL
    #[allow(dead_code)]
    Postgres { url: String },
}

impl DbConfig {
    /// Build a connection URL from the config.
    fn connection_url(&self) -> String {
        match self {
            DbConfig::Sqlite { path } => {
                if path == ":memory:" {
                    "sqlite::memory:".to_string()
                } else {
                    format!("sqlite://{}?mode=rwc", path)
                }
            }
            DbConfig::Postgres { url } => url.clone(),
        }
    }
}

/// Establish a database connection with appropriate settings.
///
/// For SQLite, configures WAL mode, NORMAL synchronous, 64MB cache,
/// foreign keys on, and 5s busy timeout.
pub async fn establish_connection(config: DbConfig) -> Result<DatabaseConnection, DbErr> {
    let url = config.connection_url();

    let mut opts = ConnectOptions::new(&url);
    opts.max_connections(5)
        .min_connections(1)
        .connect_timeout(Duration::from_secs(10))
        .idle_timeout(Duration::from_secs(300))
        .sqlx_logging(false);

    let db = Database::connect(opts).await?;

    // Apply SQLite-specific PRAGMAs
    if matches!(config, DbConfig::Sqlite { .. }) {
        apply_sqlite_pragmas(&db).await?;
    }

    Ok(db)
}

/// Apply SQLite PRAGMAs for optimal performance.
#[cfg(feature = "sqlite")]
async fn apply_sqlite_pragmas(db: &DatabaseConnection) -> Result<(), DbErr> {
    use sea_orm::{ConnectionTrait, Statement};

    let pragmas = [
        "PRAGMA journal_mode=WAL;",
        "PRAGMA synchronous=NORMAL;",
        "PRAGMA cache_size=-64000;",
        "PRAGMA foreign_keys=ON;",
        "PRAGMA busy_timeout=5000;",
    ];

    for pragma in pragmas {
        db.execute(Statement::from_string(
            sea_orm::DatabaseBackend::Sqlite,
            pragma.to_string(),
        ))
        .await?;
    }

    Ok(())
}

#[cfg(not(feature = "sqlite"))]
async fn apply_sqlite_pragmas(_db: &DatabaseConnection) -> Result<(), DbErr> {
    Ok(())
}
