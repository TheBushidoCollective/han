# GitLab CI

Validation and quality enforcement for GitLab CI/CD pipeline configurations.

## What This Plugin Provides

### Validation Hooks

- **GitLab CI Lint**: Validates `.gitlab-ci.yml` syntax using `glab ci lint`

### Skills

This plugin provides the following skills:

- **Pipeline Configuration**: Stages, workflow rules, DAG pipelines, includes
- **Job Configuration**: Scripts, environments, rules, parallel execution
- **Variables & Secrets**: CI/CD variables, secret management, OIDC
- **Artifacts & Caching**: Build artifacts, cache strategies, optimization
- **CI/CD Best Practices**: Pipeline optimization, security, organization

## Installation

```bash
han plugin install gitlab-ci
```

## Usage

Once installed, this plugin automatically validates your GitLab CI configuration:

- When you finish a conversation with Claude Code
- When Claude Code agents complete their work

## Requirements

- [glab CLI](https://gitlab.com/gitlab-org/cli) installed and authenticated
- GitLab project with `.gitlab-ci.yml`
