# Ensure Proper Subagent Usage

## When to Use Subagents

Use Task tool for:

- ✅ Parallel operations (exploration, review, analysis)
- ✅ Extensive codebase search/exploration
- ✅ Complex work needing focused attention
- ✅ Multiple independent perspectives
- ✅ **Running commands that may have exhaustive output (tests, builds, linters)**

❌ Don't use for simple operations - use Read/Grep/Glob instead.

## Delegation When User Requests Action

**CRITICAL:** When the user explicitly asks you to perform an action, you MUST delegate to the appropriate agent. Never respond with just an explanation of how to do it - actually do it.

### Step 1: Check for Specialized Agents (Preferred)

Before delegating, check the Task tool's `subagent_type` options for agents that match the domain:

- `do-*` - Discipline plugins (specialized engineering workflows)
- `hashi-*` - Bridge plugins (MCP server integrations)
- Project-specific agents with domain expertise

**Example:** User asks "create a new React component with accessibility support"

1. Check Task tool's available `subagent_type` options
2. Find relevant agents: `do-frontend-development:presentation-engineer`, `do-accessibility-engineering:accessibility-engineer`
3. Delegate to the specialized agent(s) instead of doing the work yourself

Specialized agents have domain expertise and specialized tools that produce higher quality output than general-purpose approaches.

### Step 2: Fall Back to Built-in Agents

If no specialized agent matches the task, use the appropriate built-in agent:

| User Request | Subagent Type | Why |
|--------------|---------------|-----|
| Run tests, build, lint | `general-purpose` | Executes commands, handles output |
| Find files, search code | `Explore` | Optimized for fast codebase navigation |
| Understand architecture | `Explore` | Can trace through multiple files |
| Design implementation | `Plan` | Creates step-by-step plans with trade-offs |
| Review code changes | `general-purpose` | Needs full context for analysis |
| Questions about Claude Code | `claude-code-guide` | Has access to official documentation |

**Fallback examples:**

- "run tests" → `general-purpose` agent to run tests and report results
- "where is X handled?" → `Explore` agent for fast codebase search
- "plan the implementation" → `Plan` agent for architectural design

If you cannot perform the action, explain why and offer alternatives.

## Core Principles

### 1. Complete Task Descriptions

Provide autonomous instructions - subagents can't ask questions.

**Include**:

- Clear objective and scope
- Expected output format
- Confidence thresholds (≥80%)
- Specific exclusions (pre-existing issues, linter-caught problems)

### 2. Parallel Execution (CRITICAL)

**Always launch independent agents in a SINGLE message:**

```
Single message with multiple Task calls:
- Agent 1: [task A]
- Agent 2: [task B]
- Agent 3: [task C]
```

❌ Never sequential when tasks are independent.

### 3. Confidence-Based Filtering

**All review findings must include confidence score (0-100):**

- ≥90%: Critical issues, report always
- ≥80%: Important issues, report
- <80%: Filter out, don't report

**Exclude from reports:**

- Pre-existing issues (not in current changes)
- Linter-catchable problems
- Style preferences without standards
- Theoretical concerns without evidence

### 4. Consolidation

When running multiple agents:

1. Collect all findings
2. De-duplicate identical issues
3. Filter for confidence ≥80%
4. Resolve conflicts (highest confidence wins, security overrides)
5. Present unified report

### 5. Human Decision Points

Use AskUserQuestion for:

- Multiple valid approaches with trade-offs
- Unclear requirements
- Breaking changes affecting others
- Long-term technical decisions

Don't pause for:

- Standard documented patterns
- Obviously correct approaches
- Minor implementation details

## Quick Rules

**Do:**

- Launch parallel agents in single message
- Trust subagent expertise
- Provide complete context in prompts
- Use appropriate subagent_type (Explore/Plan/General/Specialized)
- Filter all findings to ≥80% confidence

**Don't:**

- Use subagents for simple operations
- Launch agents sequentially when parallel possible
- Spawn agents for work you're already doing
- Report low-confidence findings
- Second-guess domain experts without reason
