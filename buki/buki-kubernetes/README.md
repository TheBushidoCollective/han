# Kubernetes Buki

Kubernetes manifest validation and best practices for cloud-native deployments.

## Features

- Validates Kubernetes manifests using kubeconform
- Provides skills for working with Kubernetes resources
- Ensures manifest quality and security best practices

## Requirements

Install kubeconform for manifest validation:

```bash
# macOS
brew install kubeconform

# Linux
wget https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz
tar xf kubeconform-linux-amd64.tar.gz
sudo mv kubeconform /usr/local/bin/
```

## Skills Included

- **kubernetes-manifests**: Working with Kubernetes manifest files
- **kubernetes-resources**: Understanding Kubernetes resources (Pods, Deployments, Services, etc.)
- **kubernetes-security**: Security best practices for Kubernetes

## Hook Behavior

Validates YAML manifests in directories containing `.yaml` or `.yml` files using kubeconform.
