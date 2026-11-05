# Trust model, stated as it is built (see PATH.md section 8):
#
# - No Han identity is the project owner. The apply identity (han-tf-apply)
#   holds only the custom roles in deploy/firebase/bootstrap/roles/ and
#   resource-level grants on Han's own resources.
# - Terraform never creates service accounts, the WIF pool, project-level IAM,
#   project APIs, Firebase projects or Hosting sites. A human creates those once
#   (PATH.md section 8). Terraform imports or reads them.
# - Every grant Terraform makes is on a single Han resource: a secret named
#   han-server-*, the han-pg instance, the han Artifact Registry repository, or
#   the han-server Cloud Run service.
#
# Known residual: whatever can change project IAM can change these identities.
# That is the project owners, and terraform-ci in the website repo (see PATH.md
# section 8, risk 2). Han cannot close that from this repository.

locals {
  wif_pool_name     = data.google_iam_workload_identity_pool.han.name
  wif_provider_name = "${local.wif_pool_name}/providers/han-github"

  tf_plan_sa_email  = "han-tf-plan@${var.project_id}.iam.gserviceaccount.com"
  tf_apply_sa_email = "han-tf-apply@${var.project_id}.iam.gserviceaccount.com"

  # Every Han secret name starts with this prefix. The apply and plan custom
  # roles are conditioned on it (deploy/firebase/bootstrap/roles/).
  secret_prefix = "han-server-"

  cloud_run_service = "han-server"
}

data "google_iam_workload_identity_pool" "han" {
  project                   = var.project_id
  workload_identity_pool_id = var.wif_pool_id
}
