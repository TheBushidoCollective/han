# Helm

Helm chart validation and best practices for Kubernetes package management.

## Features

- Validates Helm charts with `helm lint`
- Tests chart templates with `helm template`
- Provides skills for working with Helm charts, templates, and values

## Requirements

Install Helm:

```bash
# macOS
brew install helm

# Linux
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

## Skills Included

- **helm-charts**: Understanding and creating Helm charts
- **helm-templates**: Working with Helm templates and functions
- **helm-values**: Managing values files and overrides

## Hook Behavior

Validates Helm charts in directories containing `Chart.yaml` using `helm lint` and `helm template`.

## Installation

```bash
han plugin install helm
```
