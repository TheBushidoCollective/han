# Website apex domain (han.guru)
resource "google_dns_record_set" "website_apex" {
  count        = var.enable_website_dns ? 1 : 0
  name         = "${var.domain}."
  managed_zone = data.google_dns_managed_zone.main.name
  project      = var.project_id
  type         = "CNAME"
  ttl          = 300
  rrdatas      = ["${var.website_dns_value}."]
}

# Website www subdomain (www.han.guru)
resource "google_dns_record_set" "website_www" {
  count        = var.enable_website_dns ? 1 : 0
  name         = "www.${var.domain}."
  managed_zone = data.google_dns_managed_zone.main.name
  project      = var.project_id
  type         = "CNAME"
  ttl          = 300
  rrdatas      = ["${var.website_www_dns_value}."]
}
