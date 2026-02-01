# Implementation Plan: Unit 08 - Deployment Infrastructure

## Overview

This unit creates deployment infrastructure for the Han Team Platform supporting both managed cloud (han.guru) and self-hosted options.

## Phase 1: Docker Image Build Infrastructure

### Step 1.1: Create API Server Dockerfile

Location: `deploy/docker/api/Dockerfile`

Multi-stage build for the han-team API server:
- Stage 1 (builder): Use `oven/bun:1` base, install dependencies, build TypeScript
- Stage 2 (production): Minimal `oven/bun:1-slim` image, copy built artifacts
- Include health check: `HEALTHCHECK CMD curl -f http://localhost:3000/health || exit 1`
- Entry point runs migrations then starts server

### Step 1.2: Create Database Migration Image

Location: `deploy/docker/migrations/Dockerfile`

Separate migration image for init containers and standalone CLI.

## Phase 2: Docker Compose Configuration

### Step 2.1: docker-compose.yml

Location: `deploy/docker-compose/docker-compose.yml`

```yaml
services:
  api:
    image: ghcr.io/thebushidocollective/han-team:${VERSION:-latest}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://han:${POSTGRES_PASSWORD}@db:5432/han_team
      REDIS_URL: redis://redis:6379
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: han
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: han_team
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U han -d han_team"]

  redis:
    image: redis:7-alpine
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
    command: redis-server --appendonly yes

volumes:
  pgdata:
  redisdata:
```

### Step 2.2: .env.example

Document all required environment variables.

## Phase 3: Helm Chart for Kubernetes

### Step 3.1: Chart Structure

Location: `deploy/helm/han-team/`

```
han-team/
  Chart.yaml
  values.yaml
  values-production.yaml
  templates/
    _helpers.tpl
    deployment.yaml
    service.yaml
    ingress.yaml
    configmap.yaml
    secret.yaml
    pvc.yaml
    serviceaccount.yaml
    hpa.yaml
    networkpolicy.yaml
    jobs/
      migration-job.yaml
```

### Step 3.2: Chart.yaml

```yaml
apiVersion: v2
name: han-team
description: Han Team Platform - Multi-tenant Claude Code session analytics
version: 0.1.0
appVersion: "1.0.0"
dependencies:
  - name: postgresql
    version: "15.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.enabled
  - name: redis
    version: "18.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: redis.enabled
```

## Phase 4: Health Check Endpoints

```typescript
// /health - Kubernetes liveness probe
{
  status: "ok" | "error",
  version: string,
  uptime: number
}

// /ready - Kubernetes readiness probe
{
  status: "ok" | "degraded" | "error",
  checks: {
    database: "ok" | "error",
    redis: "ok" | "error",
    migrations: "ok" | "pending" | "error"
  }
}

// /metrics - Prometheus metrics endpoint
```

## Phase 5: Database Migration System

Location: `packages/han-team-server/lib/migrations/`

- Numbered migration files: `001_initial_schema.sql`, `002_add_teams.sql`
- Track migrations in `_migrations` table
- Support up and down migrations
- Run automatically on startup (configurable via AUTO_MIGRATE)

## Phase 6: CI/CD Pipeline

Location: `.github/workflows/deploy-han-team.yml`

```yaml
name: Deploy Han Team Platform

on:
  push:
    tags:
      - 'han-team-v*'
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [staging, production]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ghcr.io/thebushidocollective/han-team:${{ github.sha }}

  deploy-staging:
    needs: build
    environment: staging
    # Deploy to Fly.io

  deploy-production:
    needs: deploy-staging
    environment: production
    # Deploy with manual approval
```

### Fly.io Configuration

```toml
app = "han-team"
primary_region = "sjc"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  min_machines_running = 1

[checks.health]
  port = 3000
  type = "http"
  path = "/health"
```

## Phase 7: Logging and Monitoring

- Structured logging with OpenTelemetry
- Prometheus metrics endpoint
- Support multiple backends via OTEL_EXPORTER_OTLP_ENDPOINT

## Phase 8: Backup and Restore

### backup.sh
```bash
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/han_team_$TIMESTAMP.sql.gz"
aws s3 cp "$BACKUP_DIR/han_team_$TIMESTAMP.sql.gz" "s3://$S3_BUCKET/backups/"
```

### Kubernetes CronJob for automated backups

## Phase 9: Environment Variable Configuration

```typescript
const ConfigSchema = {
  DATABASE_URL: { required: true, secret: true },
  JWT_SECRET: { required: true, secret: true, minLength: 32 },
  SESSION_SECRET: { required: true, secret: true, minLength: 32 },
  GITHUB_CLIENT_ID: { required: false },
  GITHUB_CLIENT_SECRET: { required: false, secret: true },
  PORT: { default: 3000 },
  LOG_LEVEL: { default: 'info' },
  AUTO_MIGRATE: { default: false, type: 'boolean' },
  FREE_RETENTION_DAYS: { default: 30 },
  PRO_RETENTION_DAYS: { default: 365 },
};
```

## Phase 10: Self-Hosted Documentation

Location: `website/content/docs/self-hosted/`

- `index.md` - Overview and quick start
- `docker-compose.md` - Docker Compose setup guide
- `kubernetes.md` - Kubernetes/Helm deployment guide
- `configuration.md` - Environment variables reference
- `backup-restore.md` - Backup and restore procedures

## Implementation Sequence

1. Phase 1 (Docker Images) - Foundation
2. Phase 4 (Health Checks) - Required by Docker/K8s
3. Phase 5 (Migrations) - Database initialization
4. Phase 9 (Config Schema) - Startup validation
5. Phase 2 (Docker Compose) - Simplest deployment
6. Phase 3 (Helm Chart) - Enterprise deployment
7. Phase 6 (CI/CD) - Automated pipeline
8. Phase 7 (Logging/Monitoring) - Observability
9. Phase 8 (Backup/Restore) - Data protection
10. Phase 10 (Documentation) - User docs
