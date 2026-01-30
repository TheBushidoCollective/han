# Hook Ordering

## Two Ordering Mechanisms

### 1. Phase-Based Ordering (for validation hooks)

Validation hooks are ordered by **naming convention**:

```
format → lint → typecheck → test
```

The hook name determines its phase:
- `format` or `format_*` → format phase (runs first)
- `lint` or `lint_*` → lint phase
- `typecheck` or `typecheck_*` → typecheck phase
- `test` or `test_*` → test phase
- Other names → default to `lint` phase

All hooks in phase N complete before phase N+1 starts.

### 2. Wildcard Dependencies (post-validation hooks)

For hooks that must run AFTER all validation hooks complete, use wildcard dependencies:

```yaml
iterate:
  event: Stop
  command: bash hooks/enforce-iteration.sh
  depends_on:
    - plugin: "*"
      hook: "*"
```

This opts OUT of phase ordering entirely. The hook runs inline AFTER all validation passes.

## Hook Naming Convention

Hooks should be named by their task or phase:
- `lint` - linting checks
- `format` - code formatting
- `typecheck` - type checking
- `test` - running tests
- `build` - building artifacts
- `commit` - git commit checks
- `iterate` - iteration enforcement

## When to Use Each

**Use phase naming** when your hook IS a validation/backpressure hook:
```yaml
lint:  # Runs in lint phase with other linters
  command: my-lint-check
```

**Use wildcard dependency** when your hook should run AFTER all validation:
```yaml
commit:
  depends_on:
    - plugin: "*"
      hook: "*"
```

## Antipattern: Explicit Plugin Dependencies for Ordering

**DON'T** specify individual plugins just for ordering:
```yaml
# WRONG - couples plugins unnecessarily
depends_on:
  - plugin: jutsu-biome
    hook: lint
  - plugin: jutsu-typescript
    hook: typecheck
```

**DO** use wildcard for "run after everything":
```yaml
# CORRECT - runs after all validation
depends_on:
  - plugin: "*"
    hook: "*"
```

## Example: Post-Validation Hooks

Two hooks that run after all validation, with iterate depending on commit:

```yaml
# jutsu-git-storytelling/han-plugin.yml
commit:
  event: Stop
  command: bash scripts/check-commits.sh
  depends_on:
    - plugin: "*"
      hook: "*"

# jutsu-ai-dlc/han-plugin.yml
iterate:
  event: Stop
  command: bash hooks/enforce-iteration.sh
  depends_on:
    - plugin: "*"
      hook: "*"
    - plugin: jutsu-git-storytelling
      hook: commit
      optional: true
```
