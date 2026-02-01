output "service_id" {
  description = "PostgreSQL service ID"
  value       = railway_service.postgres.id
}

output "service_name" {
  description = "PostgreSQL service name (for internal DNS)"
  value       = railway_service.postgres.name
}

output "connection_url" {
  description = "PostgreSQL connection URL for internal services"
  value       = "postgresql://${var.username}:${random_password.postgres.result}@${railway_service.postgres.name}.railway.internal:5432/${var.database}"
  sensitive   = true
}

output "username" {
  description = "PostgreSQL username"
  value       = var.username
}

output "database" {
  description = "PostgreSQL database name"
  value       = var.database
}
