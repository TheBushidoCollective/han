resource "railway_service" "redis" {
  project_id   = var.project_id
  name         = var.service_name
  source_image = var.image

  volume = {
    name       = "${var.service_name}-data"
    mount_path = "/data"
  }
}
