output "project_id" {
  value = var.project_id
}

output "sites" {
  description = "Firebase Hosting site IDs by target."
  value       = { for k, s in google_firebase_hosting_site.site : k => s.site_id }
}

output "required_dns_updates" {
  description = "DNS records each custom domain still needs. Slice G copies the ACME TXT entries into firebase-certificate-records.json."
  value = {
    for k, d in google_firebase_hosting_custom_domain.domain : k => d.required_dns_updates
  }
}

output "cloud_sql_connection_name" {
  value = google_sql_database_instance.han.connection_name
}

output "artifact_registry_repository" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.han.repository_id}"
}

output "deployer_service_account" {
  value = data.google_service_account.deployer.email
}

output "server_run_service_account" {
  value = data.google_service_account.server_run.email
}

output "wif_provider" {
  description = "Value for the HAN_GCP_WIF_PROVIDER repo variable."
  value       = local.wif_provider_name
}

output "tf_apply_service_account" {
  description = "Value for the HAN_GCP_TF_APPLY_SA repo variable."
  value       = local.tf_apply_sa_email
}

output "tf_plan_service_account" {
  description = "Value for the HAN_GCP_TF_PLAN_SA repo variable."
  value       = local.tf_plan_sa_email
}
