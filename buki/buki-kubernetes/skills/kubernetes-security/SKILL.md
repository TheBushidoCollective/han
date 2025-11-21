---
name: kubernetes-security
description: Use when implementing Kubernetes security best practices including RBAC, pod security policies, and network policies.
allowed-tools: []
---

# Kubernetes Security

Security best practices for Kubernetes deployments.

## Pod Security

### Run as Non-Root

```yaml
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 1000
```

### Read-Only Root Filesystem

```yaml
spec:
  containers:
  - name: app
    securityContext:
      readOnlyRootFilesystem: true
    volumeMounts:
    - name: tmp
      mountPath: /tmp
  volumes:
  - name: tmp
    emptyDir: {}
```

### Drop Capabilities

```yaml
spec:
  containers:
  - name: app
    securityContext:
      capabilities:
        drop:
        - ALL
        add:
        - NET_BIND_SERVICE
```

### Prevent Privilege Escalation

```yaml
spec:
  containers:
  - name: app
    securityContext:
      allowPrivilegeEscalation: false
      privileged: false
```

## Network Security

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-allow
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: database
    ports:
    - protocol: TCP
      port: 5432
```

## RBAC

### ServiceAccount

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app-sa
  namespace: default
```

### Role

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]
```

### RoleBinding

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
subjects:
- kind: ServiceAccount
  name: app-sa
  namespace: default
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

## Secrets Management

### Encrypt at Rest

Enable encryption for secrets at rest in etcd.

### External Secrets

Use external secret management:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: app-secrets
  data:
  - secretKey: password
    remoteRef:
      key: secret/data/app
      property: password
```

### Avoid Hardcoding

```yaml
# Bad
env:
- name: DB_PASSWORD
  value: "hardcoded-password"

# Good
env:
- name: DB_PASSWORD
  valueFrom:
    secretKeyRef:
      name: db-secret
      key: password
```

## Resource Limits

### Prevent Resource Exhaustion

```yaml
spec:
  containers:
  - name: app
    resources:
      limits:
        memory: "256Mi"
        cpu: "500m"
      requests:
        memory: "128Mi"
        cpu: "250m"
```

### LimitRange

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: mem-limit-range
spec:
  limits:
  - max:
      memory: 512Mi
    min:
      memory: 64Mi
    type: Container
```

### ResourceQuota

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.cpu: "20"
    limits.memory: 40Gi
```

## Image Security

### Use Specific Tags

```yaml
# Bad
image: nginx:latest

# Good
image: nginx:1.21.6
```

### Image Pull Policies

```yaml
spec:
  containers:
  - name: app
    image: myapp:1.0.0
    imagePullPolicy: IfNotPresent
```

### Private Registries

```yaml
spec:
  imagePullSecrets:
  - name: registry-credentials
  containers:
  - name: app
    image: private.registry.com/myapp:1.0.0
```

## Pod Security Standards

### Restricted Profile

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

## Security Scanning

```bash
# Scan manifests with kubesec
kubesec scan pod.yaml

# Scan images with trivy
trivy image nginx:1.21

# Policy validation with OPA
opa eval -d policy.rego -i manifest.yaml
```
