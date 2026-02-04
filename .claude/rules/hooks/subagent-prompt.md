# SubagentPrompt Hook

SubagentPrompt is a "virtual" hook type used by plugins to provide context that gets injected into subagent and skill tool calls.

## How It Works

1. Core Han defines a PreToolUse hook that intercepts Task and Skill tools
2. The hook runs `han hook orchestrate SubagentPrompt --tool-name <Task|Skill>`
3. All SubagentPrompt hooks from enabled plugins are executed
4. Their combined output is wrapped in `<subagent-context>` tags
5. This context is prepended to the tool's prompt/arguments

## Defining a SubagentPrompt Hook

```yaml
# han-plugin.yml
hooks:
  my-context:
    event: SubagentPrompt
    command: bash "${CLAUDE_PLUGIN_ROOT}/hooks/my-context.sh"
    description: Provide context for subagents
```

## Filtering by Tool Type

Use `tool_filter` to control which tools receive your context:

```yaml
hooks:
  # Only inject context for Task tool (subagents)
  task-only-context:
    event: SubagentPrompt
    command: echo "Task context here"
    tool_filter: [Task]

  # Only inject context for Skill tool
  skill-only-context:
    event: SubagentPrompt
    command: echo "Skill context here"
    tool_filter: [Skill]

  # Both tools (default if tool_filter omitted)
  all-context:
    event: SubagentPrompt
    command: echo "Context for both"
    tool_filter: [Task, Skill]
```

## Output Format

Your hook script should output plain text to stdout. This text will be included in the injected context:

```bash
#!/bin/bash
# hooks/my-context.sh

echo "## My Plugin Context"
echo "Current state: active"
echo "User preference: verbose"
```

The final injection looks like:

```
<subagent-context>
## My Plugin Context
Current state: active
User preference: verbose
</subagent-context>

[Original prompt/arguments here]
```

## Notes

- SubagentPrompt hooks run synchronously (not deferred)
- Output is combined from all matching hooks
- Empty output is ignored
- The hook runs in the project directory
