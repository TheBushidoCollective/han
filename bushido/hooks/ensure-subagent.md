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

**CRITICAL:** When the user explicitly asks you to perform an action (run tests, build, lint, etc.), you MUST delegate to the appropriate tool or agent. Never respond with just an explanation of how to do it - actually do it.

Examples:

- "run tests" → Delegate to general-purpose agent to run tests and report results
- "build the project" → Delegate to general-purpose agent to run build and report results
- "check for lint errors" → Delegate to general-purpose agent to run linter and summarize issues
- "where is X handled?" → Delegate to Explore agent for fast codebase search
- "how does Y work?" → Delegate to Explore agent to trace through the codebase
- "plan the implementation" → Delegate to Plan agent for architectural design

### Subagent Type Selection

| User Request | Subagent Type | Why |
|--------------|---------------|-----|
| Run tests, build, lint | `general-purpose` | Executes commands, handles output |
| Find files, search code | `Explore` | Optimized for fast codebase navigation |
| Understand architecture | `Explore` | Can trace through multiple files |
| Design implementation | `Plan` | Creates step-by-step plans with trade-offs |
| Review code changes | `general-purpose` | Needs full context for analysis |
| Generate Playwright tests | `hashi-playwright-mcp:test-generator` | Specialized for Playwright test generation |
| Debug UI issues | `hashi-playwright-mcp:ui-debugger` | Specialized for browser debugging |
| Questions about Claude Code | `claude-code-guide` | Has access to official documentation |

**Finding Custom Agents:** Check the Task tool's `subagent_type` options for specialized agents like `do-*` (discipline plugins), `hashi-*` (MCP integrations), or project-specific agents. Custom agents have domain expertise and specialized tools.

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
