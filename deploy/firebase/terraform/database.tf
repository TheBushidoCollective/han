# Postgres 16. The edition must be ENTERPRISE: Postgres 16 defaults to
# ENTERPRISE_PLUS, which rejects db-f1-micro.
resource "google_sql_database_instance" "han" {
  name                = "han-pg"
  database_version    = "POSTGRES_16"
  region              = var.region
  deletion_protection = true

  settings {
    tier    = var.db_tier
    edition = "ENTERPRISE"

    backup_configuration {
      enabled = true
    }

    ip_configuration {
      # Cloud Run reaches the database over the Cloud SQL unix socket, which
      # needs no authorized networks. ENCRYPTED_ONLY rejects plaintext clients.
      ipv4_enabled = true
      ssl_mode     = "ENCRYPTED_ONLY"
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_sql_database" "han_team" {
  name     = "han_team"
  instance = google_sql_database_instance.han.name
}

# Ephemeral: generated per apply, never written to state or plan. The same
# value goes to the SQL user (password_wo) and to the database-url secret,
# and both are versioned together.
ephemeral "random_password" "db" {
  length  = 40
  special = false
}

resource "google_sql_user" "han" {
  name                = "han"
  instance            = google_sql_database_instance.han.name
  password_wo         = ephemeral.random_password.db.result
  password_wo_version = 1
}
