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
  enabled: true       # Master switch for all hooks (default: true)
  cache: true         # Smart caching - skip if no changes (default: true)

# Auto-detection behavior
learn:
  mode: auto          # auto | ask | none (default: auto)

# Memory system
memory:
  enabled: true       # Enable memory and learning (default: true)

# Metrics tracking
metrics:
  enabled: true       # Enable task metrics (default: true)

# Per-plugin hook overrides
plugins:
  biome:
    hooks:
      lint:
        enabled: true
        command: npx biome check --write .

  typescript:
    hooks:
      typecheck:
        enabled: true
        command: npx tsc --noEmit
```

## Global Hook Settings

The `hooks` section controls behavior for all hooks across all plugins:

```yaml
hooks:
  enabled: true   # Master switch - disable all hooks
  cache: true     # Skip hooks when files haven't changed
```

### Global Hook Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Master switch to enable or disable all hooks |
| `cache` | boolean | `true` | Enable smart caching to skip unchanged files |
| `checkpoints` | boolean | `true` | Scope `${HAN_FILES}` to the files this session modified. Set `false` to check the whole tree |

These three are the only keys the hook runner reads. There is no
`hooks.fail_fast` and no `hooks.transcript_filter`; both appeared in earlier
documentation and neither exists in the code. See
[session-scoped validation](/docs/features/checkpoints).

### Configuration Priority

Settings are applied in this order (later overrides earlier):

1. **Built-in defaults** - hooks and caching enabled
2. **`han.yml` configuration** - merged across the file hierarchy above
3. **CLI options** - flags like `--no-cache`
4. **Environment variables** - `HAN_NO_CACHE=1`, `HAN_DISABLE_HOOKS=1`

Example:

```bash
# Disable caching for one run
han hook run biome lint --no-cache

# Same, via environment variable
HAN_NO_CACHE=1 han hook run biome lint
```

## Per-Hook Configuration

Override an installed plugin's hook under `plugins.<plugin>.hooks.<hook>`:

```yaml
plugins:
  biome:
    hooks:
      lint:
        enabled: true                     # Enable or disable this hook
        command: npx biome check --write . # Override the default command
        if_changed:                       # Add change patterns
          - "**/*.ts"
          - "**/*.tsx"
        idle_timeout: 5                   # Seconds to wait for file stability
        before_all: ./scripts/codegen.sh  # Run once before iterating directories
```

### Per-Hook Options

| Option | Type | Description |
|--------|------|-------------|
| `enabled` | boolean | Enable or disable this specific hook |
| `command` | string | Command to execute |
| `if_changed` | array | Extra change patterns, merged with the plugin's own |
| `idle_timeout` | number or `false` | Seconds to wait for file stability, or `false` to disable |
| `before_all` | string | Script run once before all directory iterations |

`han.yml` is parsed without schema validation, so an unrecognized key here is silently ignored rather than reported. `cache` and `dirs_with` are not valid per-hook overrides; see below.

## Plugin Authoring Keys

These keys belong in a plugin's own `han-plugin.yml`, not in your `han.yml` overrides:

| Key | Description |
|-----|-------------|
| `event` | Hook event or events this hook responds to |
| `tool_filter` | Restrict a tool event to specific tools |
| `dirs_with` | Directory detection patterns |
| `dir_test` | Directory test command |
| `command` | Command to execute |
| `if_changed` | File change patterns |
| `timeout` | Maximum execution time in seconds |
| `idle_timeout` | File stability timeout |
| `depends_on` | Hooks that must run first |
| `description`, `tip` | Human-facing text |
| `mcp` | Expose the hook as an MCP tool |

## Example Configurations

### Minimal Configuration

```yaml
hooks:
  enabled: true

plugins:
  biome:
    hooks:
      lint:
        enabled: true
```

### Full Configuration

```yaml
hooks:
  enabled: true
  cache: true

learn:
  mode: ask

plugins:
  biome:
    hooks:
      lint:
        enabled: true
        command: npx biome check --write ${HAN_FILES}
        if_changed:
          - "**/*.ts"
          - "**/*.tsx"
          - "**/*.js"

  typescript:
    hooks:
      typecheck:
        enabled: true
        command: npx tsc --noEmit
        if_changed:
          - "**/*.ts"
          - "**/*.tsx"

  markdown:
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
  biome:
    hooks:
      lint:
        command: npx biome check --write --config ../../biome.frontend.json .
```

## Disabling Hooks

To temporarily disable a specific hook without removing the plugin:

```yaml
plugins:
  biome:
    hooks:
      lint:
        enabled: false
```

Or disable all hooks globally:

```yaml
hooks:
  enabled: false
```

Or disable caching so hooks always run:

```yaml
hooks:
  cache: false
```

For a one-off run:

```bash
han hook run biome lint --no-cache
```

## Auto-Detection

The `learn` section controls whether Han installs plugins automatically when it detects marker files:

```yaml
learn:
  mode: auto   # Install detected plugins automatically (default)
  # mode: ask  # Report what would be installed, install nothing
  # mode: none # Disable auto-detection entirely
```

## MCP Backend Pool

Plugins that expose an MCP server are proxied through a connection pool. Tune it with:

```yaml
orchestrator:
  backends:
    idle_timeout: 300   # Seconds before an idle backend is closed
    max_connections: 10
```

`orchestrator.backends` is the only `orchestrator` subsection Han reads.

## Best Practices

1. **Commit project settings** (`.claude/han.yml`) to ensure team consistency
2. **Use local settings** (`.claude/han.local.yml`) for personal preferences
3. **Keep it simple** - start with minimal configuration and add as needed
4. **Document overrides** - add comments explaining why you've changed defaults
5. **Test changes** - run `han hook run <plugin> <hook>` after configuration changes

## Configuration Validation

`han-plugin.yml` files are validated: unknown top-level keys and malformed hook definitions are reported as errors. Validate a plugin you are authoring with:

```bash
han plugin validate
```

`han.yml` is not schema-validated. A typo in a key name is ignored silently, so check your change actually took effect:

```bash
han hook explain
```

## Next Steps

Now that you understand configuration:

- Learn about [smart caching](/docs/configuration/caching) to optimize performance
- Explore [CLI commands](/docs/cli/hooks) to run hooks manually
- Review [plugin categories](/docs/plugin-categories) for available options
