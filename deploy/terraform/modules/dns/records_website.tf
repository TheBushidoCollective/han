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

# Railway domain verification for app.han.guru
resource "google_dns_record_set" "website_verify" {
  count        = var.enable_website_dns && var.website_verify_txt != "" ? 1 : 0
  name         = "app.${var.domain}."
  managed_zone = data.google_dns_managed_zone.main.name
  project      = var.project_id
  type         = "TXT"
  ttl          = 300
  rrdatas      = ["\"${var.website_verify_txt}\""]
}
