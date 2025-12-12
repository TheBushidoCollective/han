---
globs: ["packages/han/**/*.ts"]
---

# Han CLI Development Rules

## Test Command

```bash
# Run tests with only failures (faster iteration)
bun test --only-failures

# Run all tests
bun test
```

## Running Hooks

```bash
# Run a specific hook
han hook run <plugin-name> <hook-name>

# With caching (skip if no changes)
han hook run jutsu-biome lint --cached

# Force re-run ignoring cache
han hook run jutsu-biome lint --cache=false
```

## Plugin Config Formats

Plugins support both formats (YAML preferred):
- `han-plugin.yml` - New YAML format with snake_case keys
- `han-config.json` - Legacy JSON format with camelCase keys

When both exist, YAML takes precedence.
