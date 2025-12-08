---
title: "Testing with Confidence: How Han's Validation Hooks Ensure Quality"
description: "Learn how Han's validation hooks provide automatic quality enforcement, ensuring your code meets standards before it ships."
date: "2024-12-03"
author: "Jason Waldrip"
tags: ["testing", "quality", "hooks", "validation"]
category: "Best Practices"
---

One of the most powerful features of Han plugins is their validation hook system. Unlike traditional linters or test runners that you have to remember to run, Han's hooks execute automatically at key points in your development workflow, ensuring quality without friction.

## The Problem with Manual Testing

We've all been there: you make a quick fix, commit it, push it, and only then discover that you broke the tests. Or worse, you forgot to run the linter and now CI is failing. Manual quality checks rely on discipline and memory—two things that fail us when we're focused on solving problems.

## How Han Hooks Work

Han plugins can register hooks that run automatically when specific events occur in Claude Code:

- **UserPromptSubmit**: Runs when you submit a prompt, before Claude processes it
- **Stop**: Runs when Claude finishes responding to your request
- **PreToolUse**: Runs before a tool executes
- **PostToolUse**: Runs after a tool completes

### Real Example: TypeScript Validation

Let's look at how the `jutsu-typescript` plugin uses hooks to enforce type safety:

```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "npx tsc --noEmit"
      }]
    }]
  }
}
```

This simple hook ensures that every time Claude finishes working on your TypeScript code, the type checker runs. If there are type errors, you know immediately—not later during CI.

## Validation Without Slowdown

You might think "won't this slow me down?" Actually, no. Han's hook system is designed for speed:

1. **Smart caching**: If files haven't changed, cached results are returned instantly
2. **Parallel execution**: Multiple hooks run concurrently
3. **Early termination**: Hooks can fail fast, giving you immediate feedback

Here's what validation looks like in practice with `jutsu-bun`:

```bash
# You ask Claude to implement a feature
"Add user authentication with JWT"

# Claude writes the code
# Stop hook automatically runs:
✓ Tests passed (12/12) - 847ms
✓ Types checked - 523ms (cached)
✓ Linting passed - 198ms

# You know it works before you even look at it
```

## Multi-Layer Validation

The real power comes from combining multiple plugins. With Han's plugin system, you can stack validation:

```json
{
  "enabledPlugins": {
    "jutsu-typescript@han": true,
    "jutsu-biome@han": true,
    "jutsu-bun@han": true,
    "bushido@han": true
  }
}
```

Now every change gets:

- Type checking (TypeScript)
- Linting and formatting (Biome)
- Test execution (Bun)
- Code review analysis (Bushido)

All automatic. All fast. All enforced.

## Custom Validation for Your Stack

Want custom validation? Create your own hooks. Here's a simple example that ensures commit messages follow conventional commits:

```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "bash scripts/validate-commit-msg.sh"
      }]
    }]
  }
}
```

```bash
#!/bin/bash
# scripts/validate-commit-msg.sh
if ! git log -1 --pretty=%s | grep -E '^(feat|fix|docs|chore|refactor|test)(\(.+\))?: .+'; then
  echo "❌ Commit message must follow conventional commits format"
  exit 1
fi
```

## Confidence in Automation

The beauty of Han's hook system is that it transforms "I hope this works" into "I know this works." When Claude tells you it's done:

- Tests have run
- Types have checked
- Lint has passed
- Standards are enforced

You can commit and move on with confidence.

## Getting Started

Want to add validation hooks to your workflow? Start simple:

1. Install a jutsu plugin for your stack (`jutsu-typescript`, `jutsu-python`, etc.)
2. The validation hooks are automatically active
3. Watch as Claude's work is automatically verified

Then layer on more plugins as you need them. Each one adds another layer of confidence without adding cognitive load.

## Conclusion

Manual quality checks are a thing of the past. With Han's validation hooks, quality enforcement is automatic, fast, and comprehensive. You focus on solving problems; Han ensures the solutions are correct.

Try it yourself:

```bash
han plugin install jutsu-typescript
```

Your future self will thank you.

---

*Want to learn more about Han's hook system? Check out our [Hooks Documentation](/docs#hooks) or explore the [plugin marketplace](/plugins).*
