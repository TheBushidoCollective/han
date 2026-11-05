# Trust model, stated as it is built (see PATH.md section 8):
#
# - No Han identity is the project owner. The apply identity (han-tf-apply)
#   holds only the custom roles in deploy/firebase/bootstrap/roles/ and
#   resource-level grants on Han's own resources. The bootstrap grants those,
#   not this directory.
# - Terraform creates no service account, no secret, no WIF pool, no project
#   IAM, no project API, no Firebase project and no Hosting site. The bootstrap
#   creates the secrets, service accounts, pool, Cloud Run shell, repository,
#   database, user and logging resources. The Hosting deploy workflow creates
#   the Hosting sites. Terraform imports the Cloud Run service and Cloud SQL
#   instance, and reads the other resources it needs as data.
# - Terraform's resource-level IAM grants are on the han-server Cloud Run
#   service. It makes no secret IAM grant and manages no database or user.
#
# Known residual: whatever can change project IAM can change these identities.
# That is the project owners, and every identity in the website repo that holds
# project-wide admin (PATH.md section 8, risks 2 and 3). Han cannot close that
# from this repository.

locals {
  wif_pool_name     = data.google_iam_workload_identity_pool.han.name
  wif_provider_name = "${local.wif_pool_name}/providers/han-github"

  tf_plan_sa_email  = "han-tf-plan@${var.project_id}.iam.gserviceaccount.com"
  tf_apply_sa_email = "han-tf-apply@${var.project_id}.iam.gserviceaccount.com"

  # Every Han secret name starts with this prefix. The bootstrap creates them
  # with this prefix, and the secret data sources name them with it.
  secret_prefix = "han-server-"

  cloud_run_service = "han-server"
}

data "google_iam_workload_identity_pool" "han" {
  project                   = var.project_id
  workload_identity_pool_id = var.wif_pool_id
}
