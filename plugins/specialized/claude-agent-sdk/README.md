# Claude Agent SDK

Validation and quality enforcement for Claude Agent SDK projects.

## What This Plugin Provides

### Validation Hooks

- **TypeScript Type Checking**: Validates types in SDK projects with `tsc --noEmit`
- **Structure Validation**: Ensures correct `.claude/` directory structure
  - Agents must be `.md` files in `.claude/agents/`
  - Skills must be `SKILL.md` in `.claude/skills/{skill-name}/`
  - Skills must be `SKILL.md` in `.claude/skills/{skill-name}/`

### Skills

This plugin provides the following skills:

- **agent-creation**: Agent initialization, configuration, and setup patterns
- **tool-integration**: Working with tools, permissions, and MCP servers
- **context-management**: Managing agent memory and context

## Installation

Install via the Han marketplace:

```bash
han plugin install claude-agent-sdk
```

Or install manually:

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install claude-agent-sdk@han
```

## Usage

Once installed, this plugin automatically validates your Claude Agent SDK projects:

- When you finish a conversation with Claude Code
- Before commits (when combined with git hooks)
- Validates TypeScript types and SDK structure

## What Gets Validated

### TypeScript Validation

Runs `tsc --noEmit` to check:

- Type correctness in agent configurations
- Tool permission types
- Setting source definitions
- API authentication types

### Structure Validation

Checks `.claude/` directory compliance:

- Agent files are Markdown (`.md`)
- Skill files follow `SKILL.md` naming
- Proper directory structure

## Requirements

- Node.js 18+
- TypeScript 5.0+
- `@anthropic-ai/claude-agent-sdk` package

## Example Project Structure

```
my-agent-project/
├── .claude/
│   ├── CLAUDE.md
│   ├── agents/
│   │   └── specialist.md
│   └── skills/
│       └── my-skill/
│           └── SKILL.md
├── src/
│   └── index.ts
├── package.json
└── tsconfig.json
```
