# Task Tracking (Automatic via Native Tools)

## Current State

Task tracking is now **automatic**. Han indexes Claude Code's native TaskCreate/TaskUpdate tool calls from the JSONL transcript.

## No Manual MCP Calls Required

The legacy MCP tools (`mcp__plugin_core_han__start_task`, `mcp__plugin_core_han__complete_task`) are no longer needed. Simply use Claude Code's built-in task system:

```typescript
// Create a task
TaskCreate({
  subject: "Fix authentication bug",
  description: "Users can't log in with special characters in password",
  activeForm: "Fixing authentication bug"
})

// Update task status
TaskUpdate({
  taskId: "1",
  status: "completed"
})
```

## Verification

Check that native task events are being indexed:

```bash
sqlite3 ~/.claude/han/han.db "SELECT COUNT(*) FROM native_tasks;"
```

## Viewing Tasks

Tasks appear in the Browse UI sidebar under the "Tasks" tab for each session.
