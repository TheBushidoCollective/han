terraform {
  required_version = ">= 1.11.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 6.50.0, < 8.0.0"
    }
  }
  # Deliberately separate from the main Han infrastructure state.
  backend "gcs" {}
}

provider "google" {
  project = "waldrip-net"
}

locals {
  zone = "han-guru"
  records = {
    api            = { name = "api.han.guru.", type = "CNAME" }
    api_verify     = { name = "_railway-verify.api.han.guru.", type = "TXT" }
    website        = { name = "app.han.guru.", type = "CNAME" }
    website_verify = { name = "_railway-verify.app.han.guru.", type = "TXT" }
  }
}

# Values are read from authoritative Cloud DNS, not reconstructed Railway config.
data "google_dns_record_set" "current" {
  for_each     = local.records
  project      = "waldrip-net"
  managed_zone = local.zone
  name         = each.value.name
  type         = each.value.type
}

resource "google_dns_record_set" "legacy" {
  for_each     = local.records
  project      = "waldrip-net"
  managed_zone = local.zone
  name         = each.value.name
  type         = each.value.type
  ttl          = data.google_dns_record_set.current[each.key].ttl
  rrdatas      = data.google_dns_record_set.current[each.key].rrdatas

  # Import is a handoff of state ownership only, not a DNS cutover. A later
  # independently reviewed change must remove these guards before modifying DNS.
  lifecycle {
    prevent_destroy = true
    ignore_changes  = [ttl, rrdatas]
  }
}

import {
  for_each = local.records
  to       = google_dns_record_set.legacy[each.key]
  id       = "projects/waldrip-net/managedZones/${local.zone}/rrsets/${each.value.name}/${each.value.type}"
}
