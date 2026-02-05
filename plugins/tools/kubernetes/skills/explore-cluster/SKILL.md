---
description: Explore Kubernetes cluster resources and workloads
---

# Explore Kubernetes Cluster

## Name

kubernetes:explore-cluster - Explore Kubernetes cluster resources and workloads

## Synopsis

```
/explore-cluster [namespace] [resource-type]
```

## Description

Explore resources in a Kubernetes cluster. List pods, deployments, services, and other workloads. Filter by namespace or resource type.

## Arguments

- `namespace` - Optional namespace to explore (default: all namespaces)
- `resource-type` - Optional resource type (pods, deployments, services, etc.)

## Implementation

1. Connect to cluster using kubectl configuration
2. If namespace specified, filter to that namespace
3. If resource-type specified, list that type only
4. Otherwise, provide overview of major resource types
5. Format output with status indicators

## Example Interaction

```
User: /explore-cluster production

Claude: Exploring Kubernetes cluster in namespace 'production'...

Pods (8 total):
| Name                      | Status  | Restarts | Age  | Node        |
|---------------------------|---------|----------|------|-------------|
| api-server-7d9f8b-abc12   | Running | 0        | 5d   | node-1      |
| api-server-7d9f8b-def34   | Running | 0        | 5d   | node-2      |
| web-frontend-5c8d7e-gh56  | Running | 0        | 3d   | node-1      |
| worker-8f9a0b-ij78        | Running | 2        | 1d   | node-3      |

Deployments (3 total):
| Name         | Ready | Replicas | Strategy      |
|--------------|-------|----------|---------------|
| api-server   | 2/2   | 2        | RollingUpdate |
| web-frontend | 1/1   | 1        | RollingUpdate |
| worker       | 1/1   | 1        | Recreate      |

Services (3 total):
| Name         | Type        | Cluster-IP   | External-IP   | Ports      |
|--------------|-------------|--------------|---------------|------------|
| api-server   | ClusterIP   | 10.0.0.100   | <none>        | 8080/TCP   |
| web-frontend | LoadBalancer| 10.0.0.101   | 34.56.78.90   | 80/TCP     |
| worker       | ClusterIP   | 10.0.0.102   | <none>        | 9090/TCP   |
```

## Notes

- Requires kubectl configured with cluster access
- Use `-A` flag equivalent to see all namespaces
- Some resources require cluster-admin permissions
