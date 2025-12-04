# Kustomize Jutsu

Kustomize configuration validation for Kubernetes customization.

## Features

- Validates Kustomize configurations with `kustomize build`
- Provides skills for working with Kustomize

## Requirements

Install Kustomize:

```bash
# macOS
brew install kustomize

# Linux
curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
```

## Skills Included

- **kustomize-basics**: Kustomize configuration and usage

## Hook Behavior

Validates Kustomize configurations in directories containing `kustomization.yaml` using `kustomize build`.

## Installation

Install with npx (no installation required):

```bash
npx @thebushidocollective/han plugin install jutsu-kustomize
```
