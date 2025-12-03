# Jutsu: GitLab CI

Validation and quality enforcement for GitLab CI/CD pipeline configurations.

## What This Jutsu Provides

### Validation Hooks

- **GitLab CI Lint**: Validates `.gitlab-ci.yml` syntax using `glab ci lint`

### Skills

This jutsu provides the following skills:

- **Pipeline Configuration**: Stages, workflow rules, DAG pipelines, includes
- **Job Configuration**: Scripts, environments, rules, parallel execution
- **Variables & Secrets**: CI/CD variables, secret management, OIDC
- **Artifacts & Caching**: Build artifacts, cache strategies, optimization
- **CI/CD Best Practices**: Pipeline optimization, security, organization

## Installation

Install via the Han marketplace:

```bash
npx @thebushidocollective/han plugin install jutsu-gitlab-ci
```

## Usage

Once installed, this jutsu automatically validates your GitLab CI configuration:

- When you finish a conversation with Claude Code
- When Claude Code agents complete their work

## Requirements

- [glab CLI](https://gitlab.com/gitlab-org/cli) installed and authenticated
- GitLab project with `.gitlab-ci.yml`

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.
