---
name: ai-dlc-backpressure
description: Use when implementing or understanding backpressure in AI-DLC workflows. Covers quality gates, Stop hooks, and how automated enforcement guides AI behavior toward quality.
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
---

# AI-DLC Backpressure

Backpressure is automated enforcement that blocks progress until quality standards are met. Instead of prescribing process steps, backpressure creates natural incentives for quality.

## The Problem with Prescription

Traditional development processes prescribe steps:

```markdown
1. Write tests first
2. Run linter before commit
3. Get code review approval
4. Deploy to staging before production
```

These become checkbox exercises:
- Teams learn to game the process
- Quality checks become formalities
- "Did you run the linter?" → "Yes" (actually: no)

## The Backpressure Alternative

Backpressure makes quality gates **blocking**:

```bash
# You cannot proceed until tests pass
bun test || exit 1

# You cannot proceed until lint is clean
biome check || exit 1

# You cannot proceed until types check
tsc --noEmit || exit 1
```

The AI learns to satisfy these constraints naturally because it **cannot complete work** until they pass.

## How Backpressure Works

### The Feedback Loop

```
AI writes code
      ↓
Stop hook runs backpressure checks
      ↓
┌─────────────────────────────────┐
│ Tests pass?                      │
│ Lint clean?                      │
│ Types check?                     │
└─────────────────────────────────┘
      ↓                    ↓
   PASS                  FAIL
      ↓                    ↓
 Proceed            Fix and retry
```

### Behavioral Learning

Over iterations, the AI learns:
- "If I don't write tests, I'll be blocked"
- "If I introduce type errors, I'll have to fix them"
- "Lint errors mean more work for me"

This creates intrinsic motivation for quality, not extrinsic compliance.

## Types of Backpressure

### 1. Test Backpressure

```yaml
# han-plugin.yml
hooks:
  test:
    command: bun test
    event: Stop
```

**Effect:** AI cannot complete work if tests fail.

**AI learns to:**
- Write tests for new code
- Fix broken tests immediately
- Consider test implications of changes

### 2. Type Backpressure

```yaml
hooks:
  typecheck:
    command: tsc --noEmit
    event: Stop
```

**Effect:** AI cannot complete work with type errors.

**AI learns to:**
- Write type-safe code
- Fix type errors before moving on
- Use proper TypeScript patterns

### 3. Lint Backpressure

```yaml
hooks:
  lint:
    command: biome check
    event: Stop
```

**Effect:** AI cannot complete work with lint violations.

**AI learns to:**
- Follow code style automatically
- Use consistent patterns
- Avoid common anti-patterns

### 4. Build Backpressure

```yaml
hooks:
  build:
    command: bun run build
    event: Stop
```

**Effect:** AI cannot complete work if build fails.

**AI learns to:**
- Write code that compiles
- Handle build dependencies
- Fix import/export issues

### 5. Security Backpressure

```yaml
hooks:
  security:
    command: npm audit --audit-level=high
    event: Stop
```

**Effect:** AI cannot introduce vulnerable dependencies.

**AI learns to:**
- Choose secure dependencies
- Update vulnerable packages
- Consider security implications

## Implementing Backpressure

### In Han Plugins

Create a `han-plugin.yml`:

```yaml
hooks:
  test:
    command: bun test
    event: Stop
    if_changed:
      - "**/*.ts"
      - "**/*.tsx"

  lint:
    command: biome check
    event: Stop
    if_changed:
      - "**/*.ts"
      - "**/*.tsx"
      - "**/*.json"
```

### In Project Configuration

Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bun test && biome check"
          }
        ]
      }
    ]
  }
}
```

### Smart Caching

Han caches hook results to avoid redundant runs:

```yaml
hooks:
  test:
    command: bun test
    if_changed:
      - "src/**/*.ts"
      - "test/**/*.ts"
```

Hook only runs if matching files changed since last successful run.

## Backpressure Strategies

### Graduated Strictness

Start lenient, increase strictness as codebase matures:

**Week 1:** Only test backpressure
```yaml
hooks:
  test:
    command: bun test
```

**Week 2:** Add type checking
```yaml
hooks:
  test:
    command: bun test
  typecheck:
    command: tsc --noEmit
```

**Week 3:** Add linting
```yaml
hooks:
  test:
    command: bun test
  typecheck:
    command: tsc --noEmit
  lint:
    command: biome check
```

### Scope-Based Strictness

Different rules for different areas:

```yaml
hooks:
  # Strict for API
  api-test:
    command: bun test src/api
    dirs_with:
      - src/api

  # Lenient for internal tools
  tools-lint:
    command: biome check --warn-only tools/
    dirs_with:
      - tools
```

### Escape Hatches

For genuine exceptions:

```yaml
hooks:
  lint:
    command: biome check
    # Skip if explicitly marked
    skip_if:
      - ".biome-skip"
```

Use sparingly—escape hatches undermine backpressure.

## AI Adaptation Patterns

### Pattern 1: Preemptive Quality

AI learns to write quality code upfront:

```typescript
// AI now writes this automatically because
// it knows backpressure will catch issues

function parseUser(data: unknown): User {
  // Type guard (avoids type errors)
  if (!isValidUserData(data)) {
    throw new Error("Invalid user data");
  }

  // Proper typing (avoids lint warnings)
  const user: User = {
    id: data.id,
    name: data.name,
  };

  return user;
}

// Test included (avoids test failures)
test("parseUser handles invalid data", () => {
  expect(() => parseUser({})).toThrow();
});
```

### Pattern 2: Incremental Fixes

AI fixes issues as they arise:

```
Iteration 1: Write feature
→ Tests fail
Iteration 2: Fix tests
→ Lint errors
Iteration 3: Fix lint
→ All pass, proceed
```

### Pattern 3: Context Learning

AI remembers project patterns:

```
"This project uses zod for validation"
"This project requires tests for all API endpoints"
"This project uses snake_case for database columns"
```

## Measuring Backpressure Effectiveness

### Hook Pass Rates

```bash
# Check hook statistics
han hook stats
```

Good indicators:
- First-attempt pass rate increasing over time
- Fewer iterations to achieve pass
- AI preemptively addressing common issues

### Quality Metrics

Track over time:
- Test coverage
- Lint error density
- Type coverage
- Build success rate

## Backpressure Anti-Patterns

### Too Strict Too Soon

❌ Adding all checks on day one
✅ Gradually increasing strictness

### Ignoring Failures

❌ Using `|| true` to ignore failures
✅ Fixing root causes

### Slow Checks

❌ 5-minute test suite blocking every iteration
✅ Fast, focused checks; slow checks in CI

### Unclear Failures

❌ Cryptic error messages
✅ Actionable feedback with fix suggestions

## Integration with AI-DLC

### During Building (OHOTL)

Backpressure guides autonomous work:
1. AI writes code
2. Stop hook runs checks
3. Failures → AI fixes in next iteration
4. Passes → Work complete

### During Review (HITL)

Backpressure pre-filters issues:
1. AI ensures backpressure passes
2. Human reviews only quality-verified code
3. Reduces human burden
4. Focuses review on design/logic, not style

### Iteration Efficiency

Good backpressure reduces iterations:
- Without: 5 iterations (human catching issues)
- With: 2 iterations (AI self-correcting)

## Summary

Backpressure is:
- **Blocking** - Cannot proceed until satisfied
- **Automated** - No human enforcement needed
- **Educational** - AI learns from failures
- **Efficient** - Catches issues early

Implementation:
- Use Han hooks for Stop events
- Start simple, add strictness gradually
- Cache results for performance
- Provide clear error messages

Result: AI naturally produces higher-quality code because the system won't accept less.
