# Railway Deployment

This directory contains Railway deployment configurations for the Han Team Platform.

## Quick Start (Terraform - Recommended)

For Infrastructure as Code approach, use the Terraform configuration:

```bash
cd ../terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your secrets
export RAILWAY_TOKEN="your-token"
terraform init && terraform apply
```

See [`../terraform/README.md`](../terraform/README.md) for details.

## Services

Railway hosts the backend services:

1. **API Server** (`packages/han-rs/`)
   - Rust-based API server (han-server)
   - Requires PostgreSQL and Redis
   - Health check: `/health`

2. **Certificate Server** (`cert-server/`)
   - Already configured with `railway.toml`

**Note:** The website (`website/`) is hosted on GitHub Pages, not Railway.

## Setup Instructions

### 1. Create Railway Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway init
```

### 2. Configure Services

In the Railway dashboard:

1. **Add PostgreSQL service** (Railway template)
2. **Add Redis service** (Railway template)
3. **Add API Server service** - point to `packages/han-rs/`

### 3. Set Environment Variables

#### API Server Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection (auto from Railway) | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | Redis connection (auto from Railway) | `${{Redis.REDIS_URL}}` |
| `JWT_SECRET` | JWT signing secret | Generate with `openssl rand -hex 32` |
| `SESSION_SECRET` | Session encryption secret | Generate with `openssl rand -hex 32` |
| `MASTER_ENCRYPTION_KEY` | Session data encryption key | Generate with `openssl rand -hex 32` |
| `NODE_ENV` | Environment | `production` or `staging` |
| `AUTO_MIGRATE` | Run migrations on startup | `true` |
| `PORT` | Server port | `3000` (default) |

#### Optional OAuth Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |

### 4. Enable Branch Deployments

In Railway dashboard:

1. Go to **Project Settings** → **Environments**
2. Enable **PR Environments** for preview deployments
3. Each PR creates isolated environment with own database

### 5. Configure Domains

- **Production**: `api.han.guru` → API Server
- **PR Previews**: Auto-generated `*.up.railway.app` domains

**Note:** Website (`han.guru`) is hosted on GitHub Pages.

## Environment Isolation

Railway PR environments are fully isolated:

- Separate PostgreSQL instance per PR
- Separate Redis instance per PR
- Unique URLs for each PR

## Monitoring

Railway provides:
- Real-time logs
- Resource usage metrics
- Deployment history
- Health check status

## Cost Considerations

- **Hobby Plan**: Limited hours, good for development
- **Pro Plan**: Recommended for production
- PR previews consume resources while active

## Local Development

For local development, use the docker-compose setup instead:

```bash
cd deploy/docker-compose
cp .env.example .env
docker-compose up -d
```
