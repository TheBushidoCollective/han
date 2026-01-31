---
status: completed
depends_on: ["01-core-backend"]
branch: ai-dlc/han-team-platform/08-deployment
---

# unit-08-deployment

## Description

Create deployment infrastructure for both managed cloud (han.guru) and self-hosted options. Includes Docker Compose for simpler setups and Helm chart for Kubernetes/enterprise deployments.

## Success Criteria

- [ ] Docker Compose configuration for self-hosted
- [ ] Helm chart for Kubernetes deployment
- [ ] Environment variable configuration
- [ ] Database migration on startup
- [ ] Health check endpoints
- [ ] Logging and monitoring setup
- [ ] Backup and restore procedures
- [ ] CI/CD pipeline for cloud deployment
- [ ] Documentation for self-hosted setup

## Technical Notes

### Docker Compose Stack
```yaml
services:
  api:
    image: ghcr.io/thebushidocollective/han-team:latest
    environment:
      DATABASE_URL: postgres://...
      GITHUB_CLIENT_ID: ...
  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data
  redis:
    image: redis:7
    # For session cache, rate limiting
```

### Helm Chart Structure
```
han-team/
  Chart.yaml
  values.yaml
  templates/
    deployment.yaml
    service.yaml
    ingress.yaml
    configmap.yaml
    secret.yaml
    pvc.yaml
```

### Cloud Deployment (han.guru)
- Hosted on Fly.io or Railway (evaluate)
- PostgreSQL via managed service
- Redis for caching
- S3-compatible storage for large files
- GitHub Actions for CI/CD

### Configuration
- All secrets via environment variables
- Sensible defaults for self-hosted
- Override via values.yaml (Helm) or .env (Compose)
- Validate config on startup
