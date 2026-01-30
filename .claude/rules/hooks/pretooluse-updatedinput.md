# PreToolUse updatedInput Quirk

When using `updatedInput` in PreToolUse hooks to modify tool parameters:

**DO NOT set `permissionDecision`** when using `updatedInput`. Setting `permissionDecision: "allow"` breaks the `updatedInput` functionality for the Task tool.

## Correct Pattern

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "updatedInput": {
      "prompt": "modified prompt here"
    }
  }
}
```

## Incorrect Pattern (updatedInput ignored)

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "...",
    "updatedInput": { ... }
  }
}
```

## Discovery

Found on 2026-01-30 while implementing subagent context injection. The hook would output valid JSON with `updatedInput`, but Claude Code would ignore it when `permissionDecision` was set.
