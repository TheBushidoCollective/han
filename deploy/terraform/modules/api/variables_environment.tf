resource "railway_variable" "node_env" {
  environment_id = var.environment_id
  service_id     = railway_service.api.id
  name           = "NODE_ENV"
  value          = var.node_env
}

resource "railway_variable" "auto_migrate" {
  environment_id = var.environment_id
  service_id     = railway_service.api.id
  name           = "AUTO_MIGRATE"
  value          = var.auto_migrate ? "true" : "false"
}
