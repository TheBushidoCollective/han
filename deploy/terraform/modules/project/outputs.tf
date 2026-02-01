output "id" {
  description = "Project ID"
  value       = railway_project.this.id
}

output "default_environment_id" {
  description = "Default environment ID"
  value       = railway_project.this.default_environment.id
}
