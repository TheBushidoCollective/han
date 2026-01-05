# Async Workflow Pattern

## Overview

The async workflow pattern enables long-running MCP tool operations to return immediately while executing in the background. A dedicated monitor agent polls for progress and reports updates to the main conversation.

This pattern works around Claude Code's limitation of not displaying MCP progress notifications by using the Task tool to spawn a narrating agent.

## Problem Statement

MCP tools that take a long time to execute block the conversation until complete. Claude Code does not display `notifications/progress` from MCP servers (tracked in [GitHub issue #4157](https://github.com/anthropics/claude-code/issues/4157)).

## Solution Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Main Agent    │     │  Monitor Agent  │     │   Han Workflow  │
│  (Claude Code)  │     │  (core plugin)  │     │   (Background)  │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ han_workflow(async=true)                      │
         │──────────────────────────────────────────────>│
         │                       │                       │ Start background
         │<──────────────────────────────────────────────│
         │ { workflow_id: "wf-1" }                       │
         │                       │                       │
         │ Task(workflow-monitor)│                       │
         │──────────────────────>│                       │
         │                       │ han_workflow_status   │
         │                       │──────────────────────>│
         │                       │<──────────────────────│
         │                       │ { progress: 2/5 }     │
         │                       │                       │
         │                       │ [narrates progress]   │
         │                       │                       │
         │                       │ han_workflow_status   │
         │                       │──────────────────────>│
         │                       │<──────────────────────│
         │                       │ { status: "complete" }│
         │<──────────────────────│                       │
         │ Final results         │                       │
```

## Components

### 1. Workflow Registry (`workflow-registry.ts`)

In-memory storage for tracking running workflows.

```typescript
interface TrackedWorkflow {
  id: string;
  intent: string;
  status: "pending" | "running" | "complete" | "failed" | "cancelled";
  progress: { current: number; total: number; message: string };
  partialResults: string[];
  finalResult?: WorkflowResult;
  startedAt: number;
  completedAt?: number;
}
```

Key functions:

- `startAsyncWorkflow(intent, options)` - Start workflow in background, return ID
- `getWorkflowStatus(workflowId)` - Get current progress and partial results
- `cancelWorkflow(workflowId)` - Cancel a running workflow
- `listWorkflows()` - List all active workflows

### 2. MCP Tools

| Tool | Purpose |
|------|---------|
| `han_workflow` | Start workflow (now supports `async: true`) |
| `han_workflow_status` | Check progress of async workflow |
| `han_workflow_cancel` | Cancel a running workflow |
| `han_workflow_list` | List all active workflows |

### 3. Monitor Agent (`core/agents/workflow-monitor/AGENT.md`)

A lightweight haiku-model agent that:

1. Receives a `workflow_id` to monitor
2. Polls `han_workflow_status` every 2-3 seconds
3. Narrates progress in human-readable format
4. Returns final result when `check_again: false`

## Usage

### Starting an Async Workflow

```typescript
// From main Claude Code session
han_workflow({
  intent: "Research Reddit posts about Claude AI",
  async: true,
  sessionId: "<session-id-from-hook>",
  fork: true
})
```

Response:

```
**Workflow Started (Async)**

**Workflow ID:** `wf-1735530000-abc123`

The workflow is running in the background. To monitor progress:

1. **Recommended:** Spawn a `core:workflow-monitor` agent...
```

### Spawning Monitor Agent

```typescript
Task(
  subagent_type="core:workflow-monitor",
  prompt="Monitor workflow wf-1735530000-abc123"
)
```

### Manual Polling

```typescript
han_workflow_status({ workflow_id: "wf-1735530000-abc123" })
```

Response:

```json
{
  "workflow_id": "wf-1735530000-abc123",
  "status": "running",
  "progress": { "current": 3, "total": 5, "message": "Fetching posts..." },
  "partial_results": ["Got 25 posts", "Analyzing comments..."],
  "check_again": true,
  "elapsed_ms": 12500
}
```

## Status Response Format

```typescript
interface WorkflowStatusResponse {
  workflow_id: string;
  status: "pending" | "running" | "complete" | "failed" | "cancelled";
  progress: {
    current: number;
    total: number;
    message: string;
  };
  partial_results: string[];  // Last 10 updates
  check_again: boolean;       // false when workflow complete
  final_result?: WorkflowResult;
  error?: string;
  elapsed_ms: number;
}
```

The `check_again` field is the key signal:

- `true` - Workflow still running, poll again
- `false` - Workflow complete, read `final_result` or `error`

## Monitor Agent Output Format

Progress updates:

```
[Poll 1] Status: running | Progress: 0/5 | Message: Initializing...
[Poll 2] Status: running | Progress: 2/5 | Message: Fetching posts...
```

Completion:

```
[COMPLETE] Workflow finished successfully.

## Final Result
Found 25 posts about Claude AI features...

## Details
- Backends Used: reddit
- Tools Invoked: get_hot_posts, get_comments
- Elapsed: 12s
```

## Design Decisions

### Why In-Memory Storage?

Workflows are transient - they exist only for the duration of a Claude Code session. SQLite or file-based storage would add complexity without benefit.

Cleanup runs automatically every 60 seconds, removing completed workflows older than 5 minutes.

### Why Haiku for Monitor Agent?

The monitor agent is simple:

1. Poll a tool
2. Format output
3. Repeat or return

Haiku is fast and cheap, perfect for this repetitive task.

### Why Polling Instead of Push?

Claude Code doesn't display MCP progress notifications. Polling with a narrating agent is the only way to show live updates in the conversation.

## Limitations

1. **Not persistent** - Workflows don't survive process restart
2. **No cross-session** - Workflow ID only valid in current MCP server instance
3. **Polling overhead** - Monitor agent makes repeated tool calls
4. **Max polls** - Monitor agent limits to 50 polls to prevent infinite loops

## Future Improvements

1. **MCP Tasks API** - When Claude Code supports the new Tasks API (MCP 2025-11-25 spec), this pattern could be simplified
2. **Progress notifications** - If Claude Code adds support for `notifications/progress` display, the monitor agent becomes optional
3. **Persistent workflows** - Could add SQLite storage for workflows that survive restarts

## Related Files

- `packages/han/lib/commands/mcp/workflow-registry.ts` - Registry implementation
- `packages/han/lib/commands/mcp/orchestrator.ts` - Orchestrator with async support
- `packages/han/lib/commands/mcp/server.ts` - MCP tool definitions
- `core/agents/workflow-monitor/AGENT.md` - Monitor agent prompt
