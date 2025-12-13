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

A typical `han.yml` file has two main sections:

```yaml
# Global hook settings
hooks:
  enabled: true       # Master switch for all hooks
  checkpoints: true   # Session-scoped filtering

# Plugin-specific settings
plugins:
  jutsu-biome:
    hooks:
      lint:
        enabled: true
        command: npx biome check --write .

  jutsu-typescript:
    hooks:
      typecheck:
        enabled: true
        command: npx tsc --noEmit
```

## Hook Configuration

Each plugin can define multiple hooks. You can configure them individually:

```yaml
plugins:
  jutsu-biome:
    hooks:
      lint:
        enabled: true              # Enable/disable this hook
        command: npx biome check   # Override the default command
        cache: true                # Enable smart caching
        dirs_with:                 # Only run in dirs with these files
          - biome.json
        if_changed:                # Only run if these patterns changed
          - "**/*.ts"
          - "**/*.tsx"
```

### Hook Options

| Option | Type | Description |
|--------|------|-------------|
| `enabled` | boolean | Enable or disable the hook |
| `command` | string | Command to execute |
| `cache` | boolean | Use smart caching (default: true) |
| `dirs_with` | array | File patterns that must exist |
| `if_changed` | array | Only run if matching files changed |
| `idle_timeout` | number | Milliseconds to wait for file stability |

## Plugin Configuration Keys

Han supports both YAML (snake_case) and legacy JSON (camelCase) formats:

| YAML (Preferred) | JSON (Legacy) | Description |
|------------------|---------------|-------------|
| `dirs_with` | `dirsWith` | Directory detection patterns |
| `dir_test` | `dirTest` | Directory test command |
| `if_changed` | `ifChanged` | File change patterns |
| `idle_timeout` | `idleTimeout` | File stability timeout |

**Note:** When both `han.yml` and `han-config.json` exist, YAML takes precedence.

## Example Configurations

### Minimal Configuration

```yaml
hooks:
  enabled: true

plugins:
  jutsu-biome:
    hooks:
      lint:
        enabled: true
```

### Full Configuration

```yaml
hooks:
  enabled: true
  checkpoints: true

plugins:
  jutsu-biome:
    hooks:
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

  jutsu-typescript:
    hooks:
      typecheck:
        enabled: true
        command: npx tsc --noEmit
        cache: true
        dirs_with:
          - tsconfig.json
        if_changed:
          - "**/*.ts"
          - "**/*.tsx"

  jutsu-markdown:
    hooks:
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
plugins:
  jutsu-biome:
    hooks:
      lint:
        command: npx biome check --write --config ../../biome.frontend.json .
```

## Disabling Hooks

To temporarily disable a hook without removing the plugin:

```yaml
plugins:
  jutsu-biome:
    hooks:
      lint:
        enabled: false
```

Or disable all hooks globally:

```yaml
hooks:
  enabled: false
```

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
# - plugins.jutsu-biome.hooks.lint.enabled: must be boolean
```

## Next Steps

Now that you understand configuration:

- Learn about [smart caching](/docs/configuration/caching) to optimize performance
- Explore [CLI commands](/docs/cli/hooks) to run hooks manually
- Review [plugin-specific documentation](/docs/plugins) for available options
