# CLI Exit Behavior

## Problem: CLI commands hang after completion

Bun/Node CLI commands using Commander.js may hang after the action handler completes due to:
- Open handles from async imports
- Event listeners that haven't been cleaned up
- Timer references
- Pending promises

## Solution: Explicit process.exit(0)

For CLI commands that should exit immediately after completion, add explicit `process.exit(0)` at the end of the action handler:

```typescript
.action(async (args, options) => {
  await doWork();
  process.exit(0); // Prevent hanging on open handles
});
```

## When to apply

- Hook dispatch commands
- Reference/utility commands  
- Any command that outputs and exits (not interactive)

## When NOT to apply

- Interactive commands (using ink, prompts)
- Long-running daemons/servers
- Commands that need cleanup hooks to run
