# DNS for han.guru lives in the waldrip-net project. Everything here is off
# until slice K (manage_dns = true), and slice K imports the records that
# already exist before changing any target.
#
# Never touched here: the apex A/AAAA/TXT records and the coordinator.local
# A record. Those belong to GitHub Pages and the local coordinator.

# ACME TXT records that Firebase asks for, one entry per name. Filled from
# the output of the custom-domain resources during slice G, then committed
# (same pattern as the website repo's firebase-certificate-records.json).
locals {
  certificate_records = jsondecode(file("${path.module}/firebase-certificate-records.json"))

  certificate_challenges = {
    for name, record in local.certificate_records : name => record
    if length(record.rrdatas) > 0
  }
}

resource "google_dns_record_set" "host_cname" {
  for_each     = var.manage_dns ? var.dns_targets : {}
  provider     = google.dns
  project      = var.dns_project_id
  managed_zone = var.dns_zone_name
  name         = "${local.sites[each.key].domain}."
  type         = "CNAME"
  ttl          = 300
  rrdatas      = [each.value]
}

resource "google_dns_record_set" "firebase_certificate_challenge" {
  for_each     = var.manage_dns ? local.certificate_challenges : {}
  provider     = google.dns
  project      = var.dns_project_id
  managed_zone = var.dns_zone_name
  name         = each.key
  type         = "TXT"
  ttl          = 300
  rrdatas      = [for token in each.value.rrdatas : startswith(trimspace(token), "\"") ? trimspace(token) : "\"${trimspace(token)}\""]
}
