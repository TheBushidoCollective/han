output "api_dsn" {
  description = "Sentry DSN for the API project"
  value       = sentry_key.api.dsn["public"]
  sensitive   = true
}

output "website_dsn" {
  description = "Sentry DSN for the website project"
  value       = sentry_key.website.dsn["public"]
  sensitive   = true
}

output "api_project_id" {
  description = "Sentry API project ID"
  value       = sentry_project.api.id
}

output "website_project_id" {
  description = "Sentry website project ID"
  value       = sentry_project.website.id
}

output "team_id" {
  description = "Sentry team ID"
  value       = sentry_team.main.id
}
