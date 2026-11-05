locals {
  # The pool, the identities han-tf-plan and han-tf-apply, and their bindings
  # come from the bootstrap prerequisite in PATH.md section 7. Terraform reads
  # the pool but does not manage them.
  #
  # Trust, stated plainly: han-tf-apply is project owner. Owner can change the
  # workload identity provider and its own bindings, so Terraform scoping does
  # not stop it from rewriting its own trust. Its controls are the
  # han-infra-apply environment (required reviewer, main-only), a subject that
  # no deploy job uses, and the plan and state guards in CI.
  wif_pool_name     = data.google_iam_workload_identity_pool.han.name
  wif_provider_name = "${local.wif_pool_name}/providers/han-github"
  tf_apply_sa_email = "han-tf-apply@${var.project_id}.iam.gserviceaccount.com"
  tf_plan_sa_email  = "han-tf-plan@${var.project_id}.iam.gserviceaccount.com"

  apis = toset([
    "artifactregistry.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "dns.googleapis.com",
    "firebase.googleapis.com",
    "firebasehosting.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "logging.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "serviceusage.googleapis.com",
    "sqladmin.googleapis.com",
    "storage.googleapis.com",
    "sts.googleapis.com",
  ])

  # Hosting sites: one per target in deploy/firebase/firebase.json.
  sites = {
    dashboard = { site_id = "han-guru-dashboard", domain = "dashboard.local.han.guru" }
    app       = { site_id = "han-guru-app", domain = "app.han.guru" }
    api       = { site_id = "han-guru-api", domain = "api.han.guru" }
  }
}

data "google_iam_workload_identity_pool" "han" {
  project                   = var.project_id
  workload_identity_pool_id = var.wif_pool_id
}

resource "google_project_service" "apis" {
  for_each                   = local.apis
  project                    = var.project_id
  service                    = each.value
  disable_on_destroy         = false
  disable_dependent_services = false
}

resource "google_firebase_project" "han" {
  provider = google-beta
  project  = var.project_id

  depends_on = [google_project_service.apis]
}

resource "google_firebase_hosting_site" "site" {
  for_each = local.sites
  provider = google-beta
  project  = var.project_id
  site_id  = each.value.site_id

  depends_on = [google_firebase_project.han]
}

# Custom domains are created before DNS points at them. wait_dns_verification
# is false so Terraform does not block on DNS, and required_dns_updates is
# exported so slice K can publish the ACME TXT records.
resource "google_firebase_hosting_custom_domain" "domain" {
  for_each              = local.sites
  provider              = google-beta
  project               = var.project_id
  site_id               = google_firebase_hosting_site.site[each.key].site_id
  custom_domain         = each.value.domain
  cert_preference       = "GROUPED"
  wait_dns_verification = false
}
