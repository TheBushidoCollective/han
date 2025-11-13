# Do (道) - Disciplines

This directory contains all **do** plugins - specialized agents for
different software engineering disciplines and job roles.

## What is Do?

In the Bushido tradition, **do** (道) means "way" or "path" - the
disciplined practice and mastery of a craft. In software development,
do plugins provide expert agents for specific engineering disciplines.

## Available Disciplines

### Core Development

- **Frontend Development** - UI design and presentation engineering
- **Backend Development** - API design and system architecture
- **Mobile Development** - iOS, Android, and cross-platform apps
- **Game Development** - Game engine and gameplay engineering

### Infrastructure & Operations

- **Infrastructure** - DevOps and operational excellence
- **Platform Engineering** - Developer platforms and tooling
- **Database Engineering** - Schema design and query optimization
- **Network Engineering** - Protocols and distributed systems
- **Embedded Development** - RTOS, firmware, and IoT

### Specialized Engineering

- **API Engineering** - API design, contracts, and gateways
- **Graphics Engineering** - GPU programming and rendering
- **Compiler Development** - Language design and code generation
- **Blockchain Development** - Smart contracts and Web3
- **Machine Learning Engineering** - MLOps and model deployment

### Quality & Observability

- **Quality Assurance** - Testing strategies and architecture
- **Performance Engineering** - Profiling and optimization
- **Security Engineering** - Threat mitigation and compliance
- **Observability Engineering** - Monitoring, tracing, and logging
- **Accessibility Engineering** - WCAG and inclusive design

### Data & Analytics

- **Data Engineering** - ETL pipelines and data warehousing

### Management & Documentation

- **Architecture** - System design and patterns
- **Project Management** - Workflow and team coordination
- **Product Management** - Product vision and strategy
- **Technical Documentation** - Knowledge management
- **Prompt Engineering** - AI interaction optimization

### Development Process

- **Claude Plugin Development** - Plugin creation with quality hooks
- **Enforce Planning** - Planning enforcement before implementation

## How to Use Do

Each do plugin contains one or more **agents** that provide specialized
expertise. Agents are invoked when you need discipline-specific guidance.

Example usage:

```bash
# Invoke architecture agent
/agent do-architecture:system-architect

# Get frontend development help
/agent do-frontend-development:presentation-engineer

# Security engineering guidance
/agent do-security-engineering:security-engineer
```

## Plugin Structure

Each do plugin follows this structure:

```text
do-{discipline}/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── agents/
│   └── {agent-name}.md      # Agent implementation with frontmatter
├── hooks/                   # Optional enforcement hooks
│   ├── hooks.json
│   └── {hook-name}.md
└── README.md                # Plugin documentation
```

## Quality Enforcement

Many do plugins include **hooks** that enforce quality standards:

- **Stop hooks** - Run when main agent completes work
- **SubagentStop hooks** - Run when subagent completes work
- **Quality gates** - Prevent completion if standards not met

Example enforcement:

- Testing frameworks ensure all tests pass
- Linting frameworks ensure code quality
- Plugin development ensures claudelint/markdownlint pass

## Agent Frontmatter

All agent files include YAML frontmatter:

```yaml
---
name: agent-name
description: |
  What this agent does and when to use it.
model: inherit
color: blue
---
```

## License

MIT License - see individual plugin directories for details.
