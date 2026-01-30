# Hook Ordering

## Two Ordering Mechanisms

### 1. Phase-Based Ordering (for validation hooks)

Validation hooks are ordered by **naming convention**:

```
format → lint → typecheck → test → advisory
```

The hook name determines its phase:
- `format` or `format_*` → format phase (runs first)
- `lint` or `lint_*` → lint phase
- `typecheck` or `typecheck_*` → typecheck phase
- `test` or `test_*` → test phase
- `advisory` or `advisory_*` → advisory phase (runs last among validation)
- Other names → default to `lint` phase

All hooks in phase N complete before phase N+1 starts.

### 2. Wildcard Dependencies (run AFTER all validation)

For hooks that must run after ALL validation hooks complete, use wildcard dependencies:

```yaml
enforce-iteration:
  event: Stop
  command: bash hooks/enforce-iteration.sh
  depends_on:
    - plugin: "*"
      hook: "*"
```

This opts OUT of phase ordering entirely. The hook runs inline AFTER all validation passes.

## When to Use Each

**Use phase naming** when your hook IS a validation/backpressure hook:
```yaml
lint_mycheck:  # Runs in lint phase with other linters
  command: my-lint-check
```

**Use wildcard dependency** when your hook should run AFTER all validation:
```yaml
my-post-validation-hook:
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

## Example: AI-DLC enforce-iteration

Runs after all backpressure hooks to prompt for iteration:
```yaml
enforce-iteration:
  event: Stop
  command: bash hooks/enforce-iteration.sh
  depends_on:
    - plugin: "*"
      hook: "*"
```
