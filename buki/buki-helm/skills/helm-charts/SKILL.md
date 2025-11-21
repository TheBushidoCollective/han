---
name: helm-charts
description: Use when understanding and creating Helm charts for packaging and deploying Kubernetes applications.
allowed-tools: []
---

# Helm Charts

Understanding and creating Helm charts for Kubernetes applications.

## Chart Structure

```
mychart/
├── Chart.yaml          # Chart metadata
├── values.yaml         # Default values
├── charts/            # Chart dependencies
├── templates/         # Template files
│   ├── NOTES.txt     # Usage notes
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── _helpers.tpl  # Template helpers
│   └── tests/        # Test files
└── .helmignore       # Files to ignore
```

## Chart.yaml

```yaml
apiVersion: v2
name: my-app
description: A Helm chart for my application
type: application
version: 1.0.0
appVersion: "1.0.0"
keywords:
  - web
  - api
maintainers:
  - name: Your Name
    email: you@example.com
dependencies:
  - name: postgresql
    version: "12.1.0"
    repository: "https://charts.bitnami.com/bitnami"
    condition: postgresql.enabled
```

## values.yaml

```yaml
replicaCount: 3

image:
  repository: myapp
  pullPolicy: IfNotPresent
  tag: "1.0.0"

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: false
  className: "nginx"
  hosts:
    - host: myapp.local
      paths:
        - path: /
          pathType: Prefix

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

autoscaling:
  enabled: false
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80
```

## Common Commands

### Create Chart

```bash
helm create mychart
```

### Install Chart

```bash
# Install from directory
helm install myrelease ./mychart

# Install with custom values
helm install myrelease ./mychart -f custom-values.yaml

# Install with value overrides
helm install myrelease ./mychart --set image.tag=2.0.0
```

### Upgrade Chart

```bash
helm upgrade myrelease ./mychart

# Upgrade or install
helm upgrade --install myrelease ./mychart
```

### Validate Chart

```bash
# Lint chart
helm lint ./mychart

# Dry run
helm install myrelease ./mychart --dry-run --debug

# Template rendering
helm template myrelease ./mychart
```

### Manage Releases

```bash
# List releases
helm list

# Get release status
helm status myrelease

# Get release values
helm get values myrelease

# Rollback
helm rollback myrelease 1

# Uninstall
helm uninstall myrelease
```

## Dependencies

### Chart.yaml

```yaml
dependencies:
  - name: redis
    version: "17.0.0"
    repository: "https://charts.bitnami.com/bitnami"
    condition: redis.enabled
    tags:
      - cache
```

### Update Dependencies

```bash
helm dependency update ./mychart
helm dependency build ./mychart
helm dependency list ./mychart
```

## Chart Repositories

```bash
# Add repository
helm repo add bitnami https://charts.bitnami.com/bitnami

# Update repositories
helm repo update

# Search charts
helm search repo nginx

# Search hub
helm search hub wordpress
```

## Best Practices

### Version Conventions

- Chart version: Semantic versioning (1.2.3)
- App version: Application version (v1.0.0)

### Default Values

Provide sensible defaults in values.yaml:

```yaml
# Good defaults
resources:
  limits:
    cpu: 100m
    memory: 128Mi
  requests:
    cpu: 100m
    memory: 128Mi

# Allow customization
config: {}
env: {}
```

### Documentation

Include NOTES.txt for post-installation instructions:

```
Thank you for installing {{ .Chart.Name }}.

Your release is named {{ .Release.Name }}.

To learn more about the release, try:

  $ helm status {{ .Release.Name }}
  $ helm get all {{ .Release.Name }}
```
