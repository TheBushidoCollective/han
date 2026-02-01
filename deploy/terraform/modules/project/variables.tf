variable "name" {
  description = "Name of the Railway project"
  type        = string
}

variable "description" {
  description = "Description of the project"
  type        = string
  default     = ""
}

variable "has_pr_deploys" {
  description = "Enable PR preview environments"
  type        = bool
  default     = true
}

variable "default_environment_name" {
  description = "Name of the default environment"
  type        = string
  default     = "production"
}
