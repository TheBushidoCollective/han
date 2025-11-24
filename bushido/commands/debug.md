---
description: Investigate and diagnose issues without necessarily fixing them
disable-model-invocation: false
---

Investigate and diagnose bugs, errors, or unexpected behavior to understand what's happening and why.

## Process

Use the debugging skill from bushido to:

1. **Reproduce the issue**: Confirm the problem exists
2. **Gather evidence**: Logs, error messages, stack traces, user reports
3. **Add instrumentation**: Logging, breakpoints, profiling
4. **Form hypotheses**: What could be causing this?
5. **Test hypotheses**: Systematically rule out possibilities
6. **Identify root cause**: Find the actual source of the problem
7. **Document findings**: Even if not fixing now

## Debug vs Fix

**Use `/debug` when:**
- Investigating an issue to understand it
- Need to gather information before fixing
- Want to identify root cause without implementing solution
- Triaging to determine severity/priority
- Research phase before fix

**Use `/fix` when:**
- Ready to implement the solution
- Debugging AND fixing in one go
- Issue is understood, just needs fixing

## Debugging Strategies

### Hypothesis-Driven Debugging

```markdown
1. **Hypothesis:** The database query is slow
   **Test:** Add query timing logs
   **Result:** Query takes 2ms, not the issue

2. **Hypothesis:** Network latency is high
   **Test:** Add network timing logs
   **Result:** Network takes 3 seconds - FOUND IT
```

### Binary Search Debugging

```
1. Comment out second half of function
   - Bug still happens → It's in first half

2. Comment out second quarter
   - Bug disappears → It's in third quarter

3. Continue narrowing until isolated
```

### Git Bisect Debugging

```bash
# Find which commit introduced the bug
git bisect start
git bisect bad                    # Current version has bug
git bisect good v1.0.0           # This version was working
# Git checks out middle commit
npm test                         # Test if bug exists
git bisect good/bad              # Mark accordingly
# Repeat until bug-introducing commit found
```

### Add Instrumentation

```typescript
// Strategic logging
console.log('1. Starting process')
console.log('2. Input value:', input)
console.log('3. After transformation:', transformed)
console.log('4. Before API call')
const result = await api.call()
console.log('5. API result:', result)
console.log('6. Final output:', output)
```

### Rubber Duck Debugging

Explain the problem out loud (or write it down) step by step. Often this reveals the issue.

## Common Investigation Techniques

### Check the Logs

```bash
# Application logs
tail -f logs/app.log

# Filter for errors
grep ERROR logs/app.log

# Search for specific request
grep "request_id=abc123" logs/app.log
```

### Use Debugger

```typescript
// Browser
debugger;  // Execution pauses here

// Node.js
node --inspect app.js
// Then attach Chrome DevTools
```

### Trace Execution

```typescript
function processData(data) {
  console.trace('processData called')  // Shows call stack
  // ...
}
```

### Check Network

```bash
# Browser DevTools > Network tab
# Look for:
# - Failed requests (4xx, 5xx)
# - Slow requests (> 1s)
# - Large payloads
```

### Profile Performance

```bash
# Browser DevTools > Performance tab
# Record interaction, look for:
# - Long tasks (> 50ms)
# - Layout thrashing
# - Memory leaks
```

### Inspect State

```typescript
// React DevTools - inspect component state
// Redux DevTools - inspect store state
// Vue DevTools - inspect component data

// Or add logging
useEffect(() => {
  console.log('Current state:', state)
}, [state])
```

## Investigation Report Format

```markdown
## Investigation: [Issue description]

### Symptoms
[What's happening that's wrong?]

### Evidence
- Error message: [exact text]
- When it happens: [conditions]
- Frequency: [always/sometimes/rarely]
- Affected users: [all/some/specific group]

### Reproduction Steps
1. [Step 1]
2. [Step 2]
3. [Observe error]

### Investigation Timeline

**Hypothesis 1:** [What I thought might be wrong]
- Tested by: [What I did to test]
- Result: [What I found]
- Conclusion: [Ruled out / Confirmed]

**Hypothesis 2:** [Next theory]
- Tested by: [What I did]
- Result: [What I found]
- Conclusion: [Ruled out / Confirmed]

### Root Cause
[What's actually causing the issue]

**Evidence:**
- [Log showing the problem]
- [Stack trace pointing to source]
- [Data showing the pattern]

### Impact
- Severity: [Critical/High/Medium/Low]
- Scope: [How many users/scenarios affected]
- Workaround: [Any temporary solutions]

### Next Steps
- [ ] [What should be done to fix]
- [ ] [Any additional investigation needed]
- [ ] [Related issues to check]
```

## Debugging Checklist

- [ ] Can reproduce the issue reliably
- [ ] Have error messages and stack traces
- [ ] Know when it started (which deploy/change)
- [ ] Know conditions that trigger it
- [ ] Know conditions that DON'T trigger it
- [ ] Checked logs for related errors
- [ ] Tested hypotheses systematically
- [ ] Identified root cause (not just symptoms)
- [ ] Documented findings
- [ ] Estimated impact and severity

## Examples

When the user says:
- "Why is this page loading slowly?"
- "Investigate this intermittent test failure"
- "Figure out why users are seeing this error"
- "Debug the memory leak in production"
- "What's causing the database timeouts?"

## Debugging Tools by Stack

**Frontend:**
- Chrome DevTools (Console, Network, Performance, Memory)
- React DevTools
- Redux DevTools
- Lighthouse

**Backend:**
- Application logs
- APM tools (New Relic, Datadog)
- Database query analyzers
- Profilers

**Database:**
- EXPLAIN ANALYZE (PostgreSQL)
- Slow query log
- Query profilers

## Common Issues to Check

**"It doesn't work":**
- Check error messages
- Check browser console
- Check network tab
- Check server logs

**"It's slow":**
- Profile to find bottleneck
- Check database queries
- Check network waterfall
- Check bundle size

**"It works locally but not in production":**
- Check environment variables
- Check production logs
- Check data differences
- Check network/CORS issues

**"It works sometimes":**
- Race condition?
- Timing issue?
- Data-dependent?
- Check for async issues

## Notes

- Use TodoWrite to track investigation steps
- Use proof-of-work skill to document evidence
- Document findings even if not fixing immediately
- Create minimal reproduction case
- Consider using /fix once root cause is found
- Add logging/metrics to prevent future issues
