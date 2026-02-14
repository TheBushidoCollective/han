variable "project_id" {
  description = "Railway project ID"
  type        = string
}

variable "environment_id" {
  description = "Railway environment ID"
  type        = string
}

variable "service_name" {
  description = "Name of the website service"
  type        = string
  default     = "website"
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
  default     = "website"
}

variable "config_path" {
  description = "Path to railway.toml config (relative to repo root)"
  type        = string
  default     = "packages/browse-client/railway.toml"
}

variable "node_env" {
  description = "Node environment"
  type        = string
  default     = "production"
}

variable "graphql_url" {
  description = "GraphQL API URL for the team server (e.g., https://api.han.guru/graphql)"
  type        = string
  default     = ""
}

variable "custom_domain" {
  description = "Custom domain for the website (optional)"
  type        = string
  default     = ""
}

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
