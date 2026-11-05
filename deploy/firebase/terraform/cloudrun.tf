# The han-server Cloud Run service. A human creates a shell once, with a
# placeholder image, private (PATH.md section 8). This import brings it under
# Terraform. Terraform then owns its invoker setting and its IAM, and ignores
# what the deploy workflow changes.
import {
  to = google_cloud_run_v2_service.server
  id = "projects/${var.project_id}/locations/${var.region}/services/han-server"
}

# Public invocation is set here, not in the deploy workflow, so a plain
# `gcloud run deploy` cannot silently change it. The deploy workflow checks the
# setting after every deploy (deploy/firebase/scripts/check_invoker.py).
#
# Whether the setting is exposed as invokerIamDisabled in gcloud's JSON is not
# verified against live output yet. The check accepts that field and the legacy
# annotation, and fails if neither says true. See PATH.md section 8, not verified.
resource "google_cloud_run_v2_service" "server" {
  name                = local.cloud_run_service
  location            = var.region
  deletion_protection = true

  # The Hosting api rewrite forwards to this service, so the service must accept
  # requests without a Google identity. Route-level checks are the server's job,
  # not this setting's. See PATH.md "What this path does not prove".
  invoker_iam_disabled = true

  template {
    service_account = data.google_service_account.server_run.email

    containers {
      # Placeholder only. The deploy workflow replaces the image by digest.
      image = var.placeholder_image
    }
  }

  lifecycle {
    # The deploy workflow owns the revision, image, env and secrets.
    ignore_changes = [template, client, client_version]
  }
}

# Deployer: create and update revisions of this one service.
resource "google_cloud_run_v2_service_iam_member" "deployer" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.server.name
  role     = "roles/run.developer"
  member   = "serviceAccount:${data.google_service_account.deployer.email}"
}

# Hosting deployer: read the service so firebase-tools can validate the api
# rewrite. It cannot change the service.
resource "google_cloud_run_v2_service_iam_member" "hosting_deployer" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.server.name
  role     = "roles/run.viewer"
  member   = "serviceAccount:${data.google_service_account.hosting_deployer.email}"
}
