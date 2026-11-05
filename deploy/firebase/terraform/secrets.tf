# Six Han secrets, every name prefixed han-server-. Values are set from ephemeral
# generators or written by an operator out of band, and never appear in state.
#
# The apply identity creates and writes these under a custom role with no
# secretmanager.versions.access, so it cannot read a payload (permission list in
# deploy/firebase/bootstrap/roles/han_tf_apply_secrets.yaml).
#
# Not verified: that the provider never reads a write-only payload back during
# refresh. The reading is that it does not, but nothing here proves it. The
# first plan and the state guard in han-infra.yml are the check. See PATH.md
# section 8, not verified.

ephemeral "random_password" "jwt" {
  length  = 64
  special = false
}

ephemeral "random_bytes" "kek" {
  length = 32
}

resource "google_secret_manager_secret" "database_url" {
  secret_id = "${local.secret_prefix}database-url"

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
  # Same version as the SQL user. See database.tf.
  secret_data_wo_version = var.db_credential_version
}

resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "${local.secret_prefix}jwt-secret"

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
  secret_id = "${local.secret_prefix}master-kek"

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

# Created empty. An operator adds the value out of band (slice I and the Stripe
# step). Terraform never writes a placeholder, so the deploy refuses to run
# until a version exists.
resource "google_secret_manager_secret" "github_client_secret" {
  secret_id = "${local.secret_prefix}github-client-secret"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "stripe_secret_key" {
  secret_id = "${local.secret_prefix}stripe-secret-key"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "stripe_webhook_secret" {
  secret_id = "${local.secret_prefix}stripe-webhook-secret"

  replication {
    auto {}
  }
}
