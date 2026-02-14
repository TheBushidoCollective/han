output "project_id" {
  description = "Railway project ID"
  value       = module.project.id
}

output "project_url" {
  description = "Railway project dashboard URL"
  value       = "https://railway.app/project/${module.project.id}"
}

output "api_service_id" {
  description = "API server service ID"
  value       = module.api.service_id
}

output "website_service_id" {
  description = "Website service ID"
  value       = module.website.service_id
}

output "postgres_service_id" {
  description = "PostgreSQL service ID"
  value       = module.postgres.service_id
}

output "redis_service_id" {
  description = "Redis service ID"
  value       = module.redis.service_id
}

output "pr_environments_enabled" {
  description = "Whether PR preview environments are enabled"
  value       = var.enable_pr_environments
}

output "api_custom_domain_dns" {
  description = "DNS record value for API custom domain"
  value       = module.api.custom_domain_dns_value
}

output "website_custom_domain_dns" {
  description = "DNS record value for website custom domain"
  value       = module.website.custom_domain_dns_value
}


output "sentry_api_project_id" {
  description = "Sentry API project ID (if enabled)"
  value       = var.sentry_organization_slug != "" ? module.sentry[0].api_project_id : null
}

output "sentry_website_project_id" {
  description = "Sentry website project ID (if enabled)"
  value       = var.sentry_organization_slug != "" ? module.sentry[0].website_project_id : null
}
