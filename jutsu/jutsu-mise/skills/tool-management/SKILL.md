---
name: mise-tool-management
description: Use when managing development tool versions with Mise. Covers installing tools, version pinning, and replacing language-specific version managers.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Mise - Tool Management

Managing development tool versions across projects with Mise as a unified version manager.

## Basic Tool Installation

### Installing Tools

```bash
# Install specific version
mise install node@20.10.0
mise install python@3.12.0
mise install rust@1.75.0

# Install latest version
mise install node@latest
mise install python@latest

# Install from .tool-versions or mise.toml
mise install
```

### Setting Tool Versions

```bash
# Set global version
mise use --global node@20

# Set project version
mise use node@20.10.0
mise use python@3.12 rust@1.75

# Use latest
mise use node@latest
```

## Tool Configuration in mise.toml

### Basic Tool Definitions

```toml
# mise.toml
[tools]
node = "20.10.0"
python = "3.12.0"
rust = "1.75.0"
terraform = "1.6.0"
```

### Version Prefixes

```toml
[tools]
# Latest patch version
node = "20.10"

# Latest minor version
node = "20"

# Latest version
node = "latest"

# Prefix notation
terraform = "1.6"  # Latest 1.6.x
```

### Multiple Versions

```toml
[tools]
# Use multiple versions
node = ["20.10.0", "18.19.0"]
python = ["3.12", "3.11", "3.10"]
```

```bash
# Switch between versions
mise shell node@18.19.0
```

## Tool-Specific Configuration

### Node.js Configuration

```toml
[tools]
node = { version = "20.10.0", postinstall = "corepack enable" }
```

### Python with Virtual Environments

```toml
[tools]
python = "3.12"

[env]
_.python.venv = { path = ".venv", create = true }
```

### Custom Tool Sources

```toml
[tools]
# From specific registry
"cargo:eza" = "latest"
"npm:typescript" = "5.3"

# From git repository
my-tool = "git:https://github.com/org/tool.git"
```

## Supported Languages & Tools

### Core Tools

```toml
[tools]
# Languages
bun = "1.0"
deno = "1.38"
elixir = "1.15"
erlang = "26.1"
go = "1.21"
java = "21"
node = "20.10"
python = "3.12"
ruby = "3.3"
rust = "1.75"
zig = "0.11"

# Infrastructure
terraform = "1.6"
kubectl = "1.28"
awscli = "2.13"
```

### Package Managers

```toml
[tools]
"npm:pnpm" = "8.10"
"npm:yarn" = "4.0"
"cargo:cargo-binstall" = "latest"
"go:github.com/golangci/golangci-lint/cmd/golangci-lint" = "latest"
```

## Tool Version Strategies

### Lock to Specific Versions

```toml
# Production: Pin exact versions
[tools]
node = "20.10.0"
terraform = "1.6.4"
```

### Use Ranges for Flexibility

```toml
# Development: Use minor version ranges
[tools]
node = "20"      # Any 20.x
python = "3.12"  # Any 3.12.x
```

### Latest for Experimentation

```toml
# Experimental projects
[tools]
rust = "latest"
bun = "latest"
```

## Managing Tool Aliases

### Creating Aliases

```bash
# Set alias for current directory
mise alias set node lts 20.10.0

# Set global alias
mise alias set --global python3 python@3.12
```

### Using Aliases in Configuration

```toml
[tools]
node = "lts"
python = "3.12"
```

## Tool Verification

### Check Installed Tools

```bash
# List installed tools
mise list

# Check current versions
mise current

# Verify tool installation
mise doctor
```

### Tool Information

```bash
# Show tool details
mise ls-remote node

# List available versions
mise ls-remote python

# Check latest version
mise latest node
```

## Migration from Other Version Managers

### From asdf

```bash
# Mise reads .tool-versions files
cat .tool-versions
# nodejs 20.10.0
# python 3.12.0

# Migrate to mise.toml
mise use node@20.10.0 python@3.12.0
```

### From nvm

```bash
# Read from .nvmrc
cat .nvmrc
# 20.10.0

mise use node@$(cat .nvmrc)
```

### From pyenv

```bash
# Read from .python-version
mise use python@$(cat .python-version)
```

## Best Practices

### Pin Production Dependencies

```toml
# Good: Explicit production versions
[tools]
node = "20.10.0"
terraform = "1.6.4"
postgres = "16.1"
```

### Document Required Tools

```toml
# mise.toml - All project dependencies in one place
[tools]
node = "20.10.0"
python = "3.12.0"
terraform = "1.6.4"
kubectl = "1.28.0"

[env]
PROJECT_NAME = "my-app"
```

### Use Tool-Specific Settings

```toml
[tools]
# Enable corepack for package managers
node = { version = "20.10.0", postinstall = "corepack enable" }

# Create Python virtual environment
python = { version = "3.12", venv = ".venv" }
```

### Verify Tool Installation

```bash
# In CI/CD pipelines
mise install --check
mise doctor

# Verify specific tools
mise current node
mise current python
```

## Common Patterns

### Monorepo Tool Management

```toml
# Root mise.toml - shared tools
[tools]
node = "20.10.0"
terraform = "1.6.4"

# packages/api/mise.toml - additional tools
[tools]
"npm:typescript" = "5.3"
"npm:prisma" = "5.7"

# packages/web/mise.toml
[tools]
"npm:next" = "14.0"
```

### Development vs Production

```toml
# mise.toml - production tools
[tools]
node = "20.10.0"
postgres = "16.1"

# mise.local.toml - development tools (gitignored)
[tools]
"npm:nodemon" = "latest"
"cargo:cargo-watch" = "latest"
```

### Tool Updates Strategy

```bash
# Check for updates
mise outdated

# Update to latest patch version
mise upgrade node

# Update all tools
mise upgrade

# Update with constraints
mise use node@20  # Updates to latest 20.x
```

## Anti-Patterns

### Don't Mix Version Managers

```bash
# Bad: Using multiple version managers
nvm use 20
mise use node@20  # Conflicts

# Good: Use only Mise
mise use node@20
```

### Don't Hardcode Tool Paths

```bash
# Bad: Hardcoded paths
/Users/me/.local/share/mise/installs/node/20.10.0/bin/node

# Good: Use mise shims or mise exec
mise exec -- node
mise x -- node
```

### Don't Skip Version Constraints

```toml
# Bad: No version specified
[tools]
node = "latest"  # Can break on updates

# Good: Specify constraints
[tools]
node = "20.10.0"  # Explicit
# OR
node = "20"  # Controlled range
```

### Don't Ignore Tool Dependencies

```toml
# Bad: Missing required tools
[tools]
terraform = "1.6"
# Missing: kubectl, helm for deployment

# Good: Include all dependencies
[tools]
terraform = "1.6.4"
kubectl = "1.28.0"
helm = "3.13.0"
```

## Advanced Patterns

### Conditional Tool Installation

```toml
[tools]
# Install based on platform
node = "20.10.0"
python = "3.12"

# Platform-specific tools
[tools."cargo:watchexec-cli"]
platforms = ["linux", "darwin"]
version = "latest"
```

### Tool Installation Hooks

```toml
[tools]
node = {
  version = "20.10.0",
  postinstall = '''
    corepack enable
    npm install -g npm@latest
  '''
}
```

### Backend Selection

```toml
# Use specific backend for tools
[tools]
# Use core backend (faster)
node = "core:20.10.0"

# Use asdf plugin
ruby = "asdf:3.3.0"
```

## Related Skills

- **task-configuration**: Defining tasks that use managed tools
- **environment-management**: Managing environment variables with tools
