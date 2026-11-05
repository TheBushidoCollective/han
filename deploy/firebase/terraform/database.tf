# Postgres 16. The edition must be ENTERPRISE: Postgres 16 defaults to
# ENTERPRISE_PLUS, which rejects db-f1-micro.
resource "google_sql_database_instance" "han" {
  name                = "han-pg"
  database_version    = "POSTGRES_16"
  region              = var.region
  deletion_protection = true

  depends_on = [google_project_service.apis]

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
  name       = "han_team"
  instance   = google_sql_database_instance.han.name
  depends_on = [google_project_service.apis]
}

# The database password is one ephemeral value per apply. It reaches two
# places: the SQL user's password, and the database-url secret version. The
# two must always agree. Both are tied to var.db_credential_version, so both are
# rewritten together whenever that version changes.
ephemeral "random_password" "db" {
  length  = 40
  special = false
}

resource "google_sql_user" "han" {
  name                = "han"
  instance            = google_sql_database_instance.han.name
  password_wo         = ephemeral.random_password.db.result
  password_wo_version = var.db_credential_version

  # Written after the secret version, so the password never changes in the
  # database before the secret that holds it exists.
  depends_on = [google_secret_manager_secret_version.database_url]
}
