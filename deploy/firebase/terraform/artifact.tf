# Artifact Registry repository `han`. A human creates it once (PATH.md section 8).
# Terraform reads it and manages only its repository-level IAM. Repository-level
# IAM is supported, so these grants do not reach the website or Relic images.
data "google_artifact_registry_repository" "han" {
  project       = var.project_id
  location      = var.region
  repository_id = "han"
}

resource "google_artifact_registry_repository_iam_member" "deployer_push" {
  project    = var.project_id
  location   = var.region
  repository = data.google_artifact_registry_repository.han.repository_id
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${data.google_service_account.deployer.email}"
}

resource "google_artifact_registry_repository_iam_member" "plan_read" {
  project    = var.project_id
  location   = var.region
  repository = data.google_artifact_registry_repository.han.repository_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${local.tf_plan_sa_email}"
}
