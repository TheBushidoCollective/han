---
title: "Configuration"
description: "Configure Han behavior with han.yml configuration files."
---

Han uses YAML configuration files to control plugin behavior, hook execution, and caching. Understanding the configuration hierarchy helps you customize Han for your workflow.

## Configuration Files

Han loads configuration from multiple locations in this order (later overrides earlier):

1. `~/.claude/han.yml` - User global defaults
2. `.claude/han.yml` - Project team settings (committed)
3. `.claude/han.local.yml` - Local overrides (gitignored)
4. `./han.yml` - Project root config
5. `<dir>/han.yml` - Directory-specific settings

This hierarchy allows you to:

- Set personal defaults globally
- Define team standards in version control
- Override settings locally without affecting teammates
- Customize behavior for specific directories

## Basic Configuration Structure

A typical `han.yml` file has these main sections:

```yaml
# Global hook settings
hooks:
  enabled: true            # Master switch for all hooks (default: true)
  checkpoints: true        # Session/agent checkpoint filtering (default: true)
  cache: true              # Smart caching - skip if no changes (default: true)
  transcript_filter: true  # Multi-session conflict prevention (default: true, v2.3.0)

# Orchestrator settings (controls MCP tool exposure)
orchestrator:
  enabled: true       # Use unified workflow interface (default: true)
  workflow:
    enabled: true     # Enable han_workflow tool
    max_steps: 20     # Maximum workflow steps
    timeout: 300      # Workflow timeout in seconds

# Memory system
memory:
  enabled: true       # Enable memory and learning (default: true)

# Metrics tracking
metrics:
  enabled: true       # Enable task metrics (default: true)

# Plugin-specific settings
biome:
  lint:
    enabled: true
    command: npx biome check --write .

typescript:
  typecheck:
    enabled: true
    command: npx tsc --noEmit
```

**Note:** As of v2.0.0, all settings default to **enabled** (`true`). This means features are active by default unless explicitly disabled.

## Global Hook Settings

The `hooks` section controls behavior for all hooks across all plugins:

```yaml
hooks:
  enabled: true            # Master switch - disable all hooks
  checkpoints: true        # Filter hooks by session/agent context
  cache: true              # Skip hooks when files haven't changed
  transcript_filter: true  # Filter by session's modified files (v2.3.0)
```

### Global Hook Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Master switch to enable/disable all hooks |
| `checkpoints` | boolean | `true` | Enable session-scoped filtering (only run relevant hooks) |
| `cache` | boolean | `true` | Enable smart caching to skip unchanged files |
| `transcript_filter` | boolean | `true` | Filter hooks to files THIS session modified (prevents multi-session conflicts) |

### Configuration Priority

Settings are applied in this order (later overrides earlier):

1. **Built-in defaults** - All settings default to `true` in v2.0.0
2. **`han.yml` configuration** - Values from config hierarchy
3. **CLI options** - Flags like `--no-cache`
4. **Environment variables** - `HAN_HOOKS_CACHE=false`, etc.

Example:

```bash
# Disable caching via CLI (overrides han.yml)
han hook run biome lint --cache=false

# Disable via environment variable
HAN_HOOKS_CACHE=false han hook run biome lint
```

## Per-Hook Configuration

Each plugin can define multiple hooks. You can configure them individually:

```yaml
biome:
  lint:
    enabled: true              # Enable/disable this hook
    command: npx biome check   # Override the default command
    cache: true                # Enable smart caching for this hook
    dirs_with:                 # Only run in dirs with these files
      - biome.json
    if_changed:                # Only run if these patterns changed
      - "**/*.ts"
      - "**/*.tsx"
```

### Per-Hook Options

| Option | Type | Description |
|--------|------|-------------|
| `enabled` | boolean | Enable or disable this specific hook |
| `command` | string | Command to execute |
| `cache` | boolean | Use smart caching (inherits global default: true) |
| `dirs_with` | array | File patterns that must exist |
| `if_changed` | array | Only run if matching files changed |
| `idle_timeout` | number | Milliseconds to wait for file stability |

## Plugin Configuration Keys

Han uses YAML configuration with snake_case keys:

| Key | Description |
|-----|-------------|
| `dirs_with` | Directory detection patterns |
| `dir_test` | Directory test command |
| `if_changed` | File change patterns |
| `idle_timeout` | File stability timeout |

## Example Configurations

### Minimal Configuration

```yaml
hooks:
  enabled: true

biome:
  lint:
    enabled: true
```

### Full Configuration

```yaml
# Global hook settings (all default to true in v2.0.0+)
hooks:
  enabled: true            # Master switch
  checkpoints: true        # Session filtering
  cache: true              # Smart caching
  transcript_filter: true  # Multi-session conflict prevention (v2.3.0)

biome:
  lint:
    enabled: true
    command: npx biome check --write .
    cache: true
    dirs_with:
      - biome.json
    if_changed:
      - "**/*.ts"
      - "**/*.tsx"
      - "**/*.js"

typescript:
  typecheck:
    enabled: true
    command: npx tsc --noEmit
    cache: true
    dirs_with:
      - tsconfig.json
    if_changed:
      - "**/*.ts"
      - "**/*.tsx"

markdown:
  lint:
    enabled: true
    command: npx markdownlint-cli --fix .
    if_changed:
      - "**/*.md"
```

### Directory-Specific Configuration

You can create `han.yml` files in subdirectories to override settings:

```yaml
# packages/frontend/han.yml
biome:
  lint:
    command: npx biome check --write --config ../../biome.frontend.json .
```

## Disabling Hooks

To temporarily disable a specific hook without removing the plugin:

```yaml
biome:
  lint:
    enabled: false
```

Or disable all hooks globally:

```yaml
hooks:
  enabled: false
```

You can also disable specific features:

```yaml
hooks:
  cache: false              # Always run hooks, never use cache
  checkpoints: false        # Run all hooks regardless of context
  transcript_filter: false  # Ignore session transcript, use checkpoint-only filtering
```

Or via CLI for one-off runs:

```bash
# Disable caching for this run
han hook run biome lint --cache=false
```

## Orchestrator Configuration

The orchestrator controls how MCP service tools are exposed to Claude Code.

### Orchestrator Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable unified workflow interface |
| `workflow.enabled` | boolean | `true` | Expose the `han_workflow` tool |
| `workflow.max_steps` | number | `20` | Maximum steps in a workflow |
| `workflow.timeout` | number | `300` | Workflow timeout in seconds |

### How It Works

When orchestrator is **enabled** (default):

- MCP servers return no tools (stub mode)
- Han exposes a unified `han_workflow` tool
- Reduces context from 50+ tools to ~5
- Workflows can invoke any backend capability

When orchestrator is **disabled**:

- MCP servers proxy to actual backends
- All individual MCP tools are exposed
- Full access to service-specific tools
- Higher context usage

### Switching Modes

```yaml
# han.yml - disable orchestrator for direct MCP access
orchestrator:
  enabled: false
```

This is useful when you need direct access to specific MCP tools rather than the unified workflow interface.

## Best Practices

1. **Commit project settings** (`.claude/han.yml`) to ensure team consistency
2. **Use local settings** (`.claude/han.local.yml`) for personal preferences
3. **Keep it simple** - start with minimal configuration and add as needed
4. **Document overrides** - add comments explaining why you've changed defaults
5. **Test changes** - run hooks manually after configuration changes

## Configuration Validation

Han validates configuration on startup. If you have syntax errors or invalid options, you'll see:

```bash
han plugin install --auto
# Error: Invalid configuration in .claude/han.yml
# - biome.lint.enabled: must be boolean
```

## Next Steps

Now that you understand configuration:

- Learn about [smart caching](/docs/configuration/caching) to optimize performance
- Explore [CLI commands](/docs/cli/hooks) to run hooks manually
- Review [plugin categories](/docs/plugin-categories) for available options
