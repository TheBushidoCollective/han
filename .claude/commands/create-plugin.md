---
description: Create a new Han plugin (jutsu, hashi, or do)
---

# Create a Han Plugin

Create a new plugin for: $ARGUMENTS

## Plugin Types

First, determine what type of plugin to create based on the user's request:

### Jutsu (術 - Technique)
**Use when**: The plugin provides validation hooks for a technology (linting, type-checking, testing, formatting)
- Examples: biome, typescript, eslint, rust, playwright
- Key feature: Runs validation commands on Stop events
- Structure: `validation/{name}/` or `languages/{name}/` or `tools/{name}/`

### Hashi (橋 - Bridge)
**Use when**: The plugin provides MCP server integration with an external service
- Examples: github, gitlab, reddit, playwright-mcp, sentry
- Key feature: Connects Claude Code to external APIs via MCP
- Structure: `services/{name}/`

### Do (道 - The Way)
**Use when**: The plugin provides specialized agents for a discipline
- Examples: frontend-development, accessibility, content writing
- Key feature: Contains agent definitions for domain expertise
- Structure: `disciplines/{name}/`

---

## Common Structure for All Plugins

All plugins share this base structure:

```
{category}/{plugin-name}/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata (ONLY plugin.json here)
├── han-plugin.yml           # Han configuration (hooks, MCP, memory)
├── commands/                # Slash commands (optional)
│   └── {command-name}.md
├── skills/                  # Skills (optional)
│   └── {skill-name}/
│       └── SKILL.md
└── README.md               # Plugin documentation
```

---

## Jutsu Plugin Template

For validation/quality enforcement plugins:

### plugin.json

```json
{
  "name": "{plugin-name}",
  "version": "1.0.0",
  "description": "Validation and quality enforcement for {Technology} projects.",
  "author": {
    "name": "The Bushido Collective",
    "url": "https://thebushido.co"
  },
  "homepage": "https://han.guru",
  "repository": "https://github.com/thebushidocollective/han",
  "license": "MIT",
  "keywords": ["{technology}", "validation", "quality"]
}
```

### han-plugin.yml

```yaml
hooks:
  lint:
    command: "{lint-command}"
    dirs_with:
      - "{marker-file}"
    if_changed:
      - "{glob-pattern}"

  typecheck:
    command: "{typecheck-command}"
    dirs_with:
      - "{marker-file}"
    if_changed:
      - "**/*.ts"

  test:
    command: "{test-command}"
    dirs_with:
      - "{marker-file}"
    if_changed:
      - "**/*.ts"

mcp: null
memory: null
```

### Common Marker Files
- JavaScript/TypeScript: `package.json`
- Python: `pyproject.toml`, `requirements.txt`
- Rust: `Cargo.toml`
- Go: `go.mod`
- Ruby: `Gemfile`

---

## Hashi Plugin Template

For MCP server integrations:

### plugin.json

```json
{
  "name": "{plugin-name}",
  "version": "1.0.0",
  "description": "MCP server for {Service} integration.",
  "author": {
    "name": "The Bushido Collective",
    "url": "https://thebushido.co"
  },
  "homepage": "https://han.guru",
  "repository": "https://github.com/thebushidocollective/han",
  "license": "MIT",
  "keywords": ["mcp", "{service}", "integration"]
}
```

### han-plugin.yml (stdio MCP)

```yaml
mcp:
  name: {server-name}
  description: {Brief description}
  command: npx
  args:
    - -y
    - "@scope/package-name"
  env:
    API_KEY: ${SERVICE_API_KEY}
  capabilities:
    - category: {Category}
      summary: {What it enables}
      examples:
        - {Example 1}
        - {Example 2}

hooks: {}

memory:
  allowed_tools:
    - mcp__{server-name}__{tool_1}
    - mcp__{server-name}__{tool_2}
  system_prompt: |
    Instructions for memory queries...
```

### han-plugin.yml (HTTP MCP)

```yaml
mcp:
  name: {server-name}
  description: {Brief description}
  type: http
  url: https://mcp.service.com/mcp
  capabilities:
    - category: {Category}
      summary: {What it enables}

hooks: {}
memory: null
```

---

## Do Plugin Template

For discipline/agent plugins:

### plugin.json

```json
{
  "name": "{plugin-name}",
  "version": "1.0.0",
  "description": "Specialized agents for {discipline} development.",
  "author": {
    "name": "The Bushido Collective",
    "url": "https://thebushido.co"
  },
  "homepage": "https://han.guru",
  "repository": "https://github.com/thebushidocollective/han",
  "license": "MIT",
  "keywords": ["{discipline}", "agent", "specialist"]
}
```

### han-plugin.yml

```yaml
hooks: {}
mcp: null
memory: null
```

### Agent Definition (agents/{name}.md)

```markdown
---
name: {agent-name}
description: |
  {Detailed description of agent's expertise and when to use it.}
model: inherit
color: blue
---

# {Agent Title}

{Agent overview}

## Role

{Detailed role description}

## Core Responsibilities

### {Area 1}
- {Capability}
- {Capability}

### {Area 2}
- {Capability}
- {Capability}

## Technical Expertise

{Deep knowledge areas}

## When to Invoke

Summon this agent when:
- {Scenario 1}
- {Scenario 2}
- {Scenario 3}
```

---

## Best Practices

### All Plugins
- Only `plugin.json` goes in `.claude-plugin/`
- `han-plugin.yml` at plugin root
- Include comprehensive README.md
- Test before submitting

### Jutsu (Validation)
- Use `--fail-fast` for quick feedback
- Validate, don't auto-fix
- Support monorepos with `dirs_with`
- Use `if_changed` for caching

### Hashi (MCP)
- Prefer HTTP MCP when available (no install needed)
- Document required environment variables
- Include memory provider for team knowledge
- Add commands for common workflows

### Do (Agents)
- Create 3-5 focused agents per discipline
- Write detailed agent definitions (1000+ words)
- Include when/when-not to invoke
- Reference Bushido virtues

---

## Directory Locations

| Type | Directory Pattern | Example |
|------|------------------|---------|
| Validation tools | `plugins/validation/{name}/` | `plugins/validation/biome/` |
| Languages | `plugins/languages/{name}/` | `plugins/languages/typescript/` |
| Frameworks | `plugins/frameworks/{name}/` | `plugins/frameworks/relay/` |
| Testing tools | `plugins/tools/{name}/` | `plugins/tools/playwright/` |
| Services/MCP | `plugins/services/{name}/` | `plugins/services/github/` |
| Disciplines | `plugins/disciplines/{name}/` | `plugins/disciplines/frontend-development/` |

---

Now create the plugin based on the user's request. Determine the appropriate type and directory, then create all required files.
