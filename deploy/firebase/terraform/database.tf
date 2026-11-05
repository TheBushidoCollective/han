# Cloud SQL instance han-pg. The bootstrap creates it once with the same settings
# (PATH.md section 8). This import brings it under Terraform, which then owns its
# settings. The database han_team and the user han belong to the bootstrap, which
# also seeds their password into database-url. Terraform holds no database or user
# permission, so it cannot read or change either.
import {
  to = google_sql_database_instance.han
  id = "projects/${var.project_id}/instances/han-pg"
}

# Postgres 16 defaults to ENTERPRISE_PLUS, which rejects db-f1-micro, so the
# edition is set explicitly. The bootstrap passes the same edition to gcloud.
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

    # Cloud SQL's own deletion protection, separate from Terraform's prevent_destroy
    # above. The bootstrap also creates the instance with --deletion-protection. Without
    # this, the first plan after import would set it to false (PATH.md section 8).
    deletion_protection_enabled = true

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
