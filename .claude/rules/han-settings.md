---
globs: ["**/han.yml", "**/han-plugin.yml", "packages/han/lib/han-settings.ts"]
---

# Han Configuration Precedence

Settings are merged in this order (later overrides earlier):

1. `~/.claude/han.yml` - User global defaults
2. `.claude/han.yml` - Project team settings (committed)
3. `.claude/han.local.yml` - Local overrides (gitignored)
4. `./han.yml` - Project root config
5. `<dir>/han.yml` - Directory-specific settings

## Example han.yml

```yaml
hooks:
  enabled: true       # Master switch
  checkpoints: true   # Session-scoped filtering

memory:
  enabled: true       # Enable memory system (session capture, research, promotion)

metrics:
  enabled: true       # Enable task metrics tracking

plugins:
  jutsu-biome:
    hooks:
      lint:
        enabled: true
        command: npx biome check --write .
```

## Plugin Config Keys

| YAML (snake_case) | JSON (camelCase) |
|-------------------|------------------|
| dirs_with         | dirsWith         |
| dir_test          | dirTest          |
| if_changed        | ifChanged        |
| idle_timeout      | idleTimeout      |
