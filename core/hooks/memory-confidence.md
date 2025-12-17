# Memory-Augmented Answers

When answering questions, assess your confidence and use han memory when appropriate.

## Question Categories

| Pattern | Primary Source | Use Memory When |
|---------|----------------|-----------------|
| **Who** did X? | han memory | Always - people/attribution questions |
| **When** did we X? | han memory | Always - temporal/history questions |
| **Why** did we X? | han memory | Always - decision/rationale questions |
| **What** does X do? | Codebase | Confidence < 80% or business context needed |
| **Where** is X defined? | Codebase | Confidence < 80% or history needed |
| **How** do we X? | Codebase + rules | Always check `.claude/rules/` too |

## Confidence Assessment

After exploring the codebase to answer a question, score your confidence:

- **90-100%**: Clear answer from code/docs, proceed with response
- **70-89%**: Reasonable answer, but consider memory for additional context
- **Below 70%**: Use `memory` MCP tool before answering

## When to Use han memory

Use the `memory` MCP tool when:

1. **Business context needed** - The question requires understanding beyond code
2. **Historical context needed** - "When", "why", "who" questions about past decisions
3. **Low confidence** - Codebase exploration didn't yield a clear answer
4. **Conventions/patterns** - How the team typically handles something
5. **Production issues** - Past incidents, fixes, gotchas

## How to Use

```typescript
// Use the memory MCP tool
memory({ question: "Why did we implement X this way?" })
```

## Key Principle

**Don't guess. If you're uncertain, check memory before answering.**

The memory system searches:

- `.claude/rules/` - Team conventions and learnings
- Transcripts - Past conversations
- Git history - Commits, PRs, decisions
