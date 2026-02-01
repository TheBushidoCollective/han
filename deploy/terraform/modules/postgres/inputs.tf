variable "project_id" {
  description = "Railway project ID"
  type        = string
}

variable "environment_id" {
  description = "Railway environment ID"
  type        = string
}

variable "service_name" {
  description = "Name of the PostgreSQL service"
  type        = string
  default     = "postgres"
}

variable "image" {
  description = "PostgreSQL Docker image"
  type        = string
  default     = "postgres:16-alpine"
}

variable "username" {
  description = "PostgreSQL username"
  type        = string
  default     = "han"
}

variable "database" {
  description = "PostgreSQL database name"
  type        = string
  default     = "han_team"
}
