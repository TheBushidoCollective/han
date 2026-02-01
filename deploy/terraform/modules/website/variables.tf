resource "railway_variable" "node_env" {
  environment_id = var.environment_id
  service_id     = railway_service.website.id
  name           = "NODE_ENV"
  value          = var.node_env
}

resource "railway_variable" "sentry_dsn" {
  count          = var.sentry_dsn != "" ? 1 : 0
  environment_id = var.environment_id
  service_id     = railway_service.website.id
  name           = "NEXT_PUBLIC_SENTRY_DSN"
  value          = var.sentry_dsn
}
