resource "railway_variable" "database_url" {
  environment_id = var.environment_id
  service_id     = railway_service.api.id
  name           = "DATABASE_URL"
  value          = var.database_url
}

resource "railway_variable" "redis_url" {
  environment_id = var.environment_id
  service_id     = railway_service.api.id
  name           = "REDIS_URL"
  value          = var.redis_url
}
