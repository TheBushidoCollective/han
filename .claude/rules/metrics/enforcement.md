# Metrics Tracking Enforcement

## Current Problem

The metrics dashboard shows "No metrics data available" because **task tracking tools are not being called**, even though:
- MCP server is configured and running
- Tools are available (`mcp__plugin_core_han__start_task`, etc.)
- Metrics are enabled by default
- Infrastructure is fully implemented

## Root Cause

The AI assistant is not proactively using the task tracking tools, despite the guidance in `.claude/rules/metrics-tracking.md`.

## Required Behavior

For **every non-trivial task** (implementation, fix, refactor, research), the AI MUST:

1. **Start task** before beginning work:
   ```typescript
   mcp__plugin_core_han__start_task({
     session_id: process.env.CLAUDE_SESSION_ID,
     description: "Brief task description",
     type: "implementation" | "fix" | "refactor" | "research"
   })
   ```

2. **Complete task** after finishing:
   ```typescript
   mcp__plugin_core_han__complete_task({
     session_id: process.env.CLAUDE_SESSION_ID,
     task_id: "...",
     outcome: "success" | "partial" | "failure",
     confidence: 0.0-1.0
   })
   ```

## When to Skip

Only skip for:
- Simple questions/explanations
- Single-line changes
- Trivial fixes (typos, formatting)
- Conversation-only interactions

## Verification

Check that task events are being written:
```bash
grep -l "task_started\|task_completed" ~/.claude/projects/*/*-han.jsonl
```

Check database has data:
```bash
sqlite3 ~/.claude/han/han.db "SELECT COUNT(*) FROM tasks;"
```
