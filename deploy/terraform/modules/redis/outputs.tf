output "service_id" {
  description = "Redis service ID"
  value       = railway_service.redis.id
}

output "service_name" {
  description = "Redis service name (for internal DNS)"
  value       = railway_service.redis.name
}

output "connection_url" {
  description = "Redis connection URL for internal services"
  value       = "redis://${railway_service.redis.name}.railway.internal:6379"
}
