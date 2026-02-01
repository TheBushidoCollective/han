resource "railway_variable" "github_client_id" {
  count          = var.github_client_id != "" ? 1 : 0
  environment_id = var.environment_id
  service_id     = railway_service.api.id
  name           = "GITHUB_CLIENT_ID"
  value          = var.github_client_id
}

resource "railway_variable" "github_client_secret" {
  count          = var.github_client_secret != "" ? 1 : 0
  environment_id = var.environment_id
  service_id     = railway_service.api.id
  name           = "GITHUB_CLIENT_SECRET"
  value          = var.github_client_secret
}

resource "railway_variable" "google_client_id" {
  count          = var.google_client_id != "" ? 1 : 0
  environment_id = var.environment_id
  service_id     = railway_service.api.id
  name           = "GOOGLE_CLIENT_ID"
  value          = var.google_client_id
}

resource "railway_variable" "google_client_secret" {
  count          = var.google_client_secret != "" ? 1 : 0
  environment_id = var.environment_id
  service_id     = railway_service.api.id
  name           = "GOOGLE_CLIENT_SECRET"
  value          = var.google_client_secret
}
