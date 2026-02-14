output "service_id" {
  description = "Website service ID"
  value       = railway_service.website.id
}

output "service_name" {
  description = "Website service name"
  value       = railway_service.website.name
}

output "custom_domain_dns_value" {
  description = "DNS record value for custom domain"
  value       = var.custom_domain != "" ? railway_custom_domain.website[0].dns_record_value : null
}
