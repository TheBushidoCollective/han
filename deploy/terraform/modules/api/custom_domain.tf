resource "railway_custom_domain" "api" {
  count          = var.custom_domain != "" ? 1 : 0
  environment_id = var.environment_id
  service_id     = railway_service.api.id
  domain         = var.custom_domain
}
