# Runbooks

Structured operational documentation and runbook patterns for human operators. This plugin helps create clear, actionable runbooks for troubleshooting, incident response, and maintenance tasks.

## Features

- **Runbook Structure** - Templates and organization patterns for operational documentation
- **Troubleshooting Guides** - Systematic debugging procedures and decision trees
- **Incident Response** - Incident management, severity levels, and on-call playbooks
- **Quality Enforcement** - Automated markdown linting for documentation consistency

## Installation

```bash
han plugin install runbooks
```

Or install via Claude Code:

```
/plugin install runbooks@han
```

## What This Plugin Provides

### Skills

- **runbook-structure** - Creating structured operational runbooks with comprehensive templates, directory organization, and best practices for emergency response, routine maintenance, and knowledge transfer
- **troubleshooting-guides** - Building effective troubleshooting procedures using the 5-step method (Observe, Hypothesize, Test, Fix, Verify) with decision trees and layered diagnostics
- **incident-response** - Handling production incidents with severity classifications (SEV-1 through SEV-4), communication protocols, post-mortems, and on-call procedures

### Validation Hooks

Automatically validates runbook documentation quality:

- **validate** - Runs `markdownlint-cli` on all runbook markdown files to ensure documentation consistency

## Use Cases

This plugin is ideal for:

- Creating operational runbooks for production systems
- Building troubleshooting guides for common issues
- Documenting incident response procedures
- Writing on-call playbooks and escalation guides
- Maintaining structured operational knowledge

## Runbook vs SOP

**Runbooks** (this plugin) are for **human operators**:

- Step-by-step procedures for troubleshooting
- Incident response protocols
- On-call guides with decision trees
- Maintenance checklists

**SOPs** (sop plugin) are for **AI agents**:

- Workflow definitions for agent execution
- Automated task sequences
- Agent behavior specifications

## Example Usage

Ask Claude to help create operational documentation:

```
Create a runbook for handling database connection failures in production
```

```
Write a troubleshooting guide for slow API responses with decision trees
```

```
Build an incident response template for our microservices architecture
```

## Directory Structure

This plugin encourages organizing runbooks in a structured directory:

```
runbooks/
├── README.md                 # Index of all runbooks
├── services/
│   ├── api-gateway/
│   │   ├── high-latency.md
│   │   └── connection-errors.md
│   └── database/
│       └── slow-queries.md
├── infrastructure/
│   └── kubernetes/
│       └── pod-restart.md
└── on-call/
    ├── first-responder.md
    └── escalation-guide.md
```

## Dependencies

- **bushido** - Core quality principles (automatically installed)

## Related Plugins

- **sop** - Standard operating procedures for AI agent workflows
- **markdown** - Markdown syntax and formatting skills
