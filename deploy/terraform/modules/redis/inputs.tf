variable "project_id" {
  description = "Railway project ID"
  type        = string
}

variable "service_name" {
  description = "Name of the Redis service"
  type        = string
  default     = "redis"
}

variable "image" {
  description = "Redis Docker image"
  type        = string
  default     = "redis:7-alpine"
}
