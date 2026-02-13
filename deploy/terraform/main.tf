# -----------------------------------------------------------------------------
# Han Team Platform - Railway Infrastructure
# -----------------------------------------------------------------------------

module "project" {
  source = "./modules/project"

  name           = var.project_name
  description    = "Han Team Platform - Session sync, encryption, and team collaboration"
  has_pr_deploys = var.enable_pr_environments
}

module "postgres" {
  source = "./modules/postgres"

  project_id     = module.project.id
  environment_id = module.project.default_environment_id
}

module "redis" {
  source = "./modules/redis"

  project_id = module.project.id
}

# -----------------------------------------------------------------------------
# Sentry (optional - only if sentry_organization_slug is set)
# -----------------------------------------------------------------------------

module "sentry" {
  source = "./modules/sentry"
  count  = var.sentry_organization_slug != "" ? 1 : 0

  organization_slug = var.sentry_organization_slug
  team_name         = "Han Team Platform"
  team_slug         = "han-team-platform"
  project_name      = "Han"
  project_slug      = "han"
}

# -----------------------------------------------------------------------------
# Services
# -----------------------------------------------------------------------------

module "api" {
  source = "./modules/api"

  project_id     = module.project.id
  environment_id = module.project.default_environment_id

  # GitHub source
  github_repo    = var.github_repo
  branch         = var.production_branch
  root_directory = var.api_server_root_directory

  # Database connections
  database_url = module.postgres.connection_url
  redis_url    = module.redis.connection_url

  # Optional OAuth
  github_client_id     = var.github_client_id
  github_client_secret = var.github_client_secret
  google_client_id     = var.google_client_id
  google_client_secret = var.google_client_secret

  # Custom domain
  custom_domain = var.api_custom_domain

  # Observability
  sentry_dsn = var.sentry_organization_slug != "" ? module.sentry[0].api_dsn : ""
}

module "website" {
  source = "./modules/website"

  project_id     = module.project.id
  environment_id = module.project.default_environment_id

  # GitHub source
  github_repo    = var.github_repo
  branch         = var.production_branch
  root_directory = var.website_root_directory

  # Custom domain
  custom_domain = var.website_custom_domain

  # Observability
  sentry_dsn = var.sentry_organization_slug != "" ? module.sentry[0].website_dsn : ""
}

# -----------------------------------------------------------------------------
# GCP DNS (optional - only if gcp_project_id is set)
# -----------------------------------------------------------------------------

module "dns" {
  source = "./modules/dns"
  count  = var.gcp_project_id != "" ? 1 : 0

  project_id = var.gcp_project_id
  zone_name  = var.gcp_dns_zone_name
  domain     = var.domain

  # Railway DNS values for custom domains
  website_dns_value     = module.website.custom_domain_dns_value
  website_www_dns_value = module.website.www_domain_dns_value
  api_dns_value         = module.api.custom_domain_dns_value
}
