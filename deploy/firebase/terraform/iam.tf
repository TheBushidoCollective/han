# Every grant here is on one Han resource. There are no project-level grants:
# those are human bootstrap (PATH.md section 8), so the apply identity cannot
# change project policy.
#
# Identities are created once by a human. Terraform only reads them.
data "google_service_account" "server_run" {
  project    = var.project_id
  account_id = "han-server-run"
}

data "google_service_account" "deployer" {
  project    = var.project_id
  account_id = "han-deployer"
}

data "google_service_account" "hosting_deployer" {
  project    = var.project_id
  account_id = "han-hosting-deployer"
}

locals {
  han_secrets = {
    database_url         = google_secret_manager_secret.database_url.secret_id
    jwt_secret           = google_secret_manager_secret.jwt_secret.secret_id
    master_kek           = google_secret_manager_secret.master_kek.secret_id
    github_client_secret = google_secret_manager_secret.github_client_secret.secret_id
    stripe_secret_key    = google_secret_manager_secret.stripe_secret_key.secret_id
    stripe_webhook       = google_secret_manager_secret.stripe_webhook_secret.secret_id
  }
}

# Deploy-time check only: the precheck lists versions, and never reads payloads.
resource "google_secret_manager_secret_iam_member" "deployer_secret_viewer" {
  for_each  = local.han_secrets
  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.viewer"
  member    = "serviceAccount:${data.google_service_account.deployer.email}"
}

# The runtime reads its six secrets. Nothing else in the project is in reach.
resource "google_secret_manager_secret_iam_member" "server_run_secret" {
  for_each  = local.han_secrets
  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${data.google_service_account.server_run.email}"
}

# Plan may read secret metadata for refresh, through a conditioned custom role
# granted in bootstrap. It never receives a secret accessor role.
