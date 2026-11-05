terraform {
  # 1.11 added write-only arguments (secret_data_wo, password_wo) and ephemeral
  # resources, which keep generated secrets out of state.
  required_version = ">= 1.11.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 6.50.0, < 8.0.0"
    }
    # Firebase Hosting and Firebase project resources are beta-only.
    google-beta = {
      source  = "hashicorp/google-beta"
      version = ">= 6.50.0, < 8.0.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.9"
    }
  }

  # Partial backend: CI passes bucket and prefix with -backend-config.
  backend "gcs" {}
}
