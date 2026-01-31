# Claude Plugin Development

Specialized agents for developing, testing, and maintaining Claude Code plugins
with quality enforcement hooks.

## Overview

This plugin provides tools and best practices for creating high-quality Claude
Code plugins. It includes comprehensive guidance on plugin architecture,
agent/skill/hook development, validation workflows, and marketplace integration.

## Agents

### plugin-developer

The `plugin-developer` agent specializes in developing, maintaining, and
improving Claude Code plugins.

**Use when:**

- Creating new Claude Code plugins
- Adding features to existing plugins
- Fixing plugin issues or bugs
- Improving plugin documentation
- Validating plugin structure and quality
- Integrating plugins with the marketplace

**Capabilities:**

- Plugin architecture and structure guidance
- Agent, skill, and hook development
- Frontmatter validation and best practices
- Quality enforcement (claudelint, markdownlint)
- Testing and validation workflows
- Marketplace integration support
- Documentation standards

## Quality Enforcement Hooks

This plugin includes automatic quality enforcement hooks that run before completion:

### ensure-plugin-quality

Runs before main agent completion to ensure:

- claudelint validation passes (0 errors, 0 warnings)
- markdownlint validation passes with auto-fix
- All quality checks are satisfied before work is marked complete

### ensure-subagent-plugin-quality

Runs before subagent completion with the same quality checks as the main hook.

**CRITICAL**: These hooks will prevent completion if validation fails. All
errors must be fixed before work can be marked as done.

## Usage

### Creating a New Plugin

```bash
# Use the plugin-developer agent
@plugin-developer Create a new plugin called "my-plugin"
```

The agent will guide you through:

1. Setting up the directory structure
2. Creating plugin.json with proper metadata
3. Developing agents, skills, or hooks
4. Writing comprehensive documentation
5. Running validation checks
6. Registering in the marketplace

### Improving Existing Plugins

```bash
# Use the agent to enhance a plugin
@plugin-developer Add a new agent to the "my-plugin" plugin for feature X
```

### Validating Plugin Quality

```bash
# Run quality checks manually
@plugin-developer Validate the plugin structure and run all linters
```

## Quality Standards

All plugins developed with this agent must meet these standards:

### Claudelint Validation

- Valid YAML frontmatter in all agents/skills
- All required frontmatter fields present
- Proper JSON syntax in configuration files
- Hook configurations match implementation files

### Markdownlint Validation

- All markdown files follow linting rules
- Consistent formatting and structure
- Proper heading hierarchy
- No trailing whitespace or broken links

### Documentation Standards

- Comprehensive README.md
- Clear agent descriptions with use cases
- Examples and usage guidance
- Proper version management

## Plugin Structure

A well-structured plugin created with this agent includes:

```text
plugin-name/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── agents/                  # Specialized agents
│   └── agent-name.md
├── skills/                  # Reusable skills (optional)
│   └── skill-name.md
├── hooks/                   # Lifecycle hooks (optional)
│   ├── hooks.json
│   └── hook-name.md
└── README.md               # Documentation
```

## Best Practices

The plugin-developer agent enforces these best practices:

- **Single Responsibility**: Each agent/skill does one thing well
- **Clear Documentation**: Every component is well-documented
- **Quality Validation**: All code passes linting checks
- **Consistent Naming**: Kebab-case for all identifiers
- **Proper Frontmatter**: Valid YAML with all required fields
- **Comprehensive Testing**: Manual testing before release
- **Semantic Versioning**: Proper version management

## Examples

### Creating a Plugin for TDD

```bash
@plugin-developer Create a plugin for Test-Driven Development with an \
agent that guides TDD workflow
```

### Adding Quality Hooks

```bash
@plugin-developer Add quality enforcement hooks to ensure tests pass before completion
```

### Documenting an Existing Plugin

```bash
@plugin-developer Improve the README and documentation for the "my-plugin" plugin
```

## Development Workflow

1. **Plan**: Define plugin scope, agents, and features
2. **Create**: Set up structure and write components
3. **Document**: Write comprehensive README and descriptions
4. **Validate**: Run claudelint and markdownlint
5. **Test**: Manually verify all functionality
6. **Register**: Add to marketplace.json
7. **Iterate**: Improve based on usage and feedback

## Resources

- Claude Code documentation
- [claudelint](https://github.com/stbenjam/claudelint) - Plugin structure validation
- [markdownlint](https://github.com/DavidAnson/markdownlint) - Markdown linting
- YAML specification for frontmatter
- Semantic versioning guidelines
