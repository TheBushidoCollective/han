variable "project_id" {
  description = "Shared GCP project that hosts Han: thebushido-co (project number 911514101920). Han resources are named han-* and every grant is resource-scoped. See PATH.md section 8."
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
  description = "GitHub repository allowed to use the Han identities."
  type        = string
  default     = "TheBushidoCollective/han"
}

variable "wif_pool_id" {
  description = "Han's own Workload Identity pool, created once by a human. Never the shared github pool, which admits every TheBushidoCollective repo."
  type        = string
  default     = "han-github"
}

variable "db_tier" {
  description = "Cloud SQL machine tier. db-f1-micro needs edition ENTERPRISE, which database.tf sets."
  type        = string
  default     = "db-f1-micro"
}

variable "placeholder_image" {
  description = "Image the Cloud Run service shell was created with. The deploy workflow replaces it by digest, and Terraform ignores template changes."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}
