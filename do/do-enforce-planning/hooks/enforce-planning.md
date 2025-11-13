<!--
SCOPE: This hook applies on every UserPromptSubmit event to enforce planning
before implementation work begins.
-->

# Planning Enforcement

**CRITICAL**: Before starting ANY implementation work, you must ensure a plan
exists for non-trivial tasks.

## Planning Requirement Check

For every user request, evaluate:

### Does this task require a plan?

**Tasks that REQUIRE planning:**

- Multi-step implementations (3+ distinct steps)
- New features or functionality
- Refactoring existing code (beyond simple renames)
- Architecture or design changes
- Non-trivial bug fixes (anything beyond a one-line change)
- Database schema changes or migrations
- API design and implementation
- Integration with external systems or services
- Security-sensitive changes
- Performance optimization work

**Tasks that DON'T require planning:**

- Simple questions or clarifications
- Reading, viewing, or analyzing existing files
- Running existing commands or scripts
- Trivial changes (typos, formatting, simple renames)
- Documentation updates (unless major restructuring)
- Answering "how does X work?" questions

## Planning Enforcement Workflow

When a task requires planning:

### Step 1: Check for Existing Plan

Look in the `plans/` directory at the repository root:

```bash
# Check if plans directory exists and list contents
ls -la plans/
```

Search for plans related to the current task:

- Look for descriptive filenames matching the task
- Check plan contents for relevance
- Verify plan is current and applicable

### Step 2: Determine Action

**If a relevant plan exists:**

- Review the plan to understand the approach
- Verify it's still applicable and up-to-date
- Proceed with implementation following the plan
- Reference the plan file in your work

**If NO plan exists:**

- **STOP implementation immediately**
- Invoke the `planner` agent to create a plan
- Wait for the plan to be created and approved
- Only then proceed with implementation

### Step 3: Invoke Planner Agent

If no plan exists, use this approach:

```markdown
I need to create a plan for this task before proceeding. Let me invoke the
planner agent to analyze requirements and create a comprehensive plan.

[Invoke planner agent with task description and context]
```

**DO NOT:**

- Start implementation without a plan
- Create partial plans yourself (delegate to planner agent)
- Skip planning "just this once"
- Assume simple tasks don't need plans if they meet criteria above

**DO:**

- Stop and invoke planner before implementation
- Reference existing plans when available
- Ensure plan approval before proceeding
- Update plans if approach changes during implementation

## Plan File Naming Convention

Plans should be stored in: `plans/<descriptive-task-name>.md`

**Good examples:**

- `plans/add-user-authentication.md`
- `plans/refactor-payment-processing.md`
- `plans/migrate-to-typescript.md`
- `plans/implement-search-feature.md`

**Bad examples:**

- `plans/plan.md` (not descriptive)
- `plans/feature-1.md` (not specific)
- `plans/TODO.md` (not task-specific)

## Plan Structure Requirements

Every plan MUST include:

1. **Objective**: What are we trying to achieve?
2. **Context**: Why are we doing this? Background info.
3. **Approach**: How will we solve this? Strategy and design decisions.
4. **Implementation Steps**: Detailed, actionable steps.
5. **Dependencies**: What needs to exist first?
6. **Testing Strategy**: How will we verify it works?
7. **Risks and Mitigations**: What could go wrong?
8. **Open Questions**: What needs clarification?

Plans should be:

- Clear and actionable
- Technology-appropriate for the project
- Risk-aware and comprehensive
- Focused on WHAT to do, not HOW to code it

Plans should NOT include:

- Time estimates (use phases and priorities instead)
- Implementation code details
- Overly prescriptive instructions

## Integration with Implementation Agents

When delegating to implementation agents after planning:

1. **Reference the plan explicitly:**

   ```markdown
   Please implement Step 3 from the plan in `plans/add-authentication.md`
   ```

2. **Provide context:**
   - Summarize the objective
   - Highlight critical considerations
   - Note any dependencies

3. **Verify alignment:**
   - Ensure implementation follows plan
   - Document any deviations
   - Update plan if approach changes

## Enforcement Examples

### Example 1: Multi-step Feature (Requires Plan)

**User Request:**
> "Add user authentication to the app"

**Correct Response:**

```markdown
This is a multi-step feature that requires planning. Let me check if a plan
exists for authentication.

[Check plans/ directory]

No existing plan found. I'll invoke the planner agent to create a comprehensive
plan covering security, database schema, API design, and frontend integration.

[Invoke planner agent]
```

**Incorrect Response:**

```markdown
I'll implement user authentication. First, let me create the database schema...
[starts implementation without plan]
```

### Example 2: Trivial Change (No Plan Needed)

**User Request:**
> "Fix the typo in README.md where it says 'teh' instead of 'the'"

**Correct Response:**

```markdown
This is a simple typo fix that doesn't require planning. I'll fix it directly.

[Fix typo using Edit tool]
```

### Example 3: Existing Plan (Follow It)

**User Request:**
> "Implement the payment processing feature"

**Correct Response:**

```markdown
Let me check if we have a plan for payment processing.

[Check plans/ directory]

Found existing plan: `plans/implement-payment-processing.md`

[Review plan]

Great! I'll follow the plan and start with Step 1: Setting up Stripe SDK
integration. The plan covers security considerations, webhook handling, and
error cases.

[Proceed with implementation following plan]
```

### Example 4: Unclear Scope (Ask First)

**User Request:**
> "Improve the search functionality"

**Correct Response:**

```markdown
I need to understand the scope better. Can you clarify:

1. What specific improvements are you looking for?
   - Performance optimization?
   - New search features (filters, sorting)?
   - Better relevance/ranking?
   - Search UI improvements?

2. Is this a quick fix or a comprehensive overhaul?

Based on your answer, I'll determine if we need a plan before proceeding.
```

## Remember

Planning is not bureaucracy - it's risk mitigation.

A few minutes of planning can save hours of rework.

When in doubt:

1. Check for existing plan
2. If unclear whether planning is needed, create a plan
3. Never start complex work without a roadmap

**The cost of planning is small. The cost of poor planning is huge.**
