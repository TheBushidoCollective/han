# Buki-Act

Validation and quality enforcement for GitHub Actions workflows with act local testing.

## Overview

Buki-Act is a Han plugin that brings GitHub Actions workflow validation and local testing capabilities directly into your Claude Code workflow. Using [act](https://github.com/nektos/act), this plugin enables you to test GitHub Actions workflows locally using Docker, catch issues before pushing to GitHub, and iterate rapidly on CI/CD configurations.

## Features

### 🪝 Automatic Validation Hooks

- **Stop Hook**: Validates all workflows before Claude Code stops
- **SubagentStop Hook**: Validates workflows when agents complete tasks
- Runs `act --dryrun` to catch syntax errors and configuration issues
- Only validates in directories containing `.github/workflows` folder
- Fast-fails to provide immediate feedback

### 📖 Comprehensive Skills

Three specialized skills provide deep knowledge of act and GitHub Actions:

#### act-workflow-syntax
Complete guide to GitHub Actions workflow files:
- Workflow structure and top-level fields
- Event triggers (push, pull_request, workflow_dispatch, schedule)
- Job configuration and dependencies
- Matrix builds and parallel execution
- Steps, actions, and commands
- Expressions, contexts, and functions
- Act-specific considerations

#### act-local-testing
Local workflow testing with act CLI:
- Installation across platforms (macOS, Linux, Windows)
- Running workflows and specific jobs
- Validation and dry runs
- Secrets and environment variables
- Debugging techniques
- Troubleshooting common issues
- Performance optimization tips

#### act-docker-setup
Docker configuration for act:
- Runner image selection (micro, medium, large, custom)
- Platform configuration with .actrc files
- Container management and lifecycle
- Volume mounts and persistent cache
- Resource limits (memory, CPU, disk)
- Security considerations
- Multi-platform builds
- Custom image creation

## Installation

Install via Han CLI:

```bash
han plugins install buki-act
```

Or clone manually:

```bash
git clone https://github.com/thebushidocollective/sensei
cd sensei/buki/buki-act
```

## Requirements

- **act**: GitHub Actions local runner
  ```bash
  # macOS
  brew install act

  # Linux
  curl -s https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

  # Windows
  choco install act-cli
  # or
  scoop install act
  ```

- **Docker**: Required for running act
  - [Docker Desktop](https://www.docker.com/products/docker-desktop) (macOS/Windows)
  - [Docker Engine](https://docs.docker.com/engine/install/) (Linux)

## Usage

### Automatic Validation

Buki-Act automatically validates workflows when:

1. **You stop Claude Code** - Ensures workflows are valid before ending session
2. **Agents complete tasks** - Validates after automated changes

The validation only runs in projects with `.github/workflows` directory and uses `act --dryrun` for fast syntax checking without executing workflows.

### Manual Testing

Use the included skills to test workflows manually:

```bash
# Validate all workflows
act --dryrun

# Run specific workflow
act -W .github/workflows/ci.yml

# Run specific job
act -j build

# Test with secrets
act --secret-file .secrets

# Use specific Docker image
act -P ubuntu-latest=catthehacker/ubuntu:act-latest
```

### Skill Invocations

Claude Code will automatically use the appropriate skill when you:

- Create or modify workflow files
- Ask about GitHub Actions syntax
- Need to test workflows locally
- Configure Docker for act
- Troubleshoot workflow issues

## Configuration

### .actrc Configuration

Create `.actrc` in your project root for consistent act settings:

```
# Platform mappings
-P ubuntu-latest=catthehacker/ubuntu:act-latest

# Default options
--reuse
--secret-file .secrets
--env-file .env

# Container options
--container-architecture linux/amd64
```

### Secrets Management

Create `.secrets` file for local testing (add to `.gitignore`):

```
GITHUB_TOKEN=ghp_your_token_here
NPM_TOKEN=npm_your_token_here
```

### Environment Variables

Create `.env` file for workflow environment variables:

```
NODE_ENV=development
DEBUG=true
LOG_LEVEL=debug
```

## Best Practices

### DO

✅ Test workflows locally before pushing
✅ Use `act --dryrun` to validate syntax
✅ Create `.actrc` for team consistency
✅ Keep `.secrets` in `.gitignore`
✅ Use `--reuse` flag for faster iteration
✅ Choose appropriate Docker image sizes
✅ Document act usage in project README

### DON'T

❌ Commit `.secrets` or `.env` files
❌ Skip validation with `--dryrun`
❌ Use `latest` Docker tags in production
❌ Ignore Docker disk space usage
❌ Assume all actions work with act
❌ Run workflows without understanding them

## Common Patterns

### Development Workflow

```bash
# 1. Edit workflow
vim .github/workflows/ci.yml

# 2. Validate syntax
act --dryrun

# 3. Test locally
act --reuse -j build

# 4. Iterate quickly
act --reuse -j build
```

### Pre-Push Validation

Add to `.git/hooks/pre-push`:

```bash
#!/bin/bash
echo "Validating workflows..."
act --dryrun
if [ $? -ne 0 ]; then
  echo "Workflow validation failed"
  exit 1
fi
```

### CI/CD Testing

```bash
# Test full pipeline
act

# Test specific events
act push
act pull_request

# Test with production secrets
act --secret-file .secrets.prod
```

## Troubleshooting

### Workflows Not Found

```bash
# Check workflow files exist
ls -la .github/workflows/

# Validate YAML syntax
yamllint .github/workflows/*.yml

# List detected workflows
act -l
```

### Docker Issues

```bash
# Check Docker is running
docker ps

# Pull required images
docker pull catthehacker/ubuntu:act-latest

# Clean up resources
docker system prune -a
```

### Permission Issues

```bash
# Fix Docker permissions (Linux)
sudo usermod -aG docker $USER
newgrp docker

# Run with proper user
act --container-options "--user $(id -u):$(id -g)"
```

## Philosophy

Buki-Act follows Han's validation and quality enforcement philosophy:

1. **Validate Early** - Catch issues before they reach GitHub
2. **Local-First** - Test workflows on your machine, not in CI
3. **Fast Feedback** - Immediate validation on Stop/SubagentStop
4. **Minimal Friction** - Automatic validation only in relevant projects
5. **Educational** - Comprehensive skills teach act and GitHub Actions

## Related Plugins

- **bushido:proof-of-work** - Requires evidence of test execution
- **bushido:test-driven-development** - TDD principles and practices
- **bushido:code-reviewer** - Code review and quality checks

## Resources

- [Act GitHub Repository](https://github.com/nektos/act)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Act Runner Images](https://github.com/catthehacker/docker_images)
- [GitHub Actions Marketplace](https://github.com/marketplace?type=actions)

## License

MIT License - See LICENSE file for details

## Contributing

Contributions welcome! Please read CONTRIBUTING.md for guidelines.

## Support

- GitHub Issues: https://github.com/thebushidocollective/sensei/issues
- Documentation: https://thebushido.co
- Discord: https://discord.gg/bushido

---

Built with ❤️ by [The Bushido Collective](https://thebushido.co)
