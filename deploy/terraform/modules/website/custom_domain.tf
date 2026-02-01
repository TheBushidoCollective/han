resource "railway_custom_domain" "website" {
  count          = var.custom_domain != "" ? 1 : 0
  environment_id = var.environment_id
  service_id     = railway_service.website.id
  domain         = var.custom_domain
}

resource "railway_custom_domain" "website_www" {
  count          = var.custom_domain != "" ? 1 : 0
  environment_id = var.environment_id
  service_id     = railway_service.website.id
  domain         = "www.${var.custom_domain}"
}
