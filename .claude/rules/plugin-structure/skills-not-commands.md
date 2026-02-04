# Skills Replace Commands

## Migration Complete

As of Claude Code 1.0.17+, **skills are directly invocable as slash commands**. The separate `commands/` directory is deprecated and has been removed from all Han plugins.

## What Changed

Previously, plugins had two directories:
- `commands/` - Slash command definitions (e.g., `/review-pr`)
- `skills/` - Reusable skill definitions

Now, skills serve both purposes:
- Skills are invocable via `/skill-name` syntax
- No separate command files needed
- Skills provide richer documentation and implementation guidance

## Plugin Structure (Current)

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json
├── han-plugin.yml
├── skills/
│   ├── skill-one/
│   │   └── SKILL.md
│   └── skill-two/
│       └── SKILL.md
└── README.md
```

**Note:** No `commands/` directory.

## Skill File Format

Skills use the same frontmatter format that commands used:

```markdown
---
description: Brief description shown in /help
---

# Skill Title

## Name

plugin:skill-name - One-line description

## Synopsis

```
/skill-name [arguments]
```

## Description

Detailed description of what this skill does.

## Implementation

Step-by-step implementation guidance for Claude.

## Example Interaction

Show example usage and expected output.
```

## Invoking Skills

Users invoke skills directly:

```
/review-pr 123
/create-issue "Bug in login flow"
/monitor-pipeline 456 1234
```

## Reference

See Claude Code documentation:
- [Skills documentation](https://docs.anthropic.com/en/docs/claude-code/skills)
- Skills are registered in `plugin.json` or discovered from `skills/` directory
- Each skill directory must contain a `SKILL.md` file

## For Plugin Authors

When creating new functionality:

1. Create a skill directory: `skills/my-feature/`
2. Add `SKILL.md` with frontmatter and documentation
3. Do NOT create a `commands/` directory
4. The skill is automatically available as `/my-feature`
