# Every grant here is on one Han resource. There are no project-level grants:
# those are human bootstrap (PATH.md section 8), so the apply identity cannot
# change project policy.
#
# Identities are created by the bootstrap. Terraform only reads them. Secret IAM
# is granted by the bootstrap, per secret, and is not managed here.
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
