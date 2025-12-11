# Project Memory Learning

As you work, capture valuable learnings into project memory.

## When to Update Memory

Update CLAUDE.md or `.claude/rules/` when you discover:

- **Project conventions** not documented (naming, patterns, structure)
- **Commands** you had to figure out (build, test, deploy)
- **Gotchas** that caused issues (edge cases, workarounds)
- **Architecture insights** that took effort to understand
- **Constraints** that affected your work (performance, security, compatibility)

## Where to Add Learnings

| Learning Type | Location |
|---------------|----------|
| General project info | `CLAUDE.md` |
| Path-specific rules | `.claude/rules/<domain>.md` |
| Personal preferences | `CLAUDE.local.md` (gitignored) |

## How to Capture

1. **Check if exists**: Read CLAUDE.md first to avoid duplicates
2. **Be concise**: One line per convention, commands in code blocks
3. **Be actionable**: "Use X" not "X is recommended"
4. **Include context**: Why this matters, not just what to do

## Example Updates

When you discover a test command:

```markdown
## Commands

    # Run tests (use --only-failures for faster iteration)
    bun test --only-failures
```

When you discover a convention:

```markdown
## Conventions

- All API functions must be async
- Use `Result<T, Error>` pattern for error handling
```

When you discover a path-specific rule:

```markdown
<!-- .claude/rules/api.md -->
---
globs: ["src/api/**/*.ts"]
---

# API Rules

- Validate all inputs with zod
- Return consistent error format
```

## Trigger Phrases

If you find yourself thinking or saying:

- "I see this project uses..."
- "The pattern here is..."
- "This convention isn't documented..."
- "I had to figure out that..."
- "Next time I should remember..."

**That's a signal to update project memory.**

## Do Not

- Duplicate existing documentation
- Add obvious/universal best practices
- Create huge memory files (keep them focused)
- Add learnings specific to one debugging session
