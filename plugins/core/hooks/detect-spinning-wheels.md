# Detect Spinning Wheels - Stop Hook

**Prevent Claude from making things worse when stuck on the same issue.**

## Context

$ARGUMENTS

## Your Mission

Analyze the conversation to detect if Claude is:

1. Repeatedly attempting the same fix
2. Making things worse instead of better
3. Stuck in a loop without progress
4. Unable to resolve an issue after multiple attempts

## Red Flags (High Confidence)

**Spinning wheels detected if:**

- Same error appears 3+ times despite "fixes"
- Claude keeps trying the same approach with minor variations
- Each attempt introduces new problems
- Tests were passing, then failing, then passing different tests
- Claude says "let me try again" more than twice for same issue
- Build/tests failing for same reason after multiple fix attempts
- Claude is guessing at solutions without investigation

## Green Flags (Making Progress)

**Claude is NOT spinning if:**

- Different approaches being tried systematically
- Each attempt reveals new information
- Progress toward solution (fewer errors, better understanding)
- Claude is investigating root cause, not just symptoms
- Using debugging tools effectively (Read/Grep/Bash to understand)

## Decision Criteria

### Use `continue: false` (Hard Stop) if

**Confidence ≥ 90% that Claude is stuck and making things worse:**

- Same failure 3+ times
- Introduced new bugs while fixing original issue
- No meaningful progress in last 3+ attempts
- User intervention clearly needed

**Response:**

```json
{
  "decision": "block",
  "reason": "Stuck in loop: [describe the pattern]",
  "continue": false,
  "stopReason": "I'm stuck on this issue and need your input to proceed",
  "systemMessage": "🔄 Loop detected: Multiple failed attempts at same fix. User intervention recommended."
}
```

### Use `decision: "block"` (Allow Retry) if

**Confidence 70-89% Claude might be stuck:**

- Some repetition but not clearly looping
- Making minor progress
- Might benefit from different approach

**Response:**

```json
{
  "decision": "block",
  "reason": "Repeated attempts without clear progress. Consider different approach.",
  "systemMessage": "⚠️ Multiple fix attempts detected. Consider investigating root cause."
}
```

### Use `decision: "approve"` if

**Claude is making progress or trying systematically:**

- Different approaches each time
- Learning from failures
- Investigating before attempting fixes
- Clear progress toward solution

**Response:**

```json
{
  "decision": "approve",
  "reason": "Systematic problem-solving with progress",
  "systemMessage": "✓ Debugging approach verified"
}
```

## Key Principle

**Better to stop and ask the user than to keep making things worse.**

When in doubt, if confidence of spinning ≥ 85%, use `continue: false` to bring user back in the loop.
