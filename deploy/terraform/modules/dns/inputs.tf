variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "zone_name" {
  description = "Name of the Cloud DNS managed zone"
  type        = string
}

variable "domain" {
  description = "Domain name (e.g., han.guru)"
  type        = string
}

# Railway DNS values (from custom_domain resources)
variable "website_dns_value" {
  description = "Railway DNS value for website apex domain"
  type        = string
  default     = ""
}

variable "website_www_dns_value" {
  description = "Railway DNS value for website www subdomain"
  type        = string
  default     = ""
}

variable "api_dns_value" {
  description = "Railway DNS value for API subdomain"
  type        = string
  default     = ""
}
