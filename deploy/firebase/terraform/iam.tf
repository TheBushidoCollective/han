# Identities are created once by a human, per deploy/firebase/bootstrap/RUNBOOK.md.
# Terraform only reads them and binds roles to them. That keeps the apply
# identity from creating service accounts, granting itself impersonation, or
# minting keys: it has no serviceAccountAdmin role.
data "google_service_account" "server_run" {
  project    = var.project_id
  account_id = "han-server-run"
}

data "google_service_account" "deployer" {
  project    = var.project_id
  account_id = "han-deployer"
}

# Project roles the deployer needs. Every role here must appear in
# deploy/firebase/bootstrap/apply-grant-allowlist.json, and the apply identity
# may grant only those roles (see the runbook, step 7).
#   run.admin                 deploy the service, read its revisions
#   firebasehosting.admin     deploy the api rewrite and the static sites
#   firebase.viewer           firebase-tools reads project metadata
#   serviceusage.consumer     firebase-tools calls APIs on the project
#   cloudsql.viewer           --add-cloudsql-instances reads the instance
#   logging.viewer            the startup check reads the revision's logs
resource "google_project_iam_member" "deployer" {
  for_each = toset([
    "roles/run.admin",
    "roles/firebasehosting.admin",
    "roles/firebase.viewer",
    "roles/serviceusage.serviceUsageConsumer",
    "roles/cloudsql.viewer",
    "roles/logging.viewer",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${data.google_service_account.deployer.email}"
}

resource "google_secret_manager_secret_iam_member" "deployer_secret_viewer" {
  for_each = {
    database_url         = google_secret_manager_secret.database_url.secret_id
    jwt_secret           = google_secret_manager_secret.jwt_secret.secret_id
    master_kek           = google_secret_manager_secret.master_kek.secret_id
    github_client_secret = google_secret_manager_secret.github_client_secret.secret_id
    stripe_secret_key    = google_secret_manager_secret.stripe_secret_key.secret_id
    stripe_webhook       = google_secret_manager_secret.stripe_webhook_secret.secret_id
  }
  project   = var.project_id
  secret_id = each.value
  # Metadata and version listing only. The payload is never read by the deploy.
  role   = "roles/secretmanager.viewer"
  member = "serviceAccount:${data.google_service_account.deployer.email}"
}

resource "google_project_iam_member" "server_run" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/logging.logWriter",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${data.google_service_account.server_run.email}"
}

resource "google_secret_manager_secret_iam_member" "server_run_secret" {
  for_each = {
    database_url         = google_secret_manager_secret.database_url.secret_id
    jwt_secret           = google_secret_manager_secret.jwt_secret.secret_id
    master_kek           = google_secret_manager_secret.master_kek.secret_id
    github_client_secret = google_secret_manager_secret.github_client_secret.secret_id
    stripe_secret_key    = google_secret_manager_secret.stripe_secret_key.secret_id
    stripe_webhook       = google_secret_manager_secret.stripe_webhook_secret.secret_id
  }
  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${data.google_service_account.server_run.email}"
}

resource "google_artifact_registry_repository" "han" {
  location      = var.region
  repository_id = "han"
  format        = "DOCKER"
  description   = "han-server images, pushed by deploy-han-server.yml"
  depends_on    = [google_project_service.apis]
}

resource "google_artifact_registry_repository_iam_member" "deployer_push" {
  project    = var.project_id
  location   = google_artifact_registry_repository.han.location
  repository = google_artifact_registry_repository.han.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${data.google_service_account.deployer.email}"
}

# Not in Terraform, by design:
#  - the deployer's workload identity binding (subject
#    repo:...:environment:han-production) and its actAs grant on han-server-run.
#    These are set once in the runbook, so the apply identity cannot change who
#    may become the deployer or the server.
