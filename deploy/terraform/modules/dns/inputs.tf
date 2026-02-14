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
  description = "Railway DNS value for website subdomain"
  type        = string
  default     = ""
}

variable "api_dns_value" {
  description = "Railway DNS value for API subdomain"
  type        = string
  default     = ""
}

# Plan-time-known flags for conditional resource creation
variable "enable_website_dns" {
  description = "Whether to create website DNS records"
  type        = bool
  default     = false
}

variable "enable_api_dns" {
  description = "Whether to create API DNS records"
  type        = bool
  default     = false
}
