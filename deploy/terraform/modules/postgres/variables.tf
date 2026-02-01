resource "railway_variable" "user" {
  environment_id = var.environment_id
  service_id     = railway_service.postgres.id
  name           = "POSTGRES_USER"
  value          = var.username
}

resource "railway_variable" "password" {
  environment_id = var.environment_id
  service_id     = railway_service.postgres.id
  name           = "POSTGRES_PASSWORD"
  value          = random_password.postgres.result
}

resource "railway_variable" "database" {
  environment_id = var.environment_id
  service_id     = railway_service.postgres.id
  name           = "POSTGRES_DB"
  value          = var.database
}

resource "random_password" "postgres" {
  length  = 32
  special = false
}
