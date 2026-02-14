# -----------------------------------------------------------------------------
# Han Team Platform - Railway Infrastructure
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# Import existing Railway resources into Terraform state
# These blocks can be removed after the first successful apply.
# -----------------------------------------------------------------------------

import {
  to = module.project.railway_project.this
  id = "24bcc47a-dadf-464b-887f-bcccaf3e25e2"
}

import {
  to = module.api.railway_service.api
  id = "9d8b6991-73c6-4c7d-810e-7519fb9a582e"
}

import {
  to = module.website.railway_service.website
  id = "f71ad15d-cfe1-495e-8c05-c4d1e2942c05"
}

import {
  to = module.postgres.railway_service.postgres
  id = "dca29e2a-db91-411b-a938-bfc576bf8a6b"
}

import {
  to = module.redis.railway_service.redis
  id = "01b8201a-5c6d-4c9b-879d-6bb2163bea48"
}

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
  enable_sentry = var.sentry_organization_slug != ""
  sentry_dsn    = var.sentry_organization_slug != "" ? module.sentry[0].api_dsn : ""
}

module "website" {
  source = "./modules/website"

  project_id     = module.project.id
  environment_id = module.project.default_environment_id

  # GitHub source
  github_repo    = var.github_repo
  branch         = var.production_branch
  root_directory = var.website_root_directory

  # Team API connection
  graphql_url = var.api_custom_domain != "" ? "https://${var.api_custom_domain}/graphql" : ""

  # Custom domain
  custom_domain = var.website_custom_domain

  # Observability
  enable_sentry = var.sentry_organization_slug != ""
  sentry_dsn    = var.sentry_organization_slug != "" ? module.sentry[0].website_dsn : ""
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

  # Plan-time-known flags for conditional DNS record creation
  enable_website_dns = var.website_custom_domain != ""
  enable_api_dns     = var.api_custom_domain != ""

  # Railway DNS values for custom domains
  website_dns_value = module.website.custom_domain_dns_value
  api_dns_value     = module.api.custom_domain_dns_value

  # Railway domain verification TXT records
  api_verify_txt     = var.api_domain_verify_txt
  website_verify_txt = var.website_domain_verify_txt
}
