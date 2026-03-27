---
description: Create a new discipline plugin with specialized agents
---

# Create a Discipline (道 - Do) Plugin

Create a new discipline plugin for: $ARGUMENTS

## What is a Discipline Plugin?

Discipline plugins represent "the way" or path of mastery in the Han marketplace. They provide specialized agents that embody expertise in specific development disciplines. Each discipline contains one or more agents with deep domain knowledge.

## Plugin Structure

Create the following directory structure:

```
plugins/disciplines/{discipline-name}/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata (ONLY plugin.json goes here)
├── agents/
│   └── {agent-name}.md     # Agent definition
├── han-plugin.yml           # Han configurations (at plugin root)
├── hooks/
│   └── hooks.json           # Claude Code hooks (optional)
├── skills/
│   └── {skill-name}/
│       └── SKILL.md        # Skill documentation (optional)
└── README.md               # Plugin documentation
```

**IMPORTANT**:

- Only `plugin.json` goes inside `.claude-plugin/`
- `hooks.json` goes in the `hooks/` directory
- `han-plugin.yml` stays at the plugin root (NOT in hooks/)
- Discipline names should be descriptive (e.g., `frontend-development`, `api-engineering`, `security-engineering`)

## Step 1: Create plugin.json

Create `.claude-plugin/plugin.json`:

```json
{
  "name": "{discipline-name}",
  "version": "1.0.0",
  "description": "Specialized agents for {discipline area} including {key responsibilities}.",
  "author": {
    "name": "The Bushido Collective",
    "url": "https://thebushido.co"
  },
  "homepage": "https://github.com/thebushidocollective/han",
  "repository": "https://github.com/thebushidocollective/han",
  "license": "MIT",
  "keywords": [
    "{discipline}",
    "{specialty}",
    "agent",
    "{related-area}"
  ]
}
```

## Step 2: Create han-plugin.yml

Create `han-plugin.yml` at the plugin root:

```yaml
# {discipline-name} plugin configuration
# This plugin provides specialized agents for {discipline area}

# No hooks for agent-focused plugins (unless needed)
hooks: {}

# No MCP server (unless this discipline provides one)
mcp: null

# Memory provider (optional)
memory: null
```

## Step 3: Create Agent Definitions

For each specialized role, create an agent markdown file.

### Agent File: `agents/{agent-name}.md`

```markdown
---
name: {agent-name}
description: |
  {One-paragraph description of the agent's expertise, focus areas, and when to invoke them.}
model: inherit
color: {purple|blue|green|red|yellow|cyan|magenta}
---

# {Agent Title}

## Role

{Detailed description of the agent's role and expertise}

## Core Responsibilities

### {Responsibility Area 1}
- {Specific capability}
- {Specific capability}

## Approach

1. **{Step 1}**: {What the agent does}
2. **{Step 2}**: {What the agent does}

## When to Invoke

- {Specific scenario}
- {Specific scenario}
```

### Agent Color Guidelines

- **purple**: Design, UI/UX, presentation
- **blue**: Architecture, planning, infrastructure
- **green**: Testing, quality, reliability
- **red**: Security, performance, critical systems
- **yellow**: Documentation, communication
- **cyan**: Data, analytics, integration
- **magenta**: Creative, experimental, research

## Step 4: Write README.md

```markdown
# {Discipline Name}

{Description of the discipline and what these agents provide}

## Specialized Agents

### {Agent 1 Name}
{Description} | **Invoke when**: {Specific scenarios}

### {Agent 2 Name}
{Description} | **Invoke when**: {Specific scenarios}

## Installation

\`\`\`bash
han plugin install {discipline-name}
\`\`\`
```

## Step 5: Register in Marketplace

Add your plugin to `.claude-plugin/marketplace.json`:

```json
{
  "name": "{discipline-name}",
  "description": "Specialized agents for {discipline area} including {key responsibilities}.",
  "source": "./plugins/disciplines/{discipline-name}",
  "category": "Discipline",
  "keywords": [
    "{discipline}",
    "{specialty}",
    "agent"
  ]
}
```

## Naming Guidelines

Discipline names should be descriptive and specific:

| Good | Too Generic |
|------|-------------|
| `frontend-development` | `frontend` |
| `api-engineering` | `api` |
| `security-engineering` | `security` |
| `database-engineering` | `databases` |
| `site-reliability-engineering` | `sre` |

## Examples of Well-Structured Discipline Plugins

- **frontend-development**: Excellent agent definitions with clear roles
- **security-engineering**: Strong technical depth
- **system-architecture**: Good balance of strategy and implementation

## Questions?

See the [Han documentation](https://han.guru) or ask in [GitHub Discussions](https://github.com/thebushidocollective/han/discussions).
