# -----------------------------------------------------------------------------
# Project Configuration
# -----------------------------------------------------------------------------

variable "project_name" {
  description = "Name of the Railway project"
  type        = string
  default     = "han-team-platform"
}

variable "github_repo" {
  description = "GitHub repository for deployments (owner/repo format)"
  type        = string
  default     = "thebushidocollective/han-team-platform"
}

variable "production_branch" {
  description = "Branch to deploy to production"
  type        = string
  default     = "main"
}

variable "domain" {
  description = "Primary domain for the platform (e.g., han.guru)"
  type        = string
  default     = "han.guru"
}

# -----------------------------------------------------------------------------
# Environment Configuration
# -----------------------------------------------------------------------------

variable "enable_pr_environments" {
  description = "Enable automatic PR preview environments"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# API Server Configuration
# -----------------------------------------------------------------------------

variable "api_server_root_directory" {
  description = "Root directory for the API server service"
  type        = string
  default     = "packages/han-team-server"
}

variable "api_custom_domain" {
  description = "Custom domain for production API (e.g., api.han.guru)"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Website Configuration
# -----------------------------------------------------------------------------

variable "website_root_directory" {
  description = "Root directory for the website service"
  type        = string
  default     = "website"
}

variable "website_custom_domain" {
  description = "Custom domain for production website (e.g., han.guru)"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# GCP DNS Configuration (optional)
# -----------------------------------------------------------------------------

variable "gcp_project_id" {
  description = "GCP project ID for DNS management (optional - leave empty to skip)"
  type        = string
  default     = ""
}

variable "gcp_dns_zone_name" {
  description = "Name of the Cloud DNS managed zone"
  type        = string
  default     = "han-guru"
}

# -----------------------------------------------------------------------------
# Sentry Configuration (optional)
# -----------------------------------------------------------------------------

variable "sentry_organization_slug" {
  description = "Sentry organization slug (optional - leave empty to skip)"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Secrets (sensitive - pass via TF_VAR_* or terraform.tfvars)
# -----------------------------------------------------------------------------

variable "github_client_id" {
  description = "GitHub OAuth client ID (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "github_client_secret" {
  description = "GitHub OAuth client secret (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_client_id" {
  description = "Google OAuth client ID (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth client secret (optional)"
  type        = string
  default     = ""
  sensitive   = true
}
