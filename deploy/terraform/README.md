# Railway Infrastructure with Terraform Cloud

Infrastructure as Code for the Han Team Platform, managed via Terraform Cloud VCS integration.

## How It Works

Terraform Cloud watches the `deploy/terraform/` directory:
- **PR opened** → Speculative plan runs (visible in TF Cloud)
- **PR merged to main** → Apply run queued (requires approval if configured)
- **Manual runs** → Trigger via TF Cloud UI

No GitHub Actions required - TF Cloud handles everything.

## Initial Setup

### 1. Create Terraform Cloud Workspace

1. Go to https://app.terraform.io
2. Create organization `bushido-collective` (or update `providers.tf`)
3. Create workspace `han-team-platform`
4. Set **Execution Mode** to "Remote"

### 2. Connect VCS

1. In workspace settings → Version Control
2. Connect to GitHub
3. Select `thebushidocollective/han-team-platform`
4. Set **Terraform Working Directory** to `deploy/terraform`

### 3. Configure Variables

In workspace → Variables, add:

**Terraform Variables:**
| Variable | Sensitive | Value |
|----------|-----------|-------|
| `jwt_secret` | Yes | `openssl rand -hex 32` |
| `session_secret` | Yes | `openssl rand -hex 32` |
| `master_encryption_key` | Yes | `openssl rand -hex 32` |
| `api_custom_domain` | No | `api.han.guru` |
| `website_custom_domain` | No | `han.guru` |
| `sentry_organization_slug` | No | `bushido-collective` |
| `gcp_project_id` | No | Your GCP project ID |

**Environment Variables:**
| Variable | Sensitive | Description |
|----------|-----------|-------------|
| `RAILWAY_TOKEN` | Yes | Railway API token |
| `SENTRY_AUTH_TOKEN` | Yes | Sentry API token |
| `GOOGLE_CREDENTIALS` | Yes | GCP service account JSON |

### 4. Enable Auto-Apply (Optional)

For automatic deploys on merge:
1. Workspace Settings → General
2. Enable "Auto-apply" for successful runs

Or keep manual approval for production safety.

## What Gets Created

| Resource | Description |
|----------|-------------|
| Railway Project | With PR preview environments enabled |
| PostgreSQL | Postgres 16 with persistent volume |
| Redis | Redis 7 with persistent volume |
| API Server | han-team-server with env vars |
| Website | Next.js site with env vars |
| Sentry Projects | Error tracking for API and website |
| GCP DNS Records | CNAME records pointing to Railway |

## Local Development

For local terraform commands:

```bash
cd deploy/terraform
terraform login  # Authenticate with TF Cloud
terraform init   # Initialize with cloud backend
terraform plan   # Plans run remotely
```

## Module Structure

```
deploy/terraform/
├── main.tf                 # Root module composition
├── variables.tf            # Input variables
├── outputs.tf              # Output values
├── providers.tf            # Provider configuration
└── modules/
    ├── project/            # Railway project
    ├── postgres/           # PostgreSQL service
    ├── redis/              # Redis service
    ├── api/                # API server service
    ├── website/            # Website service
    ├── sentry/             # Sentry projects
    └── dns/                # GCP Cloud DNS
```
