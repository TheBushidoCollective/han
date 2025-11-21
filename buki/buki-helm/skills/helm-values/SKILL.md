---
name: helm-values
description: Use when managing Helm values files and configuration overrides for customizing Kubernetes deployments.
allowed-tools: []
---

# Helm Values

Managing values files and configuration overrides in Helm.

## Values Hierarchy

Helm merges values from multiple sources (lower precedence first):

1. Built-in default values
2. Chart's `values.yaml`
3. Parent chart's values
4. Values files specified with `-f` (can be multiple)
5. Individual parameters with `--set`

## values.yaml Structure

### Organize by Resource

```yaml
# Global settings
global:
  environment: production
  domain: example.com

# Application settings
app:
  name: myapp
  version: "1.0.0"

# Image settings
image:
  repository: myregistry/myapp
  pullPolicy: IfNotPresent
  tag: ""  # Overrides appVersion

# Service settings
service:
  type: ClusterIP
  port: 80
  targetPort: 8080

# Ingress settings
ingress:
  enabled: false
  className: nginx
  annotations: {}
  hosts:
    - host: myapp.example.com
      paths:
        - path: /
          pathType: Prefix
  tls: []

# Resources
resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

# Persistence
persistence:
  enabled: false
  storageClass: ""
  accessMode: ReadWriteOnce
  size: 8Gi
```

## Override Strategies

### Override with File

```bash
# Single file
helm install myrelease ./mychart -f custom-values.yaml

# Multiple files (later files override earlier)
helm install myrelease ./mychart \
  -f values-base.yaml \
  -f values-production.yaml
```

### Override with --set

```bash
# Single value
helm install myrelease ./mychart --set image.tag=2.0.0

# Multiple values
helm install myrelease ./mychart \
  --set image.tag=2.0.0 \
  --set replicaCount=5

# Nested values
helm install myrelease ./mychart \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=myapp.com
```

### Override with --set-string

```bash
# Force string type (useful for numeric-looking strings)
helm install myrelease ./mychart \
  --set-string version="1.0"
```

### Override with --set-file

```bash
# Read value from file
helm install myrelease ./mychart \
  --set-file config=./config.json
```

## Environment-Specific Values

### values-development.yaml

```yaml
replicaCount: 1

image:
  tag: "dev-latest"
  pullPolicy: Always

resources:
  limits:
    cpu: 200m
    memory: 256Mi

ingress:
  enabled: true
  hosts:
    - host: dev.myapp.com

postgresql:
  enabled: true
```

### values-production.yaml

```yaml
replicaCount: 5

image:
  tag: "1.0.0"
  pullPolicy: IfNotPresent

resources:
  limits:
    cpu: 1000m
    memory: 1Gi

ingress:
  enabled: true
  hosts:
    - host: myapp.com
  tls:
    - secretName: myapp-tls
      hosts:
        - myapp.com

postgresql:
  enabled: false
  external:
    host: prod-db.example.com
```

## Global Values

### Parent Chart values.yaml

```yaml
global:
  environment: production
  storageClass: fast-ssd

  postgresql:
    auth:
      existingSecret: db-credentials
```

### Subchart Access

```yaml
# In subchart template
environment: {{ .Values.global.environment }}
```

## Schema Validation

### values.schema.json

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["image"],
  "properties": {
    "replicaCount": {
      "type": "integer",
      "minimum": 1,
      "maximum": 10
    },
    "image": {
      "type": "object",
      "required": ["repository"],
      "properties": {
        "repository": {
          "type": "string"
        },
        "tag": {
          "type": "string"
        },
        "pullPolicy": {
          "type": "string",
          "enum": ["Always", "IfNotPresent", "Never"]
        }
      }
    },
    "service": {
      "type": "object",
      "properties": {
        "type": {
          "type": "string",
          "enum": ["ClusterIP", "NodePort", "LoadBalancer"]
        },
        "port": {
          "type": "integer",
          "minimum": 1,
          "maximum": 65535
        }
      }
    }
  }
}
```

## Secrets in Values

### Don't Commit Secrets

```yaml
# values.yaml - public defaults
database:
  host: ""
  username: ""
  password: ""

# values-secrets.yaml - not in git
database:
  host: "prod-db.example.com"
  username: "dbuser"
  password: "super-secret"
```

### Use External Secrets

```yaml
# values.yaml
database:
  useExistingSecret: true
  existingSecretName: db-credentials
```

```yaml
# In template
{{- if .Values.database.useExistingSecret }}
secretKeyRef:
  name: {{ .Values.database.existingSecretName }}
  key: password
{{- else }}
value: {{ .Values.database.password | quote }}
{{- end }}
```

## Complex Value Structures

### Lists

```yaml
# values.yaml
extraEnvVars:
  - name: LOG_LEVEL
    value: info
  - name: API_KEY
    valueFrom:
      secretKeyRef:
        name: api-secret
        key: key
```

```yaml
# template
{{- range .Values.extraEnvVars }}
- name: {{ .name }}
  {{- if .value }}
  value: {{ .value | quote }}
  {{- else if .valueFrom }}
  valueFrom:
    {{- toYaml .valueFrom | nindent 4 }}
  {{- end }}
{{- end }}
```

### Maps

```yaml
# values.yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "9090"

labels:
  team: platform
  environment: production
```

```yaml
# template
annotations:
  {{- range $key, $value := .Values.annotations }}
  {{ $key }}: {{ $value | quote }}
  {{- end }}
```

## Best Practices

### Document Values

```yaml
# values.yaml with comments
## Number of replicas
## @param replicaCount - Number of pod replicas
replicaCount: 3

## Image configuration
## @param image.repository - Docker image repository
## @param image.tag - Docker image tag (defaults to Chart appVersion)
image:
  repository: myapp
  tag: ""
```

### Sensible Defaults

```yaml
# Provide production-ready defaults
replicaCount: 3  # Not 1

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 500m  # Same as limit for guaranteed QoS
    memory: 512Mi
```

### Feature Flags

```yaml
# Allow enabling/disabling features
features:
  metrics:
    enabled: true
    port: 9090

  tracing:
    enabled: false
    endpoint: ""
```

## View Computed Values

```bash
# See final merged values
helm get values myrelease

# See all values (including defaults)
helm get values myrelease --all

# Template with values
helm template myrelease ./mychart -f custom-values.yaml
```
