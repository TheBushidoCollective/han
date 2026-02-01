output "zone_dns_name" {
  description = "DNS name of the zone"
  value       = data.google_dns_managed_zone.main.dns_name
}

output "name_servers" {
  description = "Name servers for the zone"
  value       = data.google_dns_managed_zone.main.name_servers
}
