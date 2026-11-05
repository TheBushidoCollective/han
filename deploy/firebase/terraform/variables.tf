variable "project_id" {
  description = "Han GCP project ID. Chosen by the bootstrap prerequisite in PATH.md section 7 (han-guru, or han-guru-prod if taken)."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "project_id must be a valid GCP project ID."
  }
}

variable "region" {
  description = "Region for Cloud Run, Cloud SQL and Artifact Registry."
  type        = string
  default     = "us-central1"
}

variable "github_repository" {
  description = "GitHub repository allowed to use the deploy identities."
  type        = string
  default     = "TheBushidoCollective/han"
}

variable "db_tier" {
  description = "Cloud SQL machine tier. db-f1-micro needs edition ENTERPRISE, which main.tf sets."
  type        = string
  default     = "db-f1-micro"
}

variable "manage_dns" {
  description = "Create the dashboard.local, app and api CNAMEs and ACME TXT records in the waldrip-net zone. Off until slice K."
  type        = bool
  default     = false
}

variable "dns_project_id" {
  description = "Project that hosts the han-guru managed zone."
  type        = string
  default     = "waldrip-net"
}

variable "dns_zone_name" {
  description = "Cloud DNS managed zone for han.guru."
  type        = string
  default     = "han-guru"
}

variable "dns_targets" {
  description = "CNAME target per host, used when manage_dns is true. Slice K changes these one host at a time."
  type        = map(string)
  default = {
    dashboard = "han-guru-dashboard.web.app."
    app       = "han-guru-app.web.app."
    api       = "han-guru-api.web.app."
  }
}

variable "db_credential_version" {
  description = "Bump together to regenerate the database password in both the SQL user and the database-url secret. See PATH.md section 5."
  type        = number
  default     = 1
}
