---
title: Self-Hosted Deployment
description: Run Han Team Platform on your own infrastructure
---

# Self-Hosted Deployment

Han Team Platform can be deployed on your own infrastructure for complete data sovereignty and compliance requirements.

## Quick Start

### Docker Compose (Recommended for Small Teams)

The fastest way to get started:

```bash
# Clone the repository
git clone https://github.com/TheBushidoCollective/han.git
cd han/deploy/docker-compose

# Copy and configure environment
cp .env.example .env
# Edit .env with your settings

# Generate secrets
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" >> .env

# Start the stack
docker compose up -d

# Verify it's running
curl http://localhost:3000/health
```

### Kubernetes (Recommended for Production)

For production deployments, use our Helm chart:

```bash
# Add the Han Helm repository
helm repo add han https://charts.han.guru
helm repo update

# Install with custom values
helm install han-team han/han-team \
  --namespace han-team \
  --create-namespace \
  --set secrets.jwtSecret="your-jwt-secret" \
  --set secrets.sessionSecret="your-session-secret"
```

## Deployment Options

| Option | Best For | Complexity |
|--------|----------|------------|
| [Docker Compose](./docker-compose) | Small teams, development | Low |
| [Kubernetes/Helm](./kubernetes) | Production, enterprise | Medium |
| [Manual](./manual) | Custom environments | High |

## Requirements

### Minimum

- 2 CPU cores
- 2 GB RAM
- 10 GB disk space
- PostgreSQL 15+
- Redis 7+

### Recommended (Production)

- 4+ CPU cores
- 4+ GB RAM
- 50+ GB SSD
- Managed PostgreSQL (RDS, Cloud SQL)
- Managed Redis (ElastiCache, Memorystore)

## Architecture Overview

```
                    ┌─────────────────┐
                    │   Load Balancer │
                    │   (nginx/ALB)   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
        ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
        │   API 1   │  │   API 2   │  │   API N   │
        └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
              ┌──────────────┼──────────────┐
              │                             │
        ┌─────▼─────┐               ┌───────▼───────┐
        │ PostgreSQL│               │     Redis     │
        │ (primary) │               │   (session)   │
        └───────────┘               └───────────────┘
```

## Next Steps

1. **[Configuration Reference](./configuration)** - All environment variables
2. **[Docker Compose Guide](./docker-compose)** - Detailed Docker setup
3. **[Kubernetes Guide](./kubernetes)** - Helm chart deployment
4. **[Backup & Restore](./backup-restore)** - Data protection
