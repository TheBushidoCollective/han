---
title: "Smart Caching"
description: "Han's intelligent caching system skips redundant validations."
---

Han's smart caching system eliminates redundant hook executions, saving time and reducing unnecessary work. Understanding how caching works helps you optimize your development workflow.

## How Caching Works

When a hook runs, Han:

1. **Computes a cache key** from:
   - File hashes for all files matching `if_changed` patterns
   - The hook command
   - The plugin version
   - Environment variables that affect the hook

2. **Checks the cache** - if the key matches a previous run and that run succeeded, Han skips execution

3. **Stores results** - successful runs are cached; failures are not cached (to ensure you fix the issue)

This means hooks only run when something meaningful has changed.

## Cache Granularity

Caching is session-scoped by default when checkpoints are enabled:

```yaml
hooks:
  checkpoints: true  # Cache is reset at session boundaries
```

This ensures:

- Fresh validation at the start of each work session
- No stale results from previous days
- Consistent behavior across team members

## File-Based Cache Invalidation

Han tracks which files affect each hook using the `if_changed` patterns:

```yaml
plugins:
  jutsu-biome:
    hooks:
      lint:
        if_changed:
          - "**/*.ts"
          - "**/*.tsx"
          - "**/*.js"
```

The cache is invalidated when:

- Any matching file is created, modified, or deleted
- The hook command changes
- The plugin is updated
- Cache is manually cleared

## Directory-Based Caching

Hooks can be scoped to directories containing specific files:

```yaml
plugins:
  jutsu-typescript:
    hooks:
      typecheck:
        dirs_with:
          - tsconfig.json
        if_changed:
          - "**/*.ts"
```

This creates separate cache entries for each matching directory, allowing parallel caching across monorepo packages.

## Cache Performance

Smart caching provides significant speedups:

- **Cold cache** (first run): Full validation (~5-30s depending on hook)
- **Warm cache** (no changes): Instant (<10ms)
- **Partial invalidation**: Only re-runs affected hooks

Example workflow:

```bash
# First run - all hooks execute
han hook run jutsu-biome lint
# → Running lint... (5s)

# No changes - cache hit
han hook run jutsu-biome lint
# → Cached ✓ (8ms)

# Edit a TypeScript file - only TypeScript hooks run
han hook run jutsu-typescript typecheck
# → Running typecheck... (3s)

# Biome still cached (no relevant changes)
han hook run jutsu-biome lint
# → Cached ✓ (7ms)
```

## Disabling Cache

Sometimes you need to force re-execution:

```bash
# Disable cache for a single run
han hook run jutsu-biome lint --cache=false

# Or via configuration
```

```yaml
plugins:
  jutsu-biome:
    hooks:
      lint:
        cache: false  # Disable caching for this hook
```

**When to disable caching:**

- Debugging hook issues
- Verifying fixes after cache-related bugs
- Testing hook configuration changes
- Running in CI/CD (though Han auto-detects CI environments)

## Cache Storage

Cache data is stored in:

- `.claude/cache/hooks/` - Project-specific hook results
- Session checkpoints - Temporal boundaries for cache validity

Cache files are safe to delete - Han will rebuild them on the next run.

## Cache Debugging

To see cache behavior:

```bash
# Run with verbose output
han hook run jutsu-biome lint --verbose

# Output shows:
# - Cache key computation
# - Cache hit/miss status
# - Files that triggered invalidation
```

Example output:

```
Computing cache key for jutsu-biome:lint
  Files: 42 matches for **/*.{ts,tsx,js}
  Command: npx biome check --write .
  Cache key: a1b2c3d4...
Cache hit ✓ Skipping execution
```

## CI/CD Considerations

Han automatically detects CI environments and adjusts caching:

- Cache is disabled by default in CI
- Set `CLAUDE_CACHE_ENABLED=true` to enable in CI
- Use `--cache=false` to override in scripts

Recommended CI setup:

```yaml
# .github/workflows/validate.yml
- name: Run validations
  run: han hook run --all --cache=false
```

## Cache Invalidation Patterns

Common scenarios that invalidate cache:

| Scenario | Cache Invalidated? | Why |
|----------|-------------------|-----|
| Edit matching file | Yes | File hash changed |
| Edit non-matching file | No | Outside `if_changed` patterns |
| Change hook command | Yes | Cache key includes command |
| Update plugin | Yes | Version in cache key changed |
| New session (checkpoints on) | Yes | Session boundary reached |
| Delete cached file | No | Cache persists until invalidation |

## Best Practices

1. **Use specific patterns** in `if_changed` to minimize unnecessary invalidation:

   ```yaml
   # Good - specific
   if_changed:
     - "src/**/*.ts"
     - "test/**/*.test.ts"

   # Less optimal - too broad
   if_changed:
     - "**/*"
   ```

2. **Enable checkpoints** for session-scoped freshness:

   ```yaml
   hooks:
     checkpoints: true
   ```

3. **Monitor cache hits** - if you're seeing frequent misses, patterns may be too broad

4. **Clear cache when debugging** - don't blame the tool if cache is stale during development

5. **Document cache requirements** - if a hook needs cache disabled, explain why in comments

## Troubleshooting

### Cache not invalidating when expected

Check your `if_changed` patterns:

```bash
# List files matching your pattern
find . -name "*.ts" -type f

# Compare with your if_changed config
```

### Unexpected cache invalidation

Run with `--verbose` to see what's causing invalidation:

```bash
han hook run jutsu-biome lint --verbose --cache=false
```

### Cache taking too much space

Clear old cache entries:

```bash
# Han automatically garbage collects old entries
# Or manually:
rm -rf .claude/cache/hooks
```

## Next Steps

Now that you understand caching:

- Learn about [hook commands](/docs/cli/hooks) for manual execution
- Explore [plugin configuration](/docs/configuration) for advanced options
- Review [metrics](/docs/metrics) to track hook performance
