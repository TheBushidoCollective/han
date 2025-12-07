# ⚠️ MANDATORY: Subagent Delegation Protocol ⚠️

**VIOLATION OF THIS PROTOCOL WASTES USER CONTEXT WINDOW AND IS UNACCEPTABLE**

## 🚨 CRITICAL RULE: User Action Requests MUST Be Delegated

**When the user explicitly asks you to perform an action, you MUST IMMEDIATELY delegate to a subagent.**

### ❌ What Went Wrong (Example)

```
User: "Create a plugin for X"
❌ WRONG: You create the plugin yourself using Write/Edit tools
✅ CORRECT: You delegate to do-claude-plugin-development:plugin-developer agent
```

**Why this matters:**

- You waste context window doing work agents can do autonomously
- Agents have specialized tools and domain expertise
- Your context should be preserved for coordination and user interaction
- Multiple agents can work in parallel, you cannot

## BEFORE Starting ANY User-Requested Task

**MANDATORY PRE-CHECK (DO THIS FIRST):**

1. **Examine the COMPLETE list of available `subagent_type` options in the Task tool**
   - Look at ALL options, not just ones you think are relevant
   - This includes: built-in agents, `do-*` plugins, `hashi-*` plugins, AND any project-specific agents
   - Check the FULL descriptions for each agent type

2. **Match the user's request to available agents:**
   - Does ANY specialized agent match this domain?
   - If yes → STOP and delegate immediately
   - If no → Use appropriate built-in agent (general-purpose, Explore, Plan)

3. **Only proceed yourself if:**
   - Task is trivial (single Read/Grep operation)
   - No agent matches AND task is communication/explanation only
   - You're coordinating between multiple agents

## When to Use Subagents

Use Task tool for:

- ✅ **ANY user request to "create", "build", "implement", "fix", "update" something**
- ✅ Parallel operations (exploration, review, analysis)
- ✅ Extensive codebase search/exploration
- ✅ Complex work needing focused attention
- ✅ Multiple independent perspectives
- ✅ Running commands that may have exhaustive output (tests, builds, linters)
- ✅ **ALL tasks that involve writing or modifying multiple files**

❌ Don't use for:

- Single Read/Grep/Glob operations
- Simple explanations
- Trivial single-file edits

### Step 1: Check ALL Available Subagent Types (MANDATORY)

**YOU MUST examine the COMPLETE list of `subagent_type` options available in the Task tool.**

The Task tool provides access to:

- **Built-in agents**: general-purpose, Explore, Plan, claude-code-guide, statusline-setup
- **Discipline plugins (do-*)**: Specialized engineering workflows
  - do-claude-plugin-development, do-frontend-development, do-backend-development, etc.
- **Bridge plugins (hashi-*)**: MCP server integrations
- **Jutsu plugins**: Technology-specific agents (if project has them)
- **Project-specific agents**: Custom agents defined in the codebase
- **ALL other registered agent types**: Check the full Task tool description

**How to check ALL agents:**

1. Read the Task tool's complete parameter description for `subagent_type`
2. Look at EVERY available agent type listed, not just the first few
3. Read each agent's full description
4. Match against user's request

**Example:** User asks "create a plugin for agent-sop"

MANDATORY CHECK:

- ✅ Scan ALL subagent_type options
- ✅ Find: `do-claude-plugin-development:plugin-developer` - "Use this agent to create Claude Code plugins"
- ✅ This EXACTLY matches the request
- ✅ Delegate immediately to this agent

**Why check ALL agents:**

- You might miss specialized agents if you only skim
- Project-specific agents may exist that you don't know about
- New agents may be added that you haven't seen before
- Agent descriptions tell you EXACTLY when to use them

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

**MANDATORY DO:**

- **CHECK ALL available subagent_type options FIRST** before doing ANY work
- Launch parallel agents in single message
- Trust subagent expertise completely
- Provide complete context in prompts
- Use specialized agents over general-purpose when available
- Filter all findings to ≥80% confidence

**NEVER DO:**

- ❌ **Start work before checking for matching agents**
- ❌ **Assume no agent exists without checking the full list**
- ❌ Do complex multi-file work yourself instead of delegating
- ❌ Use subagents for trivial single-read operations
- ❌ Launch agents sequentially when parallel possible
- ❌ Spawn agents for work you're already doing
- ❌ Report low-confidence findings
- ❌ Second-guess domain experts without reason

## Self-Check Before Taking Action

Ask yourself:

1. ✅ Have I checked the COMPLETE list of subagent_type options?
2. ✅ Have I read the full description of each matching agent?
3. ✅ Is there a specialized agent that fits this task?
4. ✅ Am I about to do complex work that an agent should do?
5. ✅ Will this work create/modify multiple files?

**If any answer is NO or UNSURE → STOP and check agents first**
