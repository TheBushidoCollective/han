---
name: fix
description: Debug and fix bugs, errors, or unexpected behavior
disable-model-invocation: false
---

# fix

## Name

han-core:fix - Debug and fix bugs, errors, or unexpected behavior

## Synopsis

```
/fix [arguments]
```

## Description

Debug and fix bugs, errors, or unexpected behavior

## Implementation

Investigate, diagnose, and fix bugs or unexpected behavior in the codebase.

## Process

Follow this process to fix bugs:

1. **Reproduce the issue**: Confirm the bug exists and understand when it happens
2. **Gather information**: Error messages, logs, stack traces, user reports
3. **Form hypothesis**: What might be causing the issue?
4. **Investigate**: Use debugging tools, add logging, trace execution
5. **Identify root cause**: Find the actual source of the problem
6. **Implement fix**: Change code to resolve the issue
7. **Verify fix**: Confirm the bug is resolved and no new issues introduced
8. **Add regression test**: Prevent the bug from returning

## Bug Fixing Principles

**Understand before fixing:**

- Don't guess and patch - find the root cause
- Reproduce reliably before attempting fix
- Understand why the bug exists, not just symptoms

**Fix properly:**

- Fix the cause, not symptoms
- Consider edge cases and similar issues
- Add tests to prevent regression
- Document why the fix works

**Verify thoroughly:**

- Original issue resolved
- No new bugs introduced
- Related scenarios still work
- Tests pass (existing + new)

## Examples

When the user says:

- "This function throws an error when passed null"
- "The page crashes on mobile devices"
- "Users report checkout fails intermittently"
- "Fix the memory leak in the background worker"
- "Debug why tests are failing on CI"

## Debugging Techniques

**Add logging:**

```typescript
console.log('Value at checkpoint:', value)
logger.debug('Processing item', { id: item.id, status: item.status })
```

**Use debugger:**

```typescript
debugger;  // Browser will pause here
```

**Binary search:**

- Comment out half the code
- If bug disappears, it's in that half
- Repeat until isolated

**Compare working vs broken:**

- What changed between working and broken?
- Git bisect to find breaking commit
- Compare with known-good version

## Output Format

After fixing:

```markdown
## Bug Fix: [Brief description]

### Issue
[What was broken and how it manifested]

### Root Cause
[Why the bug existed]

### Fix
[What was changed and why it fixes the issue]

### Verification
[Evidence the fix works - use proof-of-work skill]
- Original issue no longer reproduces
- Tests pass (include test output)
- Related scenarios still work

### Prevention
[What test was added to prevent regression]
```

## Notes

- Use TaskCreate to track debugging steps
- Document findings even if you don't find the root cause immediately
- Use proof-of-work skill to show the bug is actually fixed
- Consider using boy-scout-rule skill to improve surrounding code
- Add test to prevent regression (use test-driven-development skill)
