---
title: Kubernetes Deployment
description: Deploy Han Team Platform on Kubernetes with Helm
---

For production deployments, we recommend using our Helm chart which provides:

- Horizontal Pod Autoscaling (HPA)
- Pod Disruption Budgets (PDB)
- Network Policies
- TLS/Ingress configuration
- Automated database migrations

## Prerequisites

- Kubernetes 1.28+
- Helm 3.12+
- kubectl configured for your cluster
- Ingress controller (nginx recommended)
- cert-manager (for TLS)

## Installation

### 1. Add Helm Repository

```bash
helm repo add han https://charts.han.guru
helm repo update
```

### 2. Create Namespace

```bash
kubectl create namespace han-team
```

### 3. Create Secrets

```bash
# Generate secrets
JWT_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
PG_PASSWORD=$(openssl rand -hex 16)

# Create Kubernetes secret
kubectl create secret generic han-team-secrets \
  --namespace han-team \
  --from-literal=jwt-secret=$JWT_SECRET \
  --from-literal=session-secret=$SESSION_SECRET \
  --from-literal=postgres-password=$PG_PASSWORD
```

### 4. Install Chart

```bash
# Basic installation
helm install han-team han/han-team \
  --namespace han-team \
  --set secrets.existingSecret=han-team-secrets

# With custom values
helm install han-team han/han-team \
  --namespace han-team \
  --values values-custom.yaml
```

### 5. Configure Ingress

```yaml
# values-custom.yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: team.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: han-team-tls
      hosts:
        - team.example.com
```

## Configuration

### Minimal values.yaml

```yaml
secrets:
  existingSecret: han-team-secrets

postgresql:
  enabled: true
  auth:
    existingSecret: han-team-secrets
    secretKeys:
      adminPasswordKey: postgres-password

redis:
  enabled: true
```

### Production values.yaml

```yaml
replicaCount: 3

resources:
  limits:
    cpu: 2000m
    memory: 2Gi
  requests:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70

config:
  logLevel: warn
  autoMigrate: false

migration:
  enabled: true

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
  hosts:
    - host: team.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: han-team-tls
      hosts:
        - team.example.com

postgresql:
  enabled: true
  primary:
    persistence:
      size: 100Gi
    resources:
      limits:
        cpu: 2000m
        memory: 4Gi

redis:
  enabled: true
  master:
    persistence:
      size: 5Gi
```

### Using External Database

```yaml
postgresql:
  enabled: false

externalDatabase:
  host: your-rds-instance.region.rds.amazonaws.com
  port: 5432
  database: han_team
  username: han
  existingSecret: rds-credentials
  existingSecretPasswordKey: password
```

## Operations

### Upgrading

```bash
# Update repository
helm repo update

# View changes
helm diff upgrade han-team han/han-team \
  --namespace han-team \
  --values values-custom.yaml

# Upgrade
helm upgrade han-team han/han-team \
  --namespace han-team \
  --values values-custom.yaml
```

### Rollback

```bash
# View history
helm history han-team --namespace han-team

# Rollback to previous
helm rollback han-team --namespace han-team

# Rollback to specific revision
helm rollback han-team 3 --namespace han-team
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment han-team \
  --namespace han-team \
  --replicas=5

# Or update HPA
kubectl patch hpa han-team \
  --namespace han-team \
  --patch '{"spec":{"maxReplicas":30}}'
```

### Monitoring

```bash
# View pods
kubectl get pods -n han-team -w

# View logs
kubectl logs -n han-team -l app.kubernetes.io/name=han-team -f

# View metrics
kubectl top pods -n han-team
```

## Troubleshooting

### Pods Not Starting

```bash
# Check events
kubectl get events -n han-team --sort-by='.lastTimestamp'

# Describe pod
kubectl describe pod -n han-team -l app.kubernetes.io/name=han-team

# Check init container logs (migration)
kubectl logs -n han-team <pod-name> -c migration
```

### Database Issues

```bash
# Exec into pod
kubectl exec -it -n han-team <pod-name> -- /bin/sh

# Test database connection
psql $DATABASE_URL -c "SELECT 1"
```

### Network Issues

```bash
# Test service DNS
kubectl run -it --rm debug --image=busybox --restart=Never -- \
  nslookup han-team.han-team.svc.cluster.local

# Test connectivity
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl -f http://han-team.han-team.svc.cluster.local:3000/health
```

## High Availability

### Multi-Zone Deployment

```yaml
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app.kubernetes.io/name: han-team
          topologyKey: topology.kubernetes.io/zone

topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: ScheduleAnyway
    labelSelector:
      matchLabels:
        app.kubernetes.io/name: han-team
```

### Database High Availability

For production, use managed PostgreSQL with automatic failover:

- **AWS**: RDS Multi-AZ
- **GCP**: Cloud SQL with HA
- **Azure**: Azure Database for PostgreSQL - Flexible Server
