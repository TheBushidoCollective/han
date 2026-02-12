output "service_id" {
  description = "API service ID"
  value       = railway_service.api.id
}

output "service_name" {
  description = "API service name"
  value       = railway_service.api.name
}

output "custom_domain_dns_value" {
  description = "DNS record value for custom domain (if configured)"
  value       = var.custom_domain != "" ? railway_custom_domain.api[0].dns_record_value : null
}
