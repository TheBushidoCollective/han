---
title: Configuration Reference
description: Complete list of Han Team Platform configuration options
---

# Configuration Reference

Han Team Platform is configured through environment variables. All settings have sensible defaults for development, but production deployments require explicit configuration.

## Required Variables

These must be set for the server to start:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host:5432/db` |
| `JWT_SECRET` | Secret for signing JWT tokens | 32+ character random string |
| `SESSION_SECRET` | Secret for encrypting sessions | 32+ character random string |

## Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | - | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |

### Connection String Format

```
postgres://[user]:[password]@[host]:[port]/[database]?[options]
```

**Options:**
- `sslmode=require` - Require SSL (recommended for cloud databases)
- `connect_timeout=10` - Connection timeout in seconds

**Examples:**

```bash
# Local development
DATABASE_URL=postgres://han:password@localhost:5432/han_team

# AWS RDS
DATABASE_URL=postgres://han:password@my-db.region.rds.amazonaws.com:5432/han_team?sslmode=require

# Cloud SQL via Unix socket
DATABASE_URL=postgres://han:password@/han_team?host=/cloudsql/project:region:instance
```

## Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | - | Secret for JWT signing (min 32 chars) |
| `SESSION_SECRET` | - | Secret for session encryption (min 32 chars) |
| `GITHUB_CLIENT_ID` | - | GitHub OAuth application client ID |
| `GITHUB_CLIENT_SECRET` | - | GitHub OAuth application client secret |

### Generating Secrets

```bash
# Using OpenSSL
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using /dev/urandom
head -c 32 /dev/urandom | base64
```

### Setting Up GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: Han Team (Production)
   - **Homepage URL**: `https://team.example.com`
   - **Authorization callback URL**: `https://team.example.com/api/auth/github/callback`
4. Copy the Client ID and Client Secret

## Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server listen port |
| `NODE_ENV` | `development` | Environment: development, staging, production |
| `LOG_LEVEL` | `info` | Logging: debug, info, warn, error |
| `AUTO_MIGRATE` | `false` | Run migrations on startup |

## Data Retention

| Variable | Default | Description |
|----------|---------|-------------|
| `FREE_RETENTION_DAYS` | `30` | Days to retain data for free tier |
| `PRO_RETENTION_DAYS` | `365` | Days to retain data for pro tier |

## Observability

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | - | OpenTelemetry collector endpoint |
| `OTEL_SERVICE_NAME` | `han-team` | Service name for traces |

### OpenTelemetry Configuration

```bash
# Jaeger
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318

# Honeycomb
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
OTEL_EXPORTER_OTLP_HEADERS=x-honeycomb-team=your-api-key

# Datadog
OTEL_EXPORTER_OTLP_ENDPOINT=https://trace.agent.datadoghq.com
```

## Full Example

### Development (.env)

```bash
# Database
DATABASE_URL=postgres://han:devpassword@localhost:5432/han_team
REDIS_URL=redis://localhost:6379

# Auth (generate new ones!)
JWT_SECRET=dev-jwt-secret-minimum-32-characters-long
SESSION_SECRET=dev-session-secret-minimum-32-chars

# Server
PORT=3000
NODE_ENV=development
LOG_LEVEL=debug
AUTO_MIGRATE=true
```

### Production (.env)

```bash
# Database (use managed services)
DATABASE_URL=postgres://han:${DB_PASSWORD}@prod-db.region.rds.amazonaws.com:5432/han_team?sslmode=require
REDIS_URL=redis://prod-redis.region.cache.amazonaws.com:6379

# Auth (use secrets manager)
JWT_SECRET=${JWT_SECRET_FROM_SECRETS_MANAGER}
SESSION_SECRET=${SESSION_SECRET_FROM_SECRETS_MANAGER}

# GitHub OAuth
GITHUB_CLIENT_ID=Iv1.abc123
GITHUB_CLIENT_SECRET=${GITHUB_SECRET_FROM_SECRETS_MANAGER}

# Server
PORT=3000
NODE_ENV=production
LOG_LEVEL=warn
AUTO_MIGRATE=false

# Retention
FREE_RETENTION_DAYS=30
PRO_RETENTION_DAYS=365

# Observability
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io
```

## Kubernetes ConfigMap Example

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: han-team-config
data:
  PORT: "3000"
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  AUTO_MIGRATE: "false"
  FREE_RETENTION_DAYS: "30"
  PRO_RETENTION_DAYS: "365"
```

## Validation

The server validates all configuration on startup. If required variables are missing or invalid, it will print clear error messages and exit:

```
Configuration validation failed:
  - DATABASE_URL: Required
  - JWT_SECRET: Must be at least 32 characters

Required environment variables:
  - DATABASE_URL: PostgreSQL connection string
  - JWT_SECRET: Secret for JWT signing (min 32 chars)
  - SESSION_SECRET: Secret for sessions (min 32 chars)
```
