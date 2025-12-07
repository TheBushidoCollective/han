# han-core

Essential infrastructure for the Han plugin marketplace. This plugin provides the foundational capabilities that power the Han ecosystem, including delegation protocols, skill transparency, quality enforcement, MCP servers, and universal programming principles.

## What is han-core?

`han-core` is the infrastructure backbone of the Han plugin marketplace. It consolidates the essential components that all plugins depend on:

- **Delegation Protocols**: Smart subagent handling and task routing
- **Skill System**: Transparent skill selection and application
- **Quality Enforcement**: Pre-push validation and quality gates
- **MCP Servers**: Hook execution, metrics tracking, and documentation access
- **Universal Principles**: Programming best practices and patterns

This plugin was created by separating infrastructure from philosophy - it contains the operational tools and systems, while the `bushido` plugin focuses purely on the philosophical principles.

## What's Included

### MCP Servers

Two MCP servers provide advanced capabilities:

#### 1. Han (`han`)

Unified MCP server providing hooks execution and metrics tracking:

**Hook Commands:**

- Dynamically exposes tools for installed plugins
- Test commands (e.g., `mcp__plugin_hashi-han_han__jutsu_bun_test`)
- Lint commands (e.g., `mcp__plugin_hashi-han_han__jutsu_biome_lint`)
- Format, typecheck, and validation commands
- Smart caching and directory detection

**Metrics Tracking:**

- Task lifecycle tracking (start, update, complete, fail)
- Self-assessment and confidence calibration
- Objective validation against hook results
- Local storage in `~/.claude/metrics/metrics.db`

#### 2. Context7 (`context7`)

Access to up-to-date library documentation:

- Resolve library IDs from package names
- Fetch current documentation for any major library
- Code examples and API references
- Architectural guidance

### Lifecycle Hooks

#### SessionStart

Runs when a new session begins:

- **no-time-estimates.md**: Enforces no temporal planning language
- **metrics-tracking.md**: Instructs on task tracking for analytics

#### UserPromptSubmit

Runs on every user prompt:

- **ensure-subagent.md**: Delegation rules and subagent protocols
- **ensure-skill-use.md**: Skill selection transparency requirements

#### PreToolUse

Runs before git push operations:

- **pre-push-check.sh**: Validates code quality before pushing

#### Stop

Runs before session ends:

- **Task alignment review**: Ensures work matches original intent

### Skills

16 universal programming skills available:

- **architecture-design**: System design and technical decisions
- **baseline-restorer**: Reset to working state when fixes fail
- **boy-scout-rule**: Leave code better than you found it
- **code-reviewer**: Thorough code review and feedback
- **debugging**: Systematic bug investigation
- **documentation**: Clear technical documentation
- **explainer**: Explain code and concepts effectively
- **orthogonality-principle**: Independent, non-overlapping components
- **performance-optimization**: Measurement-driven optimization
- **professional-honesty**: Direct, honest communication
- **proof-of-work**: Evidence-based claims and verification
- **refactoring**: Safe code restructuring
- **simplicity-principles**: KISS, YAGNI, Principle of Least Astonishment
- **solid-principles**: SOLID design principles
- **structural-design-principles**: Composition, Law of Demeter, Encapsulation
- **technical-planning**: Implementation planning and task breakdown

### Commands

12 workflow commands available:

- **/han-core:architect**: Design system architecture
- **/han-core:code-review**: Review pull requests
- **/han-core:debug**: Investigate issues
- **/han-core:develop**: Full 7-phase development workflow
- **/han-core:document**: Generate/update documentation
- **/han-core:explain**: Explain code and concepts
- **/han-core:fix**: Debug and fix bugs
- **/han-core:optimize**: Performance optimization
- **/han-core:plan**: Create implementation plans
- **/han-core:refactor**: Restructure code safely
- **/han-core:review**: Multi-agent code review
- **/han-core:test**: Write tests with TDD

## Installation

Install the plugin using Claude Code:

```bash
# Via Claude Code plugin system
claude plugin install han-core@han

# Or via the han CLI
npx @thebushidocollective/han plugin install han-core
```

## Difference from bushido Plugin

The han-core and bushido plugins serve complementary purposes:

### han-core (Infrastructure)

- MCP server configurations
- Lifecycle hooks for quality and tracking
- Skill and command implementations
- Delegation and transparency protocols
- Operational tooling

### bushido (Philosophy)

- quality principles and values
- Code of conduct for development
- Philosophical guidelines
- Cultural context and meaning
- Development philosophy agent

**Recommendation**: Install both plugins. Use `bushido` for philosophical guidance and `han-core` for infrastructure capabilities.

## Usage Examples

### Using Skills

Skills are automatically available and can be invoked via the Skill tool:

```typescript
// Architecture design guidance
Skill({ skill: "han-core:architecture-design" })

// Code review checklist
Skill({ skill: "han-core:code-reviewer" })

// Refactoring best practices
Skill({ skill: "han-core:refactoring" })
```

### Using Commands

Commands provide comprehensive workflows:

```bash
# Full development workflow
/han-core:develop

# Create implementation plan
/han-core:plan

# Perform code review
/han-core:code-review
```

### Using MCP Tools

MCP tools are available directly in your environment:

```typescript
// Start tracking a task
await mcp__plugin_hashi_han_metrics__start_task({
  description: "Implement user authentication",
  type: "implementation",
  estimated_complexity: "moderate"
});

// Run project tests
await mcp__plugin_hashi_han_han__jutsu_bun_test({
  directory: "packages/core"
});

// Fetch library documentation
await mcp__plugin_bushido_context7__get_library_docs({
  context7CompatibleLibraryID: "/vercel/next.js",
  topic: "routing"
});
```

## Hook Behavior

### Quality Gates

The pre-push check validates:

- All tests passing
- Linting clean
- Type checking successful
- Build succeeds

If any check fails, the push is blocked until issues are resolved.

### Metrics Tracking

Tasks are tracked for performance analytics:

1. Start task with description and complexity estimate
2. Update progress during work (optional)
3. Complete with outcome assessment and confidence level
4. System validates self-assessment against objective results

This creates a feedback loop for continuous improvement.

### Delegation Protocol

When delegating to subagents:

1. Use SlashCommand tool for slash commands
2. Use Skill tool for skill invocation
3. Provide context and clear objectives
4. No silent delegation - always make delegation explicit

### Skill Transparency

When using skills:

1. Explain which skill was selected
2. Describe why it's appropriate for the task
3. Show how the skill will be applied
4. Make skill usage visible to users

## Configuration

### Customizing MCP Servers

The `.mcp.json` file defines both MCP servers. You can customize their behavior by modifying environment variables:

```json
{
  "mcpServers": {
    "han": {
      "command": "npx",
      "args": ["-y", "@thebushidocollective/han", "mcp"],
      "env": {}
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    }
  }
}
```

### Disabling Hooks

To disable specific hooks, edit `hooks/hooks.json` and remove or comment out the hook configuration.

## Privacy and Data

- **Metrics**: Stored locally in `~/.claude/metrics/metrics.db`
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
- **Discord**: [The The Bushido Collective](https://discord.gg/bushido)

## Related Plugins

- **bushido**: Philosophical principles and development philosophy
- **jutsu-\***: Technology-specific plugins (TypeScript, React, Bun, etc.)
- **do-\***: Discipline-specific agents (TDD, code review, etc.)
- **hashi-\***: Bridge plugins for external integrations (GitHub, GitLab, etc.)

Install complementary plugins to enhance your development workflow.
