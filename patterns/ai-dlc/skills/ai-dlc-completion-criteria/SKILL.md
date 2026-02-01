---
name: ai-dlc-completion-criteria
description: Use when defining completion criteria for AI-DLC tasks. Covers writing verifiable, specific, and measurable criteria that enable autonomous operation and clear exit conditions.
allowed-tools:
  - Read
  - Grep
  - Glob
---

# AI-DLC Completion Criteria

Completion criteria are the foundation of effective AI-DLC workflows. Clear criteria enable autonomy, provide exit conditions, and ensure alignment between human intent and AI execution.

## Why Criteria Matter

### The Autonomy Equation

```
Autonomy = f(Criteria Clarity)
```

- **Vague criteria** → Constant human oversight required
- **Clear criteria** → AI can self-verify and operate autonomously

### The Exit Condition Problem

Without clear criteria:
- When is the task "done"?
- How do we know if it's working?
- What constitutes success vs failure?

With clear criteria:
- Each criterion is a checkpoint
- All criteria satisfied = task complete
- Any criterion failed = more work needed

## Characteristics of Good Criteria

### 1. Specific

Bad: "Make the login work"
Good: "Users can log in with email and password"

Bad: "Improve performance"
Good: "API response time under 200ms for 95th percentile"

Bad: "Fix the bug"
Good: "Clicking 'Submit' no longer throws a TypeError"

### 2. Measurable

Can you write a test for it? If not, it's not measurable.

Bad: "The code should be clean"
Good: "No ESLint errors or warnings"

Bad: "The UI should be intuitive"
Good: "User can complete checkout in under 3 clicks"

Bad: "Should handle errors gracefully"
Good: "Invalid email shows 'Please enter a valid email' message"

### 3. Atomic

One criterion, one thing to check.

Bad: "Users can log in and their session persists"
Good:
- "Users can log in with valid credentials"
- "Session persists across page refreshes"

Bad: "API handles all edge cases"
Good:
- "Returns 400 for missing required fields"
- "Returns 404 for non-existent resources"
- "Returns 429 when rate limit exceeded"

### 4. Automated (Ideally)

Criteria that can be checked automatically are strongest.

```markdown
## Completion Criteria

- [ ] All unit tests pass (`bun test`)
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] No lint warnings (`biome check`)
- [ ] API responds in < 200ms (load test)
```

### 5. Include Negative Cases

Don't just specify what should work—specify what should fail.

```markdown
## Completion Criteria

### Success Cases
- [ ] Valid credentials → user logged in
- [ ] Remember me checked → session persists 30 days

### Failure Cases
- [ ] Invalid password → "Incorrect password" error
- [ ] Non-existent email → "Account not found" error
- [ ] Empty fields → validation errors shown
```

## Writing Process

### Step 1: Start with Intent

What is the user trying to accomplish?

```
User: "Add Google OAuth to the app"
```

### Step 2: Ask Clarifying Questions

- What should happen on success?
- What should happen on failure?
- Any edge cases to consider?
- What existing behavior must be preserved?

### Step 3: Draft Criteria

```markdown
## Completion Criteria

### Core Functionality
- [ ] "Sign in with Google" button visible on login page
- [ ] Clicking button redirects to Google consent screen
- [ ] After consent, user redirected back to app
- [ ] User session created with Google profile data

### Error Handling
- [ ] User denies consent → returns to login with message
- [ ] Google API error → shows generic error message
- [ ] Existing account with same email → links accounts

### Quality Gates
- [ ] All existing tests continue to pass
- [ ] New tests cover OAuth flow
- [ ] No TypeScript errors
```

### Step 4: Validate with User

"Here are the criteria I've drafted. Anything missing or incorrect?"

### Step 5: Save

```javascript
han_keep_save({
  scope: "branch",
  key: "completion-criteria.md",
  content: criteriaMarkdown
});
```

## Criteria Categories

### Functional Criteria

What the system should DO:

```markdown
- [ ] Users can create new accounts
- [ ] Users can reset their password
- [ ] Admin can view all users
```

### Non-Functional Criteria

How the system should PERFORM:

```markdown
- [ ] Page loads in under 2 seconds
- [ ] Supports 1000 concurrent users
- [ ] Works on mobile devices
```

### Quality Criteria

What standards the code should MEET:

```markdown
- [ ] All tests pass
- [ ] No lint errors
- [ ] Test coverage > 80%
- [ ] No security vulnerabilities
```

### Preservation Criteria

What existing behavior should NOT CHANGE:

```markdown
- [ ] Existing login flow unchanged
- [ ] API backward compatible
- [ ] No breaking changes to database schema
```

## Criteria Templates

### New Feature

```markdown
## Completion Criteria: [Feature Name]

### User Can...
- [ ] [Primary action]
- [ ] [Secondary action]

### System Should...
- [ ] [Behavior 1]
- [ ] [Behavior 2]

### Error Handling
- [ ] [Error case 1] → [expected behavior]
- [ ] [Error case 2] → [expected behavior]

### Quality Gates
- [ ] All tests pass
- [ ] No type errors
- [ ] No lint warnings
```

### Bug Fix

```markdown
## Completion Criteria: Fix [Bug Description]

### Before (Broken)
- [Describe broken behavior]

### After (Fixed)
- [ ] [Correct behavior]
- [ ] [Regression test added]

### Verified
- [ ] Bug no longer reproducible
- [ ] Related functionality still works
- [ ] No new issues introduced
```

### Refactoring

```markdown
## Completion Criteria: Refactor [Component]

### Behavior Preserved
- [ ] [Existing behavior 1] still works
- [ ] [Existing behavior 2] still works

### Improvements
- [ ] [Quality improvement 1]
- [ ] [Quality improvement 2]

### Quality Gates
- [ ] All tests pass (unchanged)
- [ ] No type errors
- [ ] No lint warnings
```

## Anti-Patterns

### Vague Criteria

❌ "It should work"
❌ "Handle all edge cases"
❌ "Be performant"
❌ "Follow best practices"

### Unmeasurable Criteria

❌ "Code should be maintainable"
❌ "UI should be user-friendly"
❌ "System should be secure"

### Combined Criteria

❌ "Users can sign up, log in, and reset password"
(Should be three separate criteria)

### Missing Failure Cases

❌ Only specifying happy path
(Always include error scenarios)

## Verification Methods

### Automated Tests

```javascript
// Criterion: "Users can log in with valid credentials"
test("login with valid credentials", async () => {
  const result = await login("user@example.com", "password123");
  expect(result.success).toBe(true);
  expect(result.user).toBeDefined();
});
```

### Manual Verification

```markdown
- [ ] Manually tested on Chrome, Firefox, Safari
- [ ] Manually tested on mobile devices
- [ ] Verified with real user accounts
```

### Backpressure Hooks

```yaml
# Stop hook enforces criteria
hooks:
  test:
    command: bun test
  typecheck:
    command: tsc --noEmit
  lint:
    command: biome check
```

## Integration with AI-DLC

### During Elaboration

Work with user to define criteria:
1. Understand intent
2. Ask clarifying questions
3. Draft criteria
4. Validate with user
5. Save to `completion-criteria.md`

### During Building

Reference criteria to guide implementation:
- Each criterion is a mini-goal
- Check off as you complete
- Update scratchpad with progress

### During Review

Verify each criterion is satisfied:
1. Load criteria
2. Check each one
3. If all satisfied → `/done`
4. If any missing → `/fail` with specific feedback

## Summary

Good completion criteria are:
- **Specific** - No ambiguity
- **Measurable** - Can be tested
- **Atomic** - One thing per criterion
- **Automated** - Checked by code when possible
- **Complete** - Include failure cases

They enable:
- Autonomous AI operation
- Clear exit conditions
- Aligned expectations
- Verifiable progress
