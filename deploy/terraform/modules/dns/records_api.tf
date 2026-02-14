# API subdomain (api.han.guru)
resource "google_dns_record_set" "api" {
  count        = var.enable_api_dns ? 1 : 0
  name         = "api.${var.domain}."
  managed_zone = data.google_dns_managed_zone.main.name
  project      = var.project_id
  type         = "CNAME"
  ttl          = 300
  rrdatas      = ["${var.api_dns_value}."]
}
