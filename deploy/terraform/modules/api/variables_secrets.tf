resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "random_password" "session_secret" {
  length  = 64
  special = false
}

resource "random_password" "master_encryption_key" {
  length  = 64
  special = false
}

resource "railway_variable" "jwt_secret" {
  environment_id = var.environment_id
  service_id     = railway_service.api.id
  name           = "JWT_SECRET"
  value          = random_password.jwt_secret.result
}

resource "railway_variable" "session_secret" {
  environment_id = var.environment_id
  service_id     = railway_service.api.id
  name           = "SESSION_SECRET"
  value          = random_password.session_secret.result
}

resource "railway_variable" "master_encryption_key" {
  environment_id = var.environment_id
  service_id     = railway_service.api.id
  name           = "MASTER_ENCRYPTION_KEY"
  value          = random_password.master_encryption_key.result
}
