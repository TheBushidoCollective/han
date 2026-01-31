---
title: "Plugin Types"
description: "Detailed guide for creating jutsu, do, and hashi plugins with complete examples for each type."
---

Han plugins are organized into three categories, each with a specific structure and purpose. This guide provides complete examples for each type.

## Jutsu Plugins (Techniques)

Jutsu plugins provide technology-specific skills and validation hooks. They're the most common plugin type, combining knowledge about a tool with automated quality checks.

### Structure

```
jutsu-my-tool/
├── .claude-plugin/
│   └── plugin.json
├── han-plugin.yml       # Hook configuration
├── skills/
│   ├── getting-started/
│   │   └── SKILL.md
│   ├── configuration/
│   │   └── SKILL.md
│   └── troubleshooting/
│       └── SKILL.md
├── README.md
└── CHANGELOG.md
```

### Example: jutsu-my-linter

**`.claude-plugin/plugin.json`**:

```json
{
  "name": "jutsu-my-linter",
  "version": "1.0.0",
  "description": "My linter skills with automatic validation hooks",
  "author": {
    "name": "Your Name",
    "url": "https://example.com"
  },
  "license": "MIT",
  "keywords": ["linting", "code-quality", "javascript"]
}
```

**`han-plugin.yml`**:

```yaml
# Hook configuration for my-linter
hooks:
  lint:
    command: "npx my-linter check ${HAN_FILES}"
    dirs_with:
      - "my-linter.config.js"
      - ".my-linterrc"
    if_changed:
      - "**/*.{js,jsx,ts,tsx}"
```

**`skills/getting-started/SKILL.md`**:

```markdown
---
name: getting-started
description: Use when setting up my-linter in a new project - covers installation, configuration, and basic usage.
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

# Getting Started with My Linter

This skill provides guidance for setting up my-linter in your project.

## Installation

\`\`\`bash
npm install -D my-linter
\`\`\`

## Configuration

Create a `my-linter.config.js` file:

\`\`\`javascript
module.exports = {
  rules: {
    'no-unused-vars': 'error',
    'prefer-const': 'warn',
  },
};
\`\`\`

## Usage

Run the linter:

\`\`\`bash
npx my-linter check .
npx my-linter check --fix .
\`\`\`
```

### Key Considerations for Jutsu Plugins

1. **Hook commands should be idempotent** - Running them multiple times should produce the same result
2. **Use `${HAN_FILES}` for file-targeted commands** - This enables session-scoped validation
3. **Specify `dirs_with`** - Only run hooks in directories containing your tool's config
4. **Specify `if_changed` patterns** - Skip hooks when no relevant files changed

---

## Do Plugins (Disciplines/Agents)

Do plugins provide specialized AI agents for complex, multi-phase workflows. Each agent is defined in a markdown file with frontmatter.

### Structure

```
do-my-discipline/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   ├── specialist.md
│   └── reviewer.md
├── README.md
└── CHANGELOG.md
```

### Example: do-code-quality

**`.claude-plugin/plugin.json`**:

```json
{
  "name": "do-code-quality",
  "version": "1.0.0",
  "description": "Agents specialized in code quality analysis and improvement",
  "author": {
    "name": "Your Name",
    "url": "https://example.com"
  },
  "license": "MIT",
  "keywords": ["code-quality", "analysis", "agent"]
}
```

**`agents/quality-analyzer.md`**:

```markdown
---
name: quality-analyzer
description: |
  Use this agent for analyzing code quality, identifying technical debt,
  and recommending improvements.

  Examples:
  <example>
  Context: User wants to improve code quality in a module.
  user: 'Analyze the authentication module for code quality issues'
  assistant: 'I'll use quality-analyzer to examine the module for complexity,
  maintainability, and potential improvements.'
  <commentary>This requires specialized analysis beyond simple linting.</commentary>
  </example>
model: inherit
color: purple
---

# Code Quality Analyzer

You are a Code Quality Analyzer specializing in identifying technical debt,
code smells, and improvement opportunities.

## Core Responsibilities

1. **Complexity Analysis**: Identify overly complex functions and modules
2. **Maintainability Review**: Assess code readability and maintenance burden
3. **Pattern Detection**: Find anti-patterns and suggest alternatives
4. **Refactoring Guidance**: Recommend specific improvements with rationale

## Analysis Approach

When analyzing code quality:

1. Calculate cyclomatic complexity for key functions
2. Identify code duplication
3. Check for SOLID principle violations
4. Review error handling patterns
5. Assess test coverage gaps

## Output Format

For each finding:

- **Severity**: Critical / High / Medium / Low
- **Location**: File and line reference
- **Issue**: Clear description of the problem
- **Impact**: Why this matters
- **Recommendation**: How to fix it
```

### Agent Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Agent identifier (kebab-case) |
| `description` | Yes | When to use this agent with examples |
| `model` | No | Model to use (`inherit` uses current model) |
| `color` | No | Display color in UI (blue, green, purple, teal, etc.) |

### Key Considerations for Do Plugins

1. **Provide clear usage examples** - Help Claude understand when to invoke the agent
2. **Define specific responsibilities** - Agents should have focused expertise
3. **Structure the output** - Define clear output formats for consistency
4. **Consider multi-phase workflows** - Agents can coordinate complex tasks

---

## Hashi Plugins (Bridges)

Hashi plugins connect Claude to external services via MCP (Model Context Protocol) servers. They define server configurations and optional memory providers.

### Structure

```
hashi-my-service/
├── .claude-plugin/
│   └── plugin.json
├── .mcp.json            # MCP server configuration
├── han-plugin.yml       # Memory provider config (optional)
├── README.md
└── CHANGELOG.md
```

### Example: hashi-my-api

**`.claude-plugin/plugin.json`**:

```json
{
  "name": "hashi-my-api",
  "version": "1.0.0",
  "description": "MCP server integration for My API service",
  "author": {
    "name": "Your Name",
    "url": "https://example.com"
  },
  "license": "MIT",
  "keywords": ["mcp", "api", "integration"]
}
```

**`.mcp.json`** (stdio transport - most common):

```json
{
  "mcpServers": {
    "my-api": {
      "command": "npx",
      "args": ["-y", "@my-org/mcp-server-my-api"]
    }
  }
}
```

**`.mcp.json`** (HTTP transport - preferred when available):

```json
{
  "mcpServers": {
    "my-api": {
      "type": "http",
      "url": "https://mcp.my-api.com/mcp"
    }
  }
}
```

**`han-plugin.yml`** (with memory provider):

```yaml
# No validation hooks for MCP plugins
hooks: {}

# Memory provider for team memory extraction
memory:
  allowed_tools:
    - mcp__my-api__search
    - mcp__my-api__get_item
    - mcp__my-api__list_items
  system_prompt: |
    Search My API for relevant information.
    Use search for keyword queries.
    Use get_item for specific item retrieval.
    Return findings with context and relevance.
```

### MCP Transport Types

| Transport | When to Use | Example |
|-----------|-------------|---------|
| **HTTP** | Service provides hosted MCP endpoint | GitHub, Linear, GitLab |
| **stdio** | Local MCP server via npm/uvx | Most community servers |
| **Docker** | Server requires specific runtime | Complex dependencies |

**Prefer HTTP transport when available** - it requires no local installation and starts instantly.

### Key Considerations for Hashi Plugins

1. **Prefer HTTP transport** - Zero installation, instant startup
2. **Use npx/uvx for stdio** - Ensures users get the latest version
3. **Document required credentials** - API keys, OAuth setup, etc.
4. **Configure memory providers** - Enable semantic search over service data
5. **Avoid Docker unless necessary** - It adds installation complexity

---

## Choosing the Right Type

| Scenario | Plugin Type |
|----------|-------------|
| Add linting/formatting validation | Jutsu |
| Add build/test hooks | Jutsu |
| Provide tool-specific knowledge | Jutsu |
| Create a specialized AI workflow | Do |
| Build a code review agent | Do |
| Connect to an external API | Hashi |
| Add database integration | Hashi |
| Integrate with project management tools | Hashi |

## Next Steps

- [Hook Configuration](/docs/plugin-development/hooks) - Detailed hook reference
- [Skills and Commands](/docs/plugin-development/skills) - Creating skills and commands
- [Testing Plugins](/docs/plugin-development/testing) - Local testing workflow
