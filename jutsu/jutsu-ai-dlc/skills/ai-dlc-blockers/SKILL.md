---
name: ai-dlc-blockers
description: Use when documenting blockers in AI-DLC workflows. Covers proper blocker documentation, categorization, and how blockers enable productive iteration when stuck.
allowed-tools:
  - Read
  - Grep
  - Glob
---

# AI-DLC Blockers

Blockers are obstacles that prevent progress on a task. In AI-DLC, properly documenting blockers is essential for productive iteration—it ensures the next session can address issues directly rather than rediscovering them.

## Why Document Blockers

### The Context Reset Problem

When you run `/clear`:
- Context window is wiped
- Previous attempts are forgotten
- Discoveries are lost

Without blocker documentation:
- Next iteration repeats the same failed attempts
- Same dead ends are explored again
- No learning occurs across iterations

With blocker documentation:
- Next iteration knows what didn't work
- Alternative approaches can be tried
- Progress accumulates across sessions

### The Knowledge Transfer

Blockers are a form of knowledge transfer:
- From current session → next session
- From current hat → next hat (if `/fail` called)
- From AI → human (if intervention needed)

## Blocker Anatomy

### Good Blocker Documentation

```markdown
## Blocker: OAuth Callback Not Working

### What I Tried
1. Set callback URL to `http://localhost:3000/auth/callback`
2. Verified Google Cloud Console configuration
3. Checked for CORS issues - none found

### Where I Got Stuck
The callback is received, but the authorization code exchange fails with:
```
Error: invalid_grant - Code was already redeemed
```

### What I Think Is Happening
The code might be getting used twice - possibly a React strict mode double-render issue?

### Suggested Next Steps
1. Disable React strict mode temporarily to test
2. Add request deduplication on the callback endpoint
3. Check if there's a race condition in the OAuth flow
```

### Bad Blocker Documentation

```markdown
OAuth doesn't work. Tried everything.
```

## Blocker Categories

### 1. Technical Blockers

Issues with code, APIs, or infrastructure:

```markdown
## Blocker: Database Connection Timeout

### Symptoms
- Connection fails after 30 seconds
- Error: ETIMEDOUT

### Attempted Solutions
- Increased timeout to 60s - still fails
- Tried different connection string - same result
- Verified database is accessible via CLI - works

### Suspected Cause
Firewall rules might be blocking the app server
```

### 2. Knowledge Blockers

Missing information needed to proceed:

```markdown
## Blocker: Unknown API Behavior

### Question
What should happen when a user tries to access a deleted resource?

### Options Considered
1. Return 404 - simple but loses information
2. Return 410 Gone - more accurate but unusual
3. Return soft-deleted data with flag - requires schema change

### Need From User
Decision on which approach to use
```

### 3. Dependency Blockers

Waiting on external factors:

```markdown
## Blocker: Waiting for API Access

### Status
Requested API key from third-party service

### Timeline
They said 24-48 hours for approval

### Workaround Available
Can use mock data for now, but need real API for integration test
```

### 4. Design Blockers

Architectural or design decisions needed:

```markdown
## Blocker: State Management Approach

### Context
Need to share auth state across components

### Options
1. React Context - simple, but re-renders all consumers
2. Zustand - lightweight, selective updates
3. Lift to URL - stateless but limited

### Trade-offs
Each has different implications for testing and SSR.
Need user input on priorities.
```

## When to Document Blockers

### Document When

- You've tried multiple approaches without success
- You need information you don't have
- You're waiting on external dependencies
- A design decision needs human input
- The same issue might recur in future iterations

### Don't Document When

- It's a simple fix you just haven't done yet
- You're about to solve it
- It's not actually blocking (just inconvenient)

## Documentation Format

### Template

```markdown
## Blocker: [Brief Title]

### Context
[What were you trying to do?]

### What I Tried
1. [Attempt 1]
2. [Attempt 2]
3. [Attempt 3]

### What Happened
[Results of each attempt]

### Where I'm Stuck
[Specific point where progress stopped]

### Suspected Cause
[Your hypothesis about why it's failing]

### Suggested Next Steps
1. [Potential solution 1]
2. [Potential solution 2]
3. [Fallback option]

### Questions for User (if any)
- [Question 1]
- [Question 2]
```

### Saving Blockers

```javascript
han_keep_save({
  scope: "branch",
  key: "blockers.md",
  content: blockerMarkdown
});
```

## Blocker Resolution

### In Next Iteration

SessionStart hook injects blockers:
```
### Previous Blockers
OAuth callback failing with invalid_grant error.
Suspect React strict mode double-render.
```

AI addresses directly:
```
"I see there was a blocker with OAuth. Let me try disabling strict mode first..."
```

### After `/fail`

When reviewer sends back to builder:
```markdown
## Blocker: Review Feedback

### Issues Found
1. Missing input validation on email field
2. No test for error case
3. Console.log left in production code

### Required Fixes
- Add email validation with error message
- Add test for invalid email case
- Remove console.log statements
```

### User Intervention

Some blockers require human help:

```markdown
## Blocker: Needs User Decision

### Question
The API can support either REST or GraphQL. Which should we use?

### Context
- REST is simpler, more familiar to team
- GraphQL reduces over-fetching, better for mobile
- Current infrastructure has REST examples

### Waiting For
User decision on API style preference
```

## Blocker Anti-Patterns

### Vague Blockers

❌ "It doesn't work"
✅ "OAuth callback fails with invalid_grant after code exchange"

### No Attempts Listed

❌ "Can't figure out the auth"
✅ "Tried X, Y, Z - all failed because..."

### No Hypotheses

❌ "Something is wrong with the database"
✅ "Suspect connection pool exhaustion based on timeout pattern"

### Premature Blocking

❌ Documenting as blocked after one failed attempt
✅ Try at least 3 different approaches before documenting as blocked

### Stale Blockers

❌ Leaving resolved blockers in the file
✅ Clear or update blockers when resolved

## Blocker Workflow

### When You Hit a Wall

```
1. Try at least 3 different approaches
2. Document what you tried and results
3. Form a hypothesis about the cause
4. Suggest next steps
5. Save to blockers.md
6. Continue with other work if possible
7. Session ends, /clear, next iteration addresses blocker
```

### Clearing Blockers

When a blocker is resolved:

```javascript
// Option 1: Clear the file
han_keep_delete({ scope: "branch", key: "blockers.md" });

// Option 2: Update with resolution
han_keep_save({
  scope: "branch",
  key: "blockers.md",
  content: "## Resolved\n\nOAuth issue fixed by disabling strict mode."
});
```

## Integration with AI-DLC Hats

### Builder Hat

Most blockers originate here:
- Technical implementation issues
- Failing tests
- API integration problems

Document blockers, save progress, iterate.

### Reviewer Hat

Creates blockers when `/fail`:
- Quality issues found
- Missing functionality
- Failed criteria

Clear feedback enables builder to address efficiently.

### Planner Hat

May hit design blockers:
- Unclear requirements
- Multiple valid approaches
- Need user decision

Blocker prompts HITL intervention.

## Summary

Good blocker documentation:
- **Specific** - Exact error messages, line numbers
- **Contextual** - What you were trying to do
- **Attempts Listed** - What you already tried
- **Hypothesized** - Your theory about the cause
- **Actionable** - Suggested next steps

Blockers enable:
- Learning across iterations
- Efficient problem-solving
- Clear communication with humans
- Progress despite obstacles

Document blockers when stuck. The next iteration will thank you.
