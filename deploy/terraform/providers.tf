terraform {
  required_version = ">= 1.0"

  required_providers {
    railway = {
      source  = "terraform-community-providers/railway"
      version = "~> 0.4"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    sentry = {
      source  = "jianyuan/sentry"
      version = "~> 0.14"
    }
  }

  # Terraform Cloud for remote state and VCS-triggered runs
  cloud {
    organization = "bushido-collective"

    workspaces {
      name = "han-team-platform"
    }
  }
}

provider "railway" {
  # Token is read from RAILWAY_TOKEN environment variable
  # Get a token from: https://railway.app/account/tokens
}

provider "google" {
  # Credentials via GOOGLE_CREDENTIALS or Workload Identity
  # Project set via variable
}

provider "sentry" {
  # Token is read from SENTRY_AUTH_TOKEN environment variable
  # Get a token from: https://sentry.io/settings/account/api/auth-tokens/
}
