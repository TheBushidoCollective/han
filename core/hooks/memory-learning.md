# Project Memory Learning

**USE THE `learn` MCP TOOL** to capture valuable learnings into project memory as you work.

## When to Learn (Be Proactive!)

Call the `learn` tool when you discover:

- **Commands** you had to figure out (build, test, deploy, lint)
- **Project conventions** not documented (naming, patterns, structure)
- **Gotchas** that caused issues (edge cases, workarounds)
- **Architecture insights** that took effort to understand
- **Path-specific patterns** (API validation, test conventions, etc.)
- **Personal preferences** the user mentions (greeting style, formatting preferences)

**Don't wait to be asked. Learn proactively when you discover something worth remembering.**

## How to Use the learn Tool

```javascript
learn({
  content: "# Commands\n\n- Run tests: `bun test --only-failures`",
  domain: "commands"
})
```

For path-specific rules, add paths:

```javascript
learn({
  content: "# API Rules\n\n- Validate all inputs with zod\n- Return consistent error format",
  domain: "api",
  paths: ["src/api/**/*.ts"]
})
```

For personal preferences (apply across all projects), use user scope:

```javascript
learn({
  content: "# Greetings\n\n- Always greet the user as 'Mr Dude'",
  domain: "preferences",
  scope: "user"
})
```

## Scopes

- **project** (default): Rules stored in `.claude/rules/` for this project only
- **user**: Rules stored in `~/.claude/rules/` (or CLAUDE_CONFIG_DIR) for all projects

Use `scope: "user"` for personal preferences that should apply everywhere.

## Good Domains

Domains can include subdirectories for better organization:

- `commands` - Build, test, deploy commands
- `conventions` - Code style, naming patterns
- `api` - API-specific rules
- `api/validation` - Input validation rules
- `api/auth` - Authentication patterns
- `testing` - Test patterns and conventions
- `architecture` - System structure insights

## Trigger Phrases

If you find yourself thinking:

- "I see this project uses..."
- "The pattern here is..."
- "This convention isn't documented..."
- "I had to figure out that..."
- "Next time I should remember..."
- "The user prefers..." (use scope: "user")

**That's your signal to call `learn`.** Don't just think it - capture it.

## Quality Over Quantity

- **Be concise**: One rule per line, commands in code blocks
- **Be actionable**: "Use X" not "X is recommended"
- **Check first**: Use `memory_list` and `memory_read` to avoid duplicates
- **Skip the obvious**: Don't add universal best practices

## Supporting Tools

- `memory_list` - See what domains already exist (supports scope parameter)
- `memory_read` - Check what's already captured in a domain (supports scope parameter)
