resource "railway_variable" "sentry_dsn" {
  count          = var.enable_sentry ? 1 : 0
  environment_id = var.environment_id
  service_id     = railway_service.api.id
  name           = "SENTRY_DSN"
  value          = var.sentry_dsn
}
