output "project_id" {
  value = var.project_id
}

output "cloud_sql_connection_name" {
  value = google_sql_database_instance.han.connection_name
}

output "cloud_run_service" {
  value = google_cloud_run_v2_service.server.name
}

output "artifact_registry_repository" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${data.google_artifact_registry_repository.han.repository_id}"
}

output "wif_provider" {
  description = "Value for the HAN_GCP_WIF_PROVIDER repo variable."
  value       = local.wif_provider_name
}

output "tf_plan_service_account" {
  description = "Value for the HAN_GCP_TF_PLAN_SA repo variable."
  value       = local.tf_plan_sa_email
}

output "tf_apply_service_account" {
  description = "Value for the HAN_GCP_TF_APPLY_SA repo variable."
  value       = local.tf_apply_sa_email
}
