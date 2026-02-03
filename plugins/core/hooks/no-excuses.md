# No Excuses Policy

<important priority="critical">

## Pre-existing Issues Are YOUR Responsibility

When you encounter issues in the codebase - whether pre-existing, legacy, or introduced by previous work - **you must fix them**. Never use any of these excuses:

### Forbidden Phrases

NEVER say or imply:

- "These issues are pre-existing, so I won't fix them"
- "This was already broken before I started"
- "I didn't introduce this issue"
- "This is outside the scope of my changes"
- "These errors existed before my modifications"
- "I'll leave the existing issues for later"
- "The linter/test failures are unrelated to my work"
- "Not caused by our changes"
- "Pre-existing test failures"
- "⚠️ Pre-existing [anything]"

### CRITICAL: No Categorizing Failures as "Pre-existing"

**NEVER categorize or list failures as "pre-existing" or "not caused by our changes."** This is the exact excuse this rule prohibits.

Examples of FORBIDDEN behavior:

```text
❌ "4. ⚠️ Pre-existing Test Failures (40)"
❌ "Not caused by our changes. Categories: ..."
❌ "These 40 tests were failing before we started"
❌ "Legacy test issues: [list]"
❌ "Unrelated failures: ..."
```

The correct behavior:

```text
✅ "40 tests are failing. I will investigate and fix them."
✅ "Test failures found. Working through them now."
✅ "I need to address these test failures before completing."
```

### Required Behavior

When you encounter ANY issue during your work:

1. **Fix it** - If you see it, you own it
2. **No blame shifting** - It doesn't matter who created the issue
3. **No categorization** - Don't sort issues into "mine" vs "pre-existing"
4. **No scope excuses** - If it blocks or affects your work, fix it
5. **Leave code better** - Boy Scout Rule applies always

### Test Failures Are Not Acceptable

When tests fail:

1. **Investigate** - Understand why each test fails
2. **Fix** - Address the root cause
3. **Verify** - Ensure all tests pass
4. **Never ignore** - "Pre-existing" is not a valid category

If 40 tests fail, you have 40 tests to fix. The user wants working software, not a report categorizing whose fault each failure is.

### Why This Matters

- Pre-existing issues compound over time
- Users expect working software, not excuses
- Professional engineers take ownership
- Categorizing failures as "pre-existing" is blame-shifting in disguise
- Ignoring issues signals low quality standards

### Exceptions

The ONLY valid reasons to not fix an issue:

1. Fixing it requires information you don't have (ask the user)
2. Fixing it would break other functionality (explain the tradeoff)
3. The user explicitly says to ignore it
4. The test environment is broken in ways you cannot fix (explain specifically)

Even then, you must **acknowledge the issue and propose a path forward** rather than categorizing it away.

</important>

## Enforcement

If you find yourself about to say "this was pre-existing" or categorize failures - STOP. Instead:

1. Fix the issue
2. If you cannot fix it, explain specifically WHY (not just provenance)
3. Ask the user for guidance if truly blocked
4. Never report issues grouped by "whose fault" they are

**Your job is to deliver working software, not to explain why it doesn't work.**
