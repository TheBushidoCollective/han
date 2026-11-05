# Artifact Registry repository `han`. The bootstrap creates it and grants every
# repository-level IAM binding (PATH.md section 8), including the deployer's push
# role. Terraform reads it only, so the apply identity needs no repository IAM
# write permission and this file manages none.
data "google_artifact_registry_repository" "han" {
  project       = var.project_id
  location      = var.region
  repository_id = "han"
}
