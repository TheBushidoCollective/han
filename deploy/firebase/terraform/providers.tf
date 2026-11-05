provider "google" {
  project = var.project_id
  region  = var.region
}

# Firebase resources (project, hosting sites, custom domains) exist only in the
# beta provider.
provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# DNS lives in the waldrip-net project, not in Han's project. Only the
# DNS-gated resources in dns.tf use this alias.
provider "google" {
  alias   = "dns"
  project = var.dns_project_id
}

provider "random" {}
