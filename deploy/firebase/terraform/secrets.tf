# Han secrets, every name prefixed han-server-. The bootstrap creates them, empty,
# with their IAM (PATH.md section 8). Terraform reads two, jwt-secret and
# master-kek, and writes their versions. It creates, updates and deletes no secret,
# and it changes no secret's IAM. So the apply identity holds no create, delete or
# setIamPolicy permission.
#
# database-url is not managed here. The bootstrap seeds it with the password of the
# han database user, in one ordered run (bootstrap/bootstrap.py, provision_database).
#
# Values are set from ephemeral generators or written by an operator out of band,
# and never appear in state. The apply identity writes these under
# deploy/firebase/bootstrap/roles/han_tf_apply_secrets.yaml, which has no
# secretmanager.versions.access, so it cannot read a payload.
#
# Not verified: that the provider never reads a write-only payload back during
# refresh. The reading is that it does not, but nothing here proves it. The first
# plan and the state guard in han-infra.yml are the check. See PATH.md section 8.

ephemeral "random_password" "jwt" {
  length  = 64
  special = false
}

ephemeral "random_bytes" "kek" {
  length = 32
}

data "google_secret_manager_secret" "jwt_secret" {
  secret_id = "${local.secret_prefix}jwt-secret"
}

data "google_secret_manager_secret" "master_kek" {
  secret_id = "${local.secret_prefix}master-kek"
}

resource "google_secret_manager_secret_version" "jwt_secret" {
  secret                 = data.google_secret_manager_secret.jwt_secret.id
  secret_data_wo         = ephemeral.random_password.jwt.result
  secret_data_wo_version = 1
}

# The master KEK encrypts synced rows. Replacing it makes every encrypted row
# unreadable, so its only version is protected from destroy, and Cloud Run pins
# version 1 (deploy-han-server.yml).
resource "google_secret_manager_secret_version" "master_kek" {
  secret                 = data.google_secret_manager_secret.master_kek.id
  secret_data_wo         = ephemeral.random_bytes.kek.base64
  secret_data_wo_version = 1

  lifecycle {
    prevent_destroy = true
  }
}

# github-client-secret, stripe-secret-key and stripe-webhook-secret are created
# empty by the bootstrap. An operator adds their values out of band (slice I and
# the Stripe step). Terraform never writes a placeholder, so the deploy refuses to
# run until a version exists.
