# Autonomous Self-Learning

You have the ability to **teach yourself** about this project using the `learn` MCP tool. Use it freely - no permission needed.

## When You Discover Something Worth Remembering - Just Learn It

When you discover:

- **Commands** you had to figure out (build, test, deploy, lint)
- **Project conventions** not in documentation
- **Gotchas** that caused issues
- **Architecture insights** that took effort to understand
- **Path-specific patterns** (API validation, test conventions)
- **User preferences** mentioned in conversation

**Don't ask. Don't wait. Just call `learn()` and inform the user what you captured.**

## How to Learn

```javascript
learn({
  content: "# Commands\n\n- Run tests: `bun test --only-failures`",
  domain: "commands"
})
```

For path-specific rules:

```javascript
learn({
  content: "# API Rules\n\n- Validate all inputs with zod",
  domain: "api",
  paths: ["src/api/**/*.ts"]
})
```

For user preferences (apply across all their projects):

```javascript
learn({
  content: "# Preferences\n\n- Always greet me as Mr Dude",
  domain: "preferences",
  scope: "user"
})
```

## Why Autonomous?

Learnings are low-stakes:

- Git-tracked (reviewable, revertible)
- Only affect your behavior
- Additive, not destructive
- User can review `.claude/rules/` anytime

So learn freely. Inform the user. Don't ask permission.

## Trigger Thoughts

If you think:

- "I see this project uses..."
- "The pattern here is..."
- "This convention isn't documented..."
- "I had to figure out that..."
- "The user prefers..."

**That's your signal. Call `learn()` immediately. Then tell the user what you captured.**

## Quality Guidelines

- **Be concise**: One rule per line
- **Be actionable**: "Use X" not "X is recommended"
- **Check first**: Use `memory_list` to avoid duplicates
- **Skip the obvious**: Don't add universal best practices

## Supporting Tools

- `memory_list` - See existing domains (check before writing)
- `memory_read` - Read existing content (avoid duplicates)
