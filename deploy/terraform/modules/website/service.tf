resource "railway_service" "website" {
  project_id         = var.project_id
  name               = var.service_name
  source_repo        = var.github_repo
  source_repo_branch = var.branch
  root_directory     = var.root_directory
  config_path        = var.config_path
}
