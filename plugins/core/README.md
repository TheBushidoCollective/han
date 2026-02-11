# Core

**Required infrastructure plugin for the Han marketplace.**

This plugin provides the foundational capabilities that power the Han ecosystem, including automatic binary installation, delegation protocols, skill transparency, quality enforcement, MCP servers, and universal programming principles.

> **Important:** The `core` plugin is required for all Han installations. It's automatically included when using `han plugin install --auto`.

## What is Core?

`core` is the infrastructure backbone of the Han plugin marketplace. It consolidates the essential components that all plugins depend on:

- **Delegation Protocols**: Smart subagent handling and task routing
- **Skill System**: Transparent skill selection and application
- **Quality Enforcement**: Pre-push validation and quality gates
- **MCP Server**: Unified hooks execution and documentation access (Context7, DeepWiki)
- **Universal Principles**: Programming best practices and patterns

This plugin was created by separating infrastructure from philosophy - it contains the operational tools and systems, while the `bushido` plugin focuses purely on the philosophical principles.

## Automatic Installation

The core plugin includes a SessionStart hook that automatically downloads and installs the latest han binary to `~/.claude/bin/han`. This ensures:

- Hooks work immediately without manual setup
- Binary is always up-to-date
- Fastest execution (no npx overhead)
- Works within Claude Code's PATH

Users can also install manually via:

```bash
# Quick install
curl -fsSL https://han.guru/install.sh | bash

# Or via Homebrew
brew install thebushidocollective/tap/han
```

## What's Included

### MCP Server

The unified Han MCP server (`han`) provides:

- Dynamically exposed tools for installed plugins
- Format, typecheck, and validation commands
- Smart caching and directory detection
- Context7 documentation access (resolve library IDs, fetch docs, code examples)
- DeepWiki repository documentation (wiki structure, contents, Q&A)
- Blueprint management (read, write, search project blueprints)
- Memory system (query project and team knowledge)

### Task Tracking

Tasks are tracked via Claude Code's native tools:

- **TaskCreate**: Start tracking a new task with description
- **TaskUpdate**: Update task status (pending, in_progress, completed)
- **TaskList** / **TaskGet**: View task history

All task data is stored locally in `~/.han/han.db` and displayed in the Browse UI.

### Lifecycle Hooks

#### SessionStart

Runs when a new session begins:

- **ensure-han.sh**: Ensures the han binary is installed
- **coordinator ensure**: Starts the coordinator daemon in the background
- **plugin migrate**: Runs any pending plugin migrations
- **register-config-dir.sh**: Registers the project config directory
- **hook context**: Outputs session context information
- **session-references.sh**: Loads relevant session references

#### UserPromptSubmit

Runs on every user prompt:

- **current-datetime.sh**: Provides current date and time
- **no-excuses.md**: References rules about pre-existing issues

#### PreToolUse

Runs before Task and Skill tool invocations:

- **inject-subagent-context**: Injects context for subagents and skills

### Skills

30 skills are available, covering both universal programming principles and workflow commands. All skills can be invoked as slash commands (e.g., `/core:develop`) or via the Skill tool.

#### Workflow Skills

- **architect**: Design system architecture
- **code-review**: Review pull requests
- **debug**: Investigate issues
- **develop**: Full 7-phase development workflow
- **document**: Generate/update documentation
- **explain**: Explain code and concepts
- **fix**: Debug and fix bugs
- **optimize**: Performance optimization
- **plan**: Create implementation plans
- **refactor**: Restructure code safely
- **review**: Multi-agent code review
- **test**: Write tests with TDD
- **project-memory**: Project memory learning and recall

#### Programming Principle Skills

- **architecture-design**: System design and technical decisions
- **baseline-restorer**: Reset to working state when fixes fail
- **boy-scout-rule**: Leave code better than you found it
- **code-reviewer**: Thorough code review and feedback
- **debugging**: Systematic bug investigation
- **documentation**: Clear technical documentation
- **explainer**: Explain code and concepts effectively
- **legacy-code-safety**: Safe approaches to modifying legacy code
- **orthogonality-principle**: Independent, non-overlapping components
- **performance-optimization**: Measurement-driven optimization
- **professional-honesty**: Direct, honest communication
- **proof-of-work**: Evidence-based claims and verification
- **refactoring**: Safe code restructuring
- **simplicity-principles**: KISS, YAGNI, Principle of Least Astonishment
- **solid-principles**: SOLID design principles
- **structural-design-principles**: Composition, Law of Demeter, Encapsulation
- **technical-planning**: Implementation planning and task breakdown

## Installation

Install the plugin using Claude Code:

```bash
# Via Claude Code plugin system
claude plugin install core@han

# Or via the han CLI
han plugin install core
```

## Difference from bushido Plugin

The core and bushido plugins serve complementary purposes:

### core (Infrastructure)

- MCP server configuration
- Lifecycle hooks for quality and tracking
- Skill implementations (workflow + principles)
- Delegation and transparency protocols
- Operational tooling

### bushido (Philosophy)

- Quality principles and values
- Code of conduct for development
- Philosophical guidelines
- Cultural context and meaning
- Development philosophy agent

**Recommendation**: Install both plugins. Use `bushido` for philosophical guidance and `core` for infrastructure capabilities.

## Usage Examples

### Using Skills as Slash Commands

Skills can be invoked directly as slash commands:

```bash
# Full development workflow
/core:develop

# Create implementation plan
/core:plan

# Perform code review
/core:code-review

# Design system architecture
/core:architect

# Explain code and concepts
/core:explain
```

### Using Skills via the Skill Tool

Skills can also be invoked programmatically via the Skill tool:

```typescript
// Architecture design guidance
Skill({ skill: "core:architecture-design" })

// Code review checklist
Skill({ skill: "core:code-reviewer" })

// Refactoring best practices
Skill({ skill: "core:refactoring" })
```

### Using MCP Tools

MCP tools are available directly in your environment:

```typescript
// Resolve a library ID for documentation lookup
mcp__plugin_core_context7__resolve_library_id({
  libraryName: "next.js",
  query: "How to set up routing in Next.js"
})

// Fetch library documentation
mcp__plugin_core_context7__query_docs({
  libraryId: "/vercel/next.js",
  query: "app router file-based routing"
})

// Query project memory
mcp__plugin_core_han__memory({
  question: "How do we handle authentication?"
})
```

### Task Tracking

Tasks are tracked using Claude Code's native task tools:

```typescript
// Create a task
TaskCreate({
  subject: "Implement user authentication",
  description: "Add JWT-based auth flow",
  activeForm: "Implementing user authentication"
})

// Update task status
TaskUpdate({
  taskId: "1",
  status: "completed"
})
```

## Hook Behavior

### Quality Gates

The pre-push check validates:

- All tests passing
- Linting clean
- Type checking successful
- Build succeeds

If any check fails, the push is blocked until issues are resolved.

### Delegation Protocol

When delegating to subagents:

1. Use the Skill tool for skill invocation (e.g., `Skill({ skill: "core:develop" })`)
2. Skills are also invocable as slash commands (e.g., `/core:develop`)
3. Provide context and clear objectives
4. No silent delegation - always make delegation explicit

### Skill Transparency

When using skills:

1. Explain which skill was selected
2. Describe why it's appropriate for the task
3. Show how the skill will be applied
4. Make skill usage visible to users

## Configuration

### Customizing MCP Server

The `mcpServers` field in `.claude-plugin/plugin.json` defines the MCP server. You can customize its behavior by modifying environment variables:

```json
{
  "mcpServers": {
    "han": {
      "command": "npx",
      "args": ["-y", "@thebushidocollective/han", "mcp"],
      "env": {
        "CUSTOM_VAR": "value"
      }
    }
  }
}
```

### Disabling Hooks

To disable specific hooks, edit `hooks/hooks.json` and remove or comment out the hook configuration.

## Privacy and Data

- **Tasks**: Stored locally in `~/.han/han.db`
- **No external tracking**: All data stays on your machine
- **Context7**: Fetches public documentation, no personal data sent
- **Han hooks**: Executes locally, no external communication

## Contributing

This plugin is part of the Han marketplace. To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run quality checks (lint, test, typecheck)
5. Submit a pull request

See the [Han contribution guidelines](https://github.com/thebushidocollective/han) for details.

## License

MIT License - see LICENSE file for details.

## Support

- **Documentation**: [Han Marketplace](https://github.com/thebushidocollective/han)
- **Issues**: [GitHub Issues](https://github.com/thebushidocollective/han/issues)
- **Discord**: [The Bushido Collective](https://discord.gg/bushido)

Install complementary plugins to enhance your development workflow.
