# Six secrets. Generated values are set from ephemeral generators (write-only),
# so no secret value appears in state. Bump *_wo_version only together with the
# password or key it protects.
#
# The GitHub client secret and both Stripe secrets are created empty. Their
# values are added by the operator, out of band, never through Terraform.
# Stripe stays required by the server, so no dummy value is ever written.

ephemeral "random_password" "jwt" {
  length  = 64
  special = false
}

ephemeral "random_bytes" "kek" {
  length = 32
}

resource "google_secret_manager_secret" "database_url" {
  secret_id = "han-server-database-url"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "database_url" {
  secret = google_secret_manager_secret.database_url.id
  secret_data_wo = join("", [
    "postgres://han:",
    ephemeral.random_password.db.result,
    "@localhost/han_team?host=/cloudsql/",
    google_sql_database_instance.han.connection_name,
  ])
  secret_data_wo_version = 1
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "han-server-jwt-secret"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret                 = google_secret_manager_secret.jwt_secret.id
  secret_data_wo         = ephemeral.random_password.jwt.result
  secret_data_wo_version = 1
}

# The master KEK encrypts synced rows. Replacing it makes every encrypted row
# unreadable, so the secret and its only version are protected from destroy,
# and Cloud Run pins version 1 (deploy-han-server.yml).
resource "google_secret_manager_secret" "master_kek" {
  secret_id = "han-server-master-kek"

  replication {
    auto {}
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_secret_manager_secret_version" "master_kek" {
  secret                 = google_secret_manager_secret.master_kek.id
  secret_data_wo         = ephemeral.random_bytes.kek.base64
  secret_data_wo_version = 1

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_secret_manager_secret" "github_client_secret" {
  secret_id = "han-server-github-client-secret"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "stripe_secret_key" {
  secret_id = "han-server-stripe-secret-key"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "stripe_webhook_secret" {
  secret_id = "han-server-stripe-webhook-secret"

  replication {
    auto {}
  }
}
