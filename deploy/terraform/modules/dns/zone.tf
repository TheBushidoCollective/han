# Reference existing DNS zone (don't create, just use)
data "google_dns_managed_zone" "main" {
  name    = var.zone_name
  project = var.project_id
}
