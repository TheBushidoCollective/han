resource "railway_variable" "jwt_secret" {
  environment_id = var.environment_id
  service_id     = railway_service.api.id
  name           = "JWT_SECRET"
  value          = var.jwt_secret
}

resource "railway_variable" "session_secret" {
  environment_id = var.environment_id
  service_id     = railway_service.api.id
  name           = "SESSION_SECRET"
  value          = var.session_secret
}

resource "railway_variable" "master_encryption_key" {
  environment_id = var.environment_id
  service_id     = railway_service.api.id
  name           = "MASTER_ENCRYPTION_KEY"
  value          = var.master_encryption_key
}
