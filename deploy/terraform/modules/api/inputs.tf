# -----------------------------------------------------------------------------
# Required
# -----------------------------------------------------------------------------

variable "project_id" {
  description = "Railway project ID"
  type        = string
}

variable "environment_id" {
  description = "Railway environment ID"
  type        = string
}

variable "database_url" {
  description = "PostgreSQL connection URL"
  type        = string
  sensitive   = true
}

variable "redis_url" {
  description = "Redis connection URL"
  type        = string
}

# -----------------------------------------------------------------------------
# Service Configuration
# -----------------------------------------------------------------------------

variable "service_name" {
  description = "Name of the API service"
  type        = string
  default     = "api"
}

variable "github_repo" {
  description = "GitHub repository (owner/repo format)"
  type        = string
}

variable "branch" {
  description = "Git branch to deploy"
  type        = string
  default     = "main"
}

variable "root_directory" {
  description = "Root directory for the service"
  type        = string
  default     = "packages/han-team-server"
}

variable "config_path" {
  description = "Path to railway.toml config (relative to repo root)"
  type        = string
  default     = "packages/han-team-server/railway.toml"
}

# -----------------------------------------------------------------------------
# Environment
# -----------------------------------------------------------------------------

variable "node_env" {
  description = "Node environment"
  type        = string
  default     = "production"
}

variable "auto_migrate" {
  description = "Run migrations on startup"
  type        = bool
  default     = true
}

# -----------------------------------------------------------------------------
# Optional OAuth
# -----------------------------------------------------------------------------

variable "github_client_id" {
  description = "GitHub OAuth client ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "github_client_secret" {
  description = "GitHub OAuth client secret"
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_client_id" {
  description = "Google OAuth client ID"
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth client secret"
  type        = string
  default     = ""
  sensitive   = true
}

# -----------------------------------------------------------------------------
# Custom Domain
# -----------------------------------------------------------------------------

variable "custom_domain" {
  description = "Custom domain for the API (optional)"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# Observability
# -----------------------------------------------------------------------------

variable "enable_sentry" {
  description = "Whether Sentry is enabled (plan-time-known flag)"
  type        = bool
  default     = false
}

variable "sentry_dsn" {
  description = "Sentry DSN for error tracking (optional)"
  type        = string
  default     = ""
  sensitive   = true
}
