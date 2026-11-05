# Runtime identity for the Cloud Run service. It can reach the database and
# read the six han-server secrets, and nothing else.
resource "google_service_account" "server_run" {
  account_id   = "han-server-run"
  display_name = "Han server runtime"
  depends_on   = [google_project_service.apis]
}

# Deploy identity. Only jobs in the han-production environment can use it (see
# the WIF binding below). Its roles are the ones the deploy steps call:
#   run.admin                 deploy the service, read its revisions
#   firebasehosting.admin     deploy the api rewrite and the static sites
#   firebase.viewer           firebase-tools reads project metadata
#   serviceusage.consumer     firebase-tools calls APIs on the project
#   cloudsql.viewer           --add-cloudsql-instances reads the instance
#   logging.viewer            the startup check reads the revision's logs
#   secretmanager.viewer      per secret, below: the precheck lists versions
#   artifactregistry.writer   per repository, below: pushes the image
# Verify each on the first real deploy. A missing role fails that step loudly.
resource "google_service_account" "deployer" {
  account_id   = "han-deployer"
  display_name = "Han deployer"
  depends_on   = [google_project_service.apis]
}

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
  member  = "serviceAccount:${google_service_account.deployer.email}"
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
  member = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_service_account_iam_member" "deployer_acts_as_server" {
  service_account_id = google_service_account.server_run.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_project_iam_member" "server_run" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/logging.logWriter",
  ])
  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.server_run.email}"
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
  member    = "serviceAccount:${google_service_account.server_run.email}"
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
  member     = "serviceAccount:${google_service_account.deployer.email}"
}

# Keyless sign-in. The deployer can be impersonated only by a job whose subject
# is the han-production environment. Also set in seed.sh; kept here so the
# binding is reviewable next to the account it protects.
resource "google_service_account_iam_member" "deployer_wif" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principal://iam.googleapis.com/${local.wif_pool_name}/subject/repo:${var.github_repository}:environment:han-production"
}
