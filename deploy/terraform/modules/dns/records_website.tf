# Website subdomain (app.han.guru)
resource "google_dns_record_set" "website" {
  count        = var.enable_website_dns ? 1 : 0
  name         = "app.${var.domain}."
  managed_zone = data.google_dns_managed_zone.main.name
  project      = var.project_id
  type         = "CNAME"
  ttl          = 300
  rrdatas      = ["${var.website_dns_value}."]
}
