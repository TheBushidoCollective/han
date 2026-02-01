variable "organization_slug" {
  description = "Sentry organization slug"
  type        = string
}

variable "team_name" {
  description = "Name of the Sentry team"
  type        = string
  default     = "Han Team Platform"
}

variable "team_slug" {
  description = "Slug for the Sentry team"
  type        = string
  default     = "han-team-platform"
}

variable "project_name" {
  description = "Base name for Sentry projects"
  type        = string
  default     = "Han"
}

variable "project_slug" {
  description = "Base slug for Sentry projects"
  type        = string
  default     = "han"
}
