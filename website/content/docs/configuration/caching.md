---
title: "Smart Caching"
description: "Han's intelligent caching system skips redundant validations."
---

Han's smart caching system eliminates redundant hook executions, saving time and reducing unnecessary work. **Caching is enabled by default** (as of v2.0.0) to optimize your development workflow automatically.

## Breaking Change in v2.0.0

Han v2.0.0 introduced a **default-ON** philosophy for performance features:

| Feature | v1.x Default | v2.0.0+ Default | Migration |
|---------|--------------|-----------------|-----------|
| `cache` | OFF | **ON** | Use `--no-cache` or `HAN_NO_CACHE=1` |
| `checkpoints` | OFF | **ON** | Use `--no-checkpoints` or `hooks.checkpoints: false` |
| `fail_fast` | OFF | **ON** | Use `--no-fail-fast` or `hooks.fail_fast: false` |

**Why this change?** Most users want optimized, fast hook execution by default. The new defaults provide:

- Faster development cycles through smart caching
- Fresh validation at session boundaries via checkpoints
- Quicker feedback via fail-fast behavior

**Upgrading from v1.x:** If you relied on opt-in caching, your hooks will now cache by default. To restore v1.x behavior, set `hooks.cache: false` in your `han.yml`.

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

**Caching is session-scoped by default** through checkpoints (enabled by default as of v2.0.0):

```yaml
hooks:
  cache: true         # Enabled by default
  checkpoints: true   # Enabled by default - cache resets at session boundaries
```

This ensures:

- Fresh validation at the start of each work session
- No stale results from previous days
- Consistent behavior across team members
- Automatic cache invalidation at natural boundaries

## File-Based Cache Invalidation

Han tracks which files affect each hook using the `if_changed` patterns:

```yaml
biome:
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
typescript:
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
han hook run biome lint
# → Running lint... (5s)

# No changes - cache hit
han hook run biome lint
# → Cached ✓ (8ms)

# Edit a TypeScript file - only TypeScript hooks run
han hook run typescript typecheck
# → Running typecheck... (3s)

# Biome still cached (no relevant changes)
han hook run biome lint
# → Cached ✓ (7ms)
```

## Disabling Cache

**Caching is enabled by default.** To disable it, you have three options (in priority order):

### 1. Environment Variable (Highest Priority)

```bash
# Disable cache for all commands in this shell
export HAN_NO_CACHE=1
han hook run biome lint

# Or for a single command
HAN_NO_CACHE=1 han hook run biome lint
```

### 2. CLI Flag

```bash
# Disable cache for a single run
han hook run biome lint --no-cache
```

### 3. Configuration File (Lowest Priority)

```yaml
# Disable globally for all hooks
hooks:
  cache: false

# Or per-plugin
biome:
  lint:
    cache: false  # Disable caching for this specific hook
```

**Priority chain:**

1. `HAN_NO_CACHE=1` environment variable (overrides everything)
2. `--no-cache` CLI flag
3. `hooks.cache: false` in han.yml
4. Built-in default (true)

**When to disable caching:**

- Debugging hook issues
- Verifying fixes after cache-related bugs
- Testing hook configuration changes
- Running in CI/CD (though Han auto-detects CI environments)
- Benchmarking actual hook performance

## Cache Storage

Cache data is stored in:

- `.claude/cache/hooks/` - Project-specific hook results
- Session checkpoints - Temporal boundaries for cache validity

Cache files are safe to delete - Han will rebuild them on the next run.

## Cache Debugging

To see cache behavior:

```bash
# Run with verbose output
han hook run biome lint --verbose

# Output shows:
# - Cache key computation
# - Cache hit/miss status
# - Files that triggered invalidation
```

Example output:

```
Computing cache key for biome:lint
  Files: 42 matches for **/*.{ts,tsx,js}
  Command: npx biome check --write .
  Cache key: a1b2c3d4...
Cache hit ✓ Skipping execution
```

## CI/CD Considerations

Han automatically detects CI environments. While caching is enabled by default, you may want to disable it in CI for consistent, reproducible builds:

```bash
# Disable cache in CI
HAN_NO_CACHE=1 han hook run --all

# Or use the CLI flag
han hook run --all --no-cache
```

Recommended CI setup:

```yaml
# .github/workflows/validate.yml
- name: Run validations
  env:
    HAN_NO_CACHE: 1
  run: han hook run --all
```

**Note:** Using the environment variable is preferred over the CLI flag in CI scripts because it:

- Applies to all hook commands automatically
- Can be set at the workflow or step level
- Makes scripts cleaner and more maintainable

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

2. **Keep checkpoints enabled** (default) for session-scoped freshness - disable only if you understand the implications:

   ```yaml
   hooks:
     checkpoints: true  # Default - recommended for most workflows
   ```

3. **Monitor cache hits** - if you're seeing frequent misses, patterns may be too broad

4. **Use `--no-cache` when debugging** - don't assume cache behavior during development

5. **Document cache requirements** - if a hook needs cache disabled, explain why in comments:

   ```yaml
   custom-validator:
     validate:
       cache: false  # Disabled because this hook checks external state
   ```

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
han hook run biome lint --verbose --no-cache
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
