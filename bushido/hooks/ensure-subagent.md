# Ensure Proper Subagent Usage

When delegating work to subagents, follow these principles:

## When to Use Subagents

Use the Task tool to spawn subagents when:

- The task requires multiple parallel operations
- You need to search/explore the codebase extensively
- The work is complex and benefits from focused attention
- You want to isolate context for a specific subtask

## Best Practices

**1. Clear Task Descriptions**
Provide complete, autonomous task descriptions. The subagent won't
be able to ask follow-up questions.

**2. Specify Expected Output**
Tell the subagent exactly what information to return in their final
report.

**3. Parallel Execution**
When tasks are independent, launch multiple subagents in a single
message for maximum performance.

**4. Trust Subagent Output**
Subagent results should generally be trusted. Don't second-guess
or re-verify their work unless there's a specific concern.

## Anti-Patterns

**Don't:**

- Use subagents for simple, single-file operations
- Spawn subagents when you already know the answer
- Create subagents for tasks you're already in the middle of
- Launch subagents sequentially when they could run in parallel

**Do:**

- Use appropriate tools (Read, Grep, Glob) for simple operations
- Spawn multiple subagents at once when possible
- Provide complete context in the task prompt
- Choose the right subagent_type for the task
