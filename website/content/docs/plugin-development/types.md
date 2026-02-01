---
title: "Plugin Types"
description: "Detailed guide for creating plugins across Han's nine categories: Core, Language, Framework, Validation, Tool, Integration, Discipline, Pattern, and Specialized."
---

Han plugins are organized into nine categories based on their technical layer. This guide provides complete examples and guidelines for each category.

## Category Overview

| Category | Directory | Description |
|----------|-----------|-------------|
| Core | `./core` | Essential infrastructure |
| Language | `./languages` | Programming language support |
| Framework | `./frameworks` | Framework integrations |
| Validation | `./validation` | Linting, formatting |
| Tool | `./tools` | Build tools, testing |
| Integration | `./services` | MCP servers for external services |
| Discipline | `./disciplines` | Specialized AI agents |
| Pattern | `./patterns` | Methodologies, workflows |
| Specialized | `./specialized` | Niche tools |

## Directory Structure

Plugins are organized by category in the Han repository:

```
han/
├── core/                    # Foundation plugins
│   ├── core/               # Technical infrastructure
│   └── bushido/            # Optional philosophy layer
├── languages/               # Language support
│   ├── typescript/
│   ├── python/
│   ├── rust/
│   └── go/
├── frameworks/              # Framework integrations
│   ├── react/
│   ├── nextjs/
│   ├── django/
│   └── rails/
├── validation/              # Linting and formatting
│   ├── biome/
│   ├── eslint/
│   └── prettier/
├── tools/                   # Development tools
│   ├── playwright/
│   ├── jest/
│   └── docker/
├── services/                # MCP integrations
│   ├── github/
│   ├── gitlab/
│   └── linear/
├── disciplines/             # Specialized agents
│   ├── frontend/
│   ├── backend/
│   └── security/
├── patterns/                # Methodologies
│   ├── ai-dlc/
│   ├── tdd/
│   └── atomic-design/
└── specialized/             # Niche tools
    ├── android/
    ├── ios/
    └── tensorflow/
```

---

## Language Plugins

Language plugins provide deep knowledge of specific programming languages, including idioms, best practices, and type systems.

### Structure

```
languages/typescript/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── type-system/
│   │   └── SKILL.md
│   ├── patterns/
│   │   └── SKILL.md
│   └── async/
│       └── SKILL.md
├── README.md
└── CHANGELOG.md
```

### Example: typescript

**`.claude-plugin/plugin.json`**:

```json
{
  "name": "typescript",
  "version": "1.0.0",
  "description": "TypeScript language expertise including type system, patterns, and best practices",
  "author": {
    "name": "Han Team",
    "url": "https://han.guru"
  },
  "license": "MIT",
  "keywords": ["typescript", "language", "types", "javascript"]
}
```

**`skills/type-system/SKILL.md`**:

```markdown
---
name: type-system
description: Use when working with TypeScript's type system - covers generics, utility types, type inference, and advanced patterns.
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

# TypeScript Type System

Expert knowledge for TypeScript's type system.

## Generics

\`\`\`typescript
function identity<T>(value: T): T {
  return value;
}

// With constraints
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
\`\`\`

## Utility Types

- `Partial<T>` - All properties optional
- `Required<T>` - All properties required
- `Pick<T, K>` - Select specific properties
- `Omit<T, K>` - Exclude specific properties
- `Record<K, T>` - Object type with keys K and values T

## Type Inference

TypeScript infers types when possible:

\`\`\`typescript
// Inferred as number[]
const numbers = [1, 2, 3];

// Inferred return type
function add(a: number, b: number) {
  return a + b; // Returns number
}
\`\`\`
```

### Key Considerations for Language Plugins

1. **Cover core language concepts** - Types, patterns, idioms
2. **Include practical examples** - Real code, not pseudocode
3. **Address common pitfalls** - Help avoid typical mistakes
4. **Stay current** - Update for new language versions

---

## Framework Plugins

Framework plugins provide expertise for specific web, mobile, and backend frameworks.

### Structure

```
frameworks/react/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── hooks/
│   │   └── SKILL.md
│   ├── components/
│   │   └── SKILL.md
│   └── performance/
│       └── SKILL.md
├── README.md
└── CHANGELOG.md
```

### Example: react

**`.claude-plugin/plugin.json`**:

```json
{
  "name": "react",
  "version": "1.0.0",
  "description": "React framework expertise including hooks, components, and performance optimization",
  "author": {
    "name": "Han Team",
    "url": "https://han.guru"
  },
  "license": "MIT",
  "keywords": ["react", "framework", "hooks", "components"]
}
```

**`skills/hooks/SKILL.md`**:

```markdown
---
name: hooks
description: Use when working with React hooks - covers useState, useEffect, custom hooks, and hook patterns.
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

# React Hooks

Expert knowledge for React hooks.

## useState

\`\`\`tsx
const [count, setCount] = useState(0);

// Functional updates for derived state
setCount(prev => prev + 1);
\`\`\`

## useEffect

\`\`\`tsx
useEffect(() => {
  // Effect runs after render
  const subscription = subscribe();

  // Cleanup function
  return () => subscription.unsubscribe();
}, [dependency]); // Only re-run when dependency changes
\`\`\`

## Custom Hooks

\`\`\`tsx
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
\`\`\`
```

### Key Considerations for Framework Plugins

1. **Cover framework patterns** - Architecture, data flow, state management
2. **Include component examples** - Complete, working code
3. **Address performance** - Optimization techniques
4. **Stay framework-idiomatic** - Follow official conventions

---

## Validation Plugins

Validation plugins handle linting, formatting, type checking, and static analysis. They run automatically via Stop hooks.

### Structure

```
validation/biome/
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

### Example: biome

**`.claude-plugin/plugin.json`**:

```json
{
  "name": "biome",
  "version": "1.0.0",
  "description": "Biome linting and formatting with automatic validation hooks",
  "author": {
    "name": "Han Team",
    "url": "https://han.guru"
  },
  "license": "MIT",
  "keywords": ["biome", "linting", "formatting", "javascript", "typescript"]
}
```

**`han-plugin.yml`**:

```yaml
# Hook configuration for Biome
hooks:
  lint:
    command: "npx @biomejs/biome check --write ${HAN_FILES}"
    dirs_with:
      - "biome.json"
      - "biome.jsonc"
    if_changed:
      - "**/*.{js,jsx,ts,tsx,json}"
```

**`skills/getting-started/SKILL.md`**:

```markdown
---
name: getting-started
description: Use when setting up Biome in a new project - covers installation, configuration, and basic usage.
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

# Getting Started with Biome

## Installation

\`\`\`bash
npm install -D @biomejs/biome
\`\`\`

## Configuration

Create `biome.json` in your project root:

\`\`\`json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  }
}
\`\`\`

## Usage

\`\`\`bash
# Check files
npx biome check .

# Check and fix
npx biome check --write .
\`\`\`
```

### Key Considerations for Validation Plugins

1. **Hook commands should be idempotent** - Running them multiple times produces the same result
2. **Use `${HAN_FILES}` for file-targeted commands** - Enables session-scoped validation
3. **Specify `dirs_with`** - Only run hooks in directories containing the tool's config
4. **Specify `if_changed` patterns** - Skip hooks when no relevant files changed

---

## Tool Plugins

Tool plugins cover build systems, testing frameworks, package managers, and other development utilities.

### Structure

```
tools/playwright/
├── .claude-plugin/
│   └── plugin.json
├── han-plugin.yml       # Hook configuration (if applicable)
├── skills/
│   ├── getting-started/
│   │   └── SKILL.md
│   ├── selectors/
│   │   └── SKILL.md
│   └── assertions/
│       └── SKILL.md
├── README.md
└── CHANGELOG.md
```

### Example: playwright

**`.claude-plugin/plugin.json`**:

```json
{
  "name": "playwright",
  "version": "1.0.0",
  "description": "Playwright end-to-end testing expertise and validation hooks",
  "author": {
    "name": "Han Team",
    "url": "https://han.guru"
  },
  "license": "MIT",
  "keywords": ["playwright", "testing", "e2e", "automation"]
}
```

**`han-plugin.yml`**:

```yaml
hooks:
  test-e2e:
    command: "npx playwright test"
    timeout: 300
    dirs_with:
      - "playwright.config.ts"
      - "playwright.config.js"
    if_changed:
      - "**/*.spec.ts"
      - "**/*.test.ts"
      - "playwright.config.*"
```

### Key Considerations for Tool Plugins

1. **Set appropriate timeouts** - Tests and builds can be slow
2. **Include common patterns** - How the tool is typically used
3. **Address CI/CD integration** - How to run in automated pipelines
4. **Cover debugging** - How to troubleshoot issues

---

## Integration Plugins

Integration plugins connect Claude to external services via MCP (Model Context Protocol) servers. They define server configurations and optional memory providers.

### Structure

```
services/github/
├── .claude-plugin/
│   └── plugin.json
├── .mcp.json            # MCP server configuration
├── han-plugin.yml       # Memory provider config (optional)
├── README.md
└── CHANGELOG.md
```

### Example: github

**`.claude-plugin/plugin.json`**:

```json
{
  "name": "github",
  "version": "1.0.0",
  "description": "GitHub MCP integration for issues, PRs, and code search",
  "author": {
    "name": "Han Team",
    "url": "https://han.guru"
  },
  "license": "MIT",
  "keywords": ["github", "mcp", "issues", "pull-requests"]
}
```

**`.mcp.json`** (HTTP transport - preferred):

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp"
    }
  }
}
```

**`.mcp.json`** (stdio transport alternative):

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"]
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
    - mcp__github__search_issues
    - mcp__github__get_issue
    - mcp__github__list_pull_requests
  system_prompt: |
    Search GitHub for relevant information.
    Use search_issues for keyword queries.
    Use get_issue for specific issue details.
    Return findings with context and relevance.
```

### MCP Transport Types

| Transport | When to Use | Example |
|-----------|-------------|---------|
| **HTTP** | Service provides hosted MCP endpoint | GitHub, Linear, GitLab |
| **stdio** | Local MCP server via npm/uvx | Most community servers |
| **Docker** | Server requires specific runtime | Complex dependencies |

**Prefer HTTP transport when available** - it requires no local installation and starts instantly.

### Key Considerations for Integration Plugins

1. **Prefer HTTP transport** - Zero installation, instant startup
2. **Use npx/uvx for stdio** - Ensures users get the latest version
3. **Document required credentials** - API keys, OAuth setup, etc.
4. **Configure memory providers** - Enable semantic search over service data
5. **Avoid Docker unless necessary** - It adds installation complexity

---

## Discipline Plugins

Discipline plugins provide specialized AI agents for complex, multi-phase workflows. Each agent is defined in a markdown file with frontmatter.

### Structure

```
disciplines/frontend/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   ├── ui-developer.md
│   └── accessibility-auditor.md
├── README.md
└── CHANGELOG.md
```

### Example: frontend

**`.claude-plugin/plugin.json`**:

```json
{
  "name": "frontend",
  "version": "1.0.0",
  "description": "Frontend development agents specializing in UI/UX and accessibility",
  "author": {
    "name": "Han Team",
    "url": "https://han.guru"
  },
  "license": "MIT",
  "keywords": ["frontend", "ui", "ux", "accessibility", "agent"]
}
```

**`agents/ui-developer.md`**:

```markdown
---
name: ui-developer
description: |
  Use this agent for building user interfaces with attention to design,
  usability, and performance.

  Examples:
  <example>
  Context: User wants to build a new UI component.
  user: 'Create a responsive card component with hover effects'
  assistant: 'I'll use ui-developer to create a well-designed, accessible
  card component with appropriate animations.'
  <commentary>This requires UI expertise beyond basic coding.</commentary>
  </example>
model: inherit
color: blue
---

# UI Developer

You are a UI Developer specializing in building beautiful, usable interfaces.

## Core Responsibilities

1. **Component Design**: Create reusable, well-structured components
2. **Responsive Layout**: Ensure interfaces work across all devices
3. **Accessibility**: Follow WCAG guidelines for inclusive design
4. **Performance**: Optimize for fast, smooth interactions

## Design Approach

When building UI:

1. Start with semantic HTML structure
2. Add CSS for layout and styling
3. Enhance with JavaScript interactivity
4. Test across devices and assistive technologies
5. Optimize for performance

## Output Standards

- Components should be reusable and composable
- All interactive elements must be keyboard accessible
- Include appropriate ARIA attributes
- Document component API and usage
```

### Agent Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Agent identifier (kebab-case) |
| `description` | Yes | When to use this agent with examples |
| `model` | No | Model to use (`inherit` uses current model) |
| `color` | No | Display color in UI (blue, green, purple, teal, etc.) |

### Key Considerations for Discipline Plugins

1. **Provide clear usage examples** - Help Claude understand when to invoke the agent
2. **Define specific responsibilities** - Agents should have focused expertise
3. **Structure the output** - Define clear output formats for consistency
4. **Consider multi-phase workflows** - Agents can coordinate complex tasks

---

## Pattern Plugins

Pattern plugins encode development methodologies, design patterns, and workflow practices.

### Structure

```
patterns/tdd/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── red-green-refactor/
│   │   └── SKILL.md
│   └── test-doubles/
│       └── SKILL.md
├── README.md
└── CHANGELOG.md
```

### Example: tdd

**`.claude-plugin/plugin.json`**:

```json
{
  "name": "tdd",
  "version": "1.0.0",
  "description": "Test-Driven Development methodology with red-green-refactor patterns",
  "author": {
    "name": "Han Team",
    "url": "https://han.guru"
  },
  "license": "MIT",
  "keywords": ["tdd", "testing", "methodology", "red-green-refactor"]
}
```

**`skills/red-green-refactor/SKILL.md`**:

```markdown
---
name: red-green-refactor
description: Use when practicing TDD - covers the red-green-refactor cycle, test structure, and TDD best practices.
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

# Red-Green-Refactor

The core TDD cycle.

## The Cycle

1. **Red** - Write a failing test
2. **Green** - Write minimal code to pass
3. **Refactor** - Improve code while tests pass

## Example

### 1. Red (Write failing test)

\`\`\`typescript
describe('Calculator', () => {
  it('adds two numbers', () => {
    const calc = new Calculator();
    expect(calc.add(2, 3)).toBe(5);
  });
});
\`\`\`

### 2. Green (Make it pass)

\`\`\`typescript
class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}
\`\`\`

### 3. Refactor (Improve)

\`\`\`typescript
class Calculator {
  add(...numbers: number[]): number {
    return numbers.reduce((sum, n) => sum + n, 0);
  }
}
\`\`\`

## Best Practices

- Write the smallest test that fails
- Write the smallest code that passes
- Refactor with confidence (tests are your safety net)
- Run tests frequently
```

### Key Considerations for Pattern Plugins

1. **Document the methodology clearly** - Explain the why, not just the how
2. **Provide concrete examples** - Show the pattern in action
3. **Include anti-patterns** - What to avoid
4. **Address integration** - How the pattern works with other practices

---

## Specialized Plugins

Specialized plugins cover niche technologies, platform-specific tools, and domain-specific utilities.

### Structure

```
specialized/android/
├── .claude-plugin/
│   └── plugin.json
├── han-plugin.yml       # Platform-specific validation
├── skills/
│   ├── gradle/
│   │   └── SKILL.md
│   └── jetpack-compose/
│       └── SKILL.md
├── README.md
└── CHANGELOG.md
```

### Example: android

**`.claude-plugin/plugin.json`**:

```json
{
  "name": "android",
  "version": "1.0.0",
  "description": "Android development with Gradle validation and Jetpack Compose expertise",
  "author": {
    "name": "Han Team",
    "url": "https://han.guru"
  },
  "license": "MIT",
  "keywords": ["android", "gradle", "jetpack-compose", "kotlin"]
}
```

**`han-plugin.yml`**:

```yaml
hooks:
  build:
    command: "./gradlew build"
    timeout: 300
    dirs_with:
      - "build.gradle"
      - "build.gradle.kts"
    if_changed:
      - "**/*.kt"
      - "**/*.java"
      - "**/build.gradle*"
```

### Key Considerations for Specialized Plugins

1. **Target specific platforms** - iOS, Android, embedded, etc.
2. **Include platform tooling** - Build systems, simulators, etc.
3. **Address platform constraints** - Memory, battery, permissions
4. **Keep scope narrow** - Specialized means focused

---

## Choosing the Right Category

| Scenario | Category |
|----------|----------|
| Add language knowledge | Language |
| Add framework expertise | Framework |
| Add linting/formatting validation | Validation |
| Add build/test hooks | Tool |
| Connect to an external API | Integration |
| Create a specialized AI workflow | Discipline |
| Encode a development methodology | Pattern |
| Support a niche platform | Specialized |

## Next Steps

- [Hook Configuration](/docs/plugin-development/hooks) - Detailed hook reference
- [Skills and Commands](/docs/plugin-development/skills) - Creating skills and commands
- [Testing Plugins](/docs/plugin-development/testing) - Local testing workflow
