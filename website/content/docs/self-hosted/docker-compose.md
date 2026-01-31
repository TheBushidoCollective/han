---
title: Docker Compose Deployment
description: Deploy Han Team Platform with Docker Compose
---

# Docker Compose Deployment

Docker Compose is the simplest way to deploy Han Team Platform for small teams or development environments.

## Prerequisites

- Docker Engine 24.0+
- Docker Compose 2.20+
- 4 GB RAM minimum
- 10 GB disk space

## Installation

### 1. Get the Configuration

```bash
# Clone the repository
git clone https://github.com/TheBushidoCollective/han.git
cd han/deploy/docker-compose

# Or download just the compose files
curl -LO https://raw.githubusercontent.com/TheBushidoCollective/han/main/deploy/docker-compose/docker-compose.yml
curl -LO https://raw.githubusercontent.com/TheBushidoCollective/han/main/deploy/docker-compose/.env.example
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Generate required secrets
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" >> .env
```

Edit `.env` to configure GitHub OAuth and other settings.

### 3. Start the Stack

```bash
# Start in detached mode
docker compose up -d

# Watch the logs
docker compose logs -f

# Check status
docker compose ps
```

### 4. Verify Installation

```bash
# Health check
curl http://localhost:3000/health

# Readiness check (waits for database)
curl http://localhost:3000/ready
```

## Configuration

### Required Variables

| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `JWT_SECRET` | JWT signing secret (32+ chars) |
| `SESSION_SECRET` | Session encryption secret (32+ chars) |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_PORT` | `3000` | External port for API |
| `LOG_LEVEL` | `info` | Logging level |
| `VERSION` | `latest` | Docker image version |
| `GITHUB_CLIENT_ID` | - | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | - | GitHub OAuth secret |

## Operations

### Updating

```bash
# Pull latest images
docker compose pull

# Recreate containers
docker compose up -d
```

### Backup

```bash
# Backup PostgreSQL
docker compose exec db pg_dump -U han han_team | gzip > backup.sql.gz

# Backup Redis
docker compose exec redis redis-cli BGSAVE
```

### Restore

```bash
# Restore PostgreSQL
gunzip -c backup.sql.gz | docker compose exec -T db psql -U han han_team
```

### Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api

# Last 100 lines
docker compose logs --tail 100 api
```

### Scaling

```bash
# Scale API instances (requires load balancer)
docker compose up -d --scale api=3
```

## Troubleshooting

### API Won't Start

```bash
# Check if database is ready
docker compose exec db pg_isready -U han

# Check API logs
docker compose logs api
```

### Database Connection Failed

```bash
# Verify database is running
docker compose ps db

# Check database logs
docker compose logs db

# Test connection
docker compose exec api curl -f http://localhost:3000/ready
```

### Redis Connection Failed

```bash
# Verify Redis is running
docker compose ps redis

# Test connection
docker compose exec redis redis-cli ping
```

## Security Recommendations

1. **Change default passwords** - Never use the example passwords in production
2. **Enable TLS** - Use a reverse proxy (nginx, Traefik) with TLS
3. **Restrict network access** - Use firewall rules to limit database access
4. **Regular backups** - Set up automated backup scripts
5. **Monitor logs** - Use a log aggregation service

## Adding TLS with Traefik

```yaml
# docker-compose.override.yml
services:
  traefik:
    image: traefik:v3.0
    command:
      - "--providers.docker=true"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.le.acme.tlschallenge=true"
      - "--certificatesresolvers.le.acme.email=admin@example.com"
      - "--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json"
    ports:
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt
    networks:
      - han-network

  api:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=Host(`team.example.com`)"
      - "traefik.http.routers.api.entrypoints=websecure"
      - "traefik.http.routers.api.tls.certresolver=le"

volumes:
  letsencrypt:
```
