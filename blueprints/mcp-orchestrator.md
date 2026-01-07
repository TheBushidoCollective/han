---
name: mcp-orchestrator
summary: Han as workflow orchestrator with encapsulated MCP backends (tools never returned to CC)
---

# MCP Orchestrator

Han acting as a workflow orchestrator that completely encapsulates backend MCP servers. Claude Code never sees the underlying tools - only workflow outcomes.

## Problem Statement

Loading all MCP tools at session start consumes significant context:

| Setup | Tools | Tokens |
|-------|-------|--------|
| Minimal (han only) | ~11 | ~2K |
| Typical (+ github, playwright) | ~90 | ~30K |
| Full (all hashi plugins) | ~150+ | ~50K+ |

This scales poorly as plugins are added.

## Solution: Workflow Encapsulation

Unlike tool discovery patterns (which eventually return tool definitions to Claude), Han completely encapsulates backend tools. Claude Code never sees them - only the workflow tool and its outcomes.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Claude Code                               │
│                                                                  │
│  ONLY sees Han's tools (~5 tools, ~500 tokens):                 │
│  ├── han_workflow   (dynamic description of capabilities)       │
│  ├── memory                                                      │
│  ├── learn                                                       │
│  ├── checkpoint_list                                             │
│  └── metrics tools                                               │
│                                                                  │
│  ❌ Does NOT see: github tools, playwright tools, etc.          │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Han MCP Server                            │
│                                                                  │
│  han_workflow("Create a PR for this feature")                   │
│      │                                                           │
│      ▼                                                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Agent SDK Runtime (internal)                  │  │
│  │                                                            │  │
│  │  Agent spawned with relevant backend tools:                │  │
│  │  ├── github tools (50)   ← CC never sees these             │  │
│  │  ├── playwright tools (25)                                 │  │
│  │  └── subset selected based on intent                       │  │
│  │                                                            │  │
│  │  Agent completes task autonomously                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│      │                                                           │
│      ▼                                                           │
│  Returns: "Created PR #123, added 3 tests, all passing"         │
└─────────────────────────────────────────────────────────────────┘
```

## Key Principle: Tools Never Bubble Up

| Approach | Tool Visibility | Use Case |
|----------|-----------------|----------|
| Platform tool search | Tools returned to Claude | Fine-grained control needed |
| **Han orchestrator** | Tools completely hidden | Outcome-focused tasks |

Han is a complete black box. CC asks for an outcome, Han delivers it.

## Architecture

### Han as the Only MCP Server

Claude Code connects ONLY to Han. All other MCP servers (github, playwright, etc.) are managed internally by Han and never exposed to CC.

```yaml
# Claude Code settings
mcpServers:
  han:
    command: "han"
    args: ["mcp", "server"]
  # No other MCP servers - Han manages them all
```

### Workflow Tool with Dynamic Description

The `han_workflow` tool description is generated at startup based on available backends:

```typescript
function generateWorkflowDescription(): string {
  const capabilities = discoverCapabilities();

  return `Execute complex workflows autonomously. Current capabilities:

${capabilities.map(c => `• ${c.category}: ${c.summary}`).join('\n')}

Examples:
${capabilities.flatMap(c => c.examples).slice(0, 5).map(e => `• "${e}"`).join('\n')}

The agent will handle all intermediate steps and return a summary.`;
}
```

**Example output (with github, playwright, linear installed):**

```text
Execute complex workflows autonomously. Current capabilities:

• Git/GitHub: Create branches, commits, PRs, manage issues, code search
• Browser Automation: Navigate pages, fill forms, take screenshots, test UIs
• Project Management: Create/update issues, manage sprints, track progress

Examples:
• "Create a PR with the current changes and request review from @alice"
• "Test the login flow on staging and report any failures"
• "Create a Linear issue for this bug and link it to the PR"

The agent will handle all intermediate steps and return a summary.
```

### Agent SDK Integration

When `han_workflow` is called:

```typescript
async function handleWorkflow(intent: string): Promise<string> {
  // 1. Analyze intent to select relevant backends
  const backends = selectBackends(intent);
  // e.g., ["github", "git"] for PR-related tasks

  // 2. Collect tools from those backends
  const tools = await collectTools(backends);
  // 50+ tools, but CC never sees them

  // 3. Spawn Agent SDK agent with those tools
  const agent = new Agent({
    model: "claude-sonnet-4-5",
    tools: tools,
    systemPrompt: generateAgentPrompt(intent),
  });

  // 4. Run to completion
  const result = await agent.run(intent);

  // 5. Return summary (not raw tool outputs)
  return summarize(result);
}
```

## Tools Exposed to Claude Code

Only these tools are visible to CC:

```typescript
const HAN_TOOLS = [
  // Primary: autonomous workflow execution
  {
    name: "han_workflow",
    description: generateWorkflowDescription(), // Dynamic
    inputSchema: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          description: "What you want to accomplish"
        }
      },
      required: ["intent"]
    }
  },

  // Always available (high frequency, low token cost)
  { name: "memory", ... },
  { name: "learn", ... },
  { name: "checkpoint_list", ... },
  { name: "start_task", ... },
  { name: "complete_task", ... },
];
```

## Backend Connection Management

Han manages connections to backend MCP servers lazily:

```typescript
class BackendPool {
  private backends: Map<string, McpClient> = new Map();

  async getTools(serverId: string): Promise<Tool[]> {
    // Lazy connect
    if (!this.backends.has(serverId)) {
      await this.connect(serverId);
    }

    return this.backends.get(serverId).listTools();
  }

  // Disconnect after idle timeout
  private scheduleIdleDisconnect(serverId: string) { ... }
}
```

## Authentication

Backend servers authenticate via:

1. **Environment passthrough**: Inherit tokens from CC session
2. **CLI integration**: Use existing auth (e.g., `gh auth token` for GitHub)
3. **OAuth delegation**: Some MCP servers handle auth internally (Linear, ClickUp)
4. **Keychain integration**: System credential storage

## Context Savings

| Scenario | Before (all tools) | After (Han only) | Savings |
|----------|-------------------|------------------|---------|
| Session start | ~34K tokens | ~500 tokens | **99%** |
| Simple workflow | ~34K tokens | ~500 tokens | **99%** |
| Complex workflow | ~34K tokens | ~500 tokens | **99%** |

Savings are constant because tools never bubble up.

## Comparison with Platform Features

| Feature | Anthropic Platform | Han Orchestrator |
|---------|-------------------|------------------|
| Tool Search | Returns tool definitions to Claude | Tools completely hidden |
| Programmatic Calling | Claude writes code loops | Agent SDK handles internally |
| defer_loading | Server-side, eventually loads | Never loads to CC |
| Use Case | Fine-grained control | Outcome-focused tasks |

Han's approach is complementary - for tasks where CC needs individual tool control, the platform features are appropriate. For outcome-focused workflows, Han provides complete encapsulation.

## Configuration

```yaml
# han.yml
orchestrator:
  enabled: true

  # Tools always exposed to CC
  always_available:
    - memory
    - learn
    - checkpoint_list
    - start_task
    - complete_task

  # Workflow agent settings
  workflow:
    enabled: true
    max_steps: 20
    timeout: 300  # 5 minutes

  # Backend management
  backends:
    idle_timeout: 300
    max_connections: 10
```

## Implementation Phases

### Phase 1: Backend Registry

- Scan installed hashi plugins at startup
- Build capability index from tool descriptions
- Generate dynamic workflow tool description

### Phase 2: Workflow Agent

- Agent SDK integration for autonomous execution
- Intent → backend selection logic
- Tool subset selection based on task
- Progress streaming and error handling

### Phase 3: Connection Management

- Lazy backend connections (connect on first use)
- Connection pooling with idle timeout
- Health checks and reconnection logic

### Phase 4: Authentication Broker

- Credential passthrough from CC environment
- CLI integration (gh, gcloud, etc.)
- Keychain integration for stored credentials

## Files

- `lib/commands/mcp/orchestrator.ts` - Main orchestrator logic
- `lib/commands/mcp/capability-registry.ts` - Backend scanning and indexing
- `lib/commands/mcp/workflow-agent.ts` - Agent SDK integration
- `lib/commands/mcp/backend-pool.ts` - Connection management
- `lib/commands/mcp/server.ts` - Updated to use orchestrator

## Related

- [MCP Server](./mcp-server.md) - Current MCP implementation
- [Agent SDK](https://github.com/anthropics/agent-sdk) - For workflow agents
- [Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use) - Anthropic guidance
