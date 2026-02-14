resource "railway_variable" "graphql_url" {
  count          = var.graphql_url != "" ? 1 : 0
  environment_id = var.environment_id
  service_id     = railway_service.website.id
  name           = "GRAPHQL_URL"
  value          = var.graphql_url
}

resource "railway_variable" "node_env" {
  environment_id = var.environment_id
  service_id     = railway_service.website.id
  name           = "NODE_ENV"
  value          = var.node_env
}

resource "railway_variable" "sentry_dsn" {
  count          = var.enable_sentry ? 1 : 0
  environment_id = var.environment_id
  service_id     = railway_service.website.id
  name           = "VITE_SENTRY_DSN"
  value          = var.sentry_dsn
}
