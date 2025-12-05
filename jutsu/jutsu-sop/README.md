# Jutsu: SOP (Standard Operating Procedures)

Skills and commands for writing and maintaining Standard Operating Procedures (SOPs) for AI agents with RFC 2119 compliance and markdown-based workflows.

## What This Jutsu Provides

### Skills

This jutsu provides comprehensive skills for SOP authoring and maintenance:

- **sop-authoring**: Write clear, actionable SOPs with effective instruction design
- **sop-structure**: Organize SOPs with proper sections and markdown formatting
- **sop-rfc2119**: Use RFC 2119 keywords (MUST, SHOULD, MAY) for precise requirements
- **sop-maintenance**: Keep SOPs current through versioning and updates

### Commands

Slash commands for guided SOP creation and updates:

- **/create-sop**: Step-by-step guidance for creating new SOP files
- **/update-sop**: Instructions for updating existing SOPs with versioning

## Installation

Install via the Han marketplace:

```bash
npx @thebushidocollective/han plugin install jutsu-sop
```

Or install manually:

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install jutsu-sop@han
```

## Usage

### Creating a New SOP

Use the `/create-sop` command for guided SOP creation:

```
/create-sop
```

Claude will guide you through:

1. Determining the SOP purpose and type
2. Structuring sections properly
3. Adding RFC 2119 keywords appropriately
4. Creating success criteria and error handling
5. Saving to the correct location

### Updating an Existing SOP

Use the `/update-sop` command when SOPs need changes:

```
/update-sop
```

Claude will help you:

1. Read and analyze the current SOP
2. Determine appropriate version bump
3. Update changelog with changes
4. Modify affected sections
5. Ensure consistency across related SOPs

### Using Skills Directly

Skills are automatically available when this jutsu is installed:

**Example: Writing a deployment SOP**

```
User: Help me write an SOP for deploying to production

Claude: [Uses sop-authoring and sop-structure skills to create a well-structured
         SOP with proper RFC 2119 keywords, clear steps, and comprehensive error
         handling]
```

**Example: Reviewing SOP quality**

```
User: Review this SOP for clarity and RFC 2119 compliance

Claude: [Uses sop-rfc2119 skill to check keyword usage and sop-structure to
         verify section organization]
```

## SOP File Naming Convention

SOPs must use the `.sop.md` extension:

```
✅ deployment-production.sop.md
✅ code-review-security.sop.md
✅ database-migration.sop.md

❌ deployment.md (missing .sop)
❌ checklist.txt (wrong extension)
```

## SOP Directory Organization

Recommended directory structure:

```
~/sops/
├── development/
│   ├── code-review.sop.md
│   ├── tdd-implementation.sop.md
│   └── refactoring.sop.md
├── deployment/
│   ├── deploy-production.sop.md
│   ├── rollback.sop.md
│   └── database-migration.sop.md
├── operations/
│   ├── incident-response.sop.md
│   └── monitoring-setup.sop.md
└── templates/
    ├── analysis.template.sop.md
    └── implementation.template.sop.md
```

## Using SOPs with Agent SOP MCP Server

This jutsu pairs perfectly with **hashi-agent-sop** for executing SOPs:

### 1. Create SOPs with jutsu-sop

```
/create-sop
```

### 2. Configure Agent SOP to Load Your SOPs

**Method 1: Environment Variable (Recommended)**

```bash
# Add to ~/.zshrc or ~/.bashrc
export AGENT_SOP_PATHS="~/sops"
```

**Method 2: Claude Code Settings**

```json
{
  "mcpServers": {
    "agent-sops": {
      "command": "strands-agents-sops",
      "args": ["mcp"],
      "env": {
        "AGENT_SOP_PATHS": "~/sops:~/team-sops"
      }
    }
  }
}
```

**Method 3: Command Line**

```bash
strands-agents-sops mcp --sop-paths ~/sops:~/team-sops
```

### 3. Execute SOPs via MCP Server

Your custom SOPs are now available as MCP tools alongside built-in SOPs.

## RFC 2119 Keywords

This jutsu teaches proper use of RFC 2119 requirement keywords:

| Keyword | Meaning | When to Use |
|---------|---------|-------------|
| **MUST** | Absolute requirement | Security, data integrity, prerequisites |
| **MUST NOT** | Absolute prohibition | Security violations, data corruption |
| **SHOULD** | Strong recommendation | Best practices, optimizations |
| **SHOULD NOT** | Strong discouragement | Anti-patterns to avoid |
| **MAY** | Optional | Enhancements, preferences |

**Example:**

```markdown
## Steps

1. Pre-deployment checks
   - You MUST verify all tests pass
   - You MUST backup production database
   - You SHOULD review recent changes
   - You MAY notify team in Slack

2. Execute deployment
   - You MUST NOT skip health checks
   - You SHOULD deploy during low-traffic window
```

## SOP Versioning

SOPs should include version information:

```markdown
# Deploy Application to Production

**Version**: 2.1.0
**Last Updated**: 2025-12-05
**Status**: Active

## Changelog

### v2.1.0 (2025-12-05)
- Added automated rollback triggers
- Updated health check thresholds

### v2.0.0 (2025-11-15)
- BREAKING: Migrated to Kubernetes from Docker Swarm
- Added canary deployment steps

### v1.0.0 (2025-09-01)
- Initial deployment SOP
```

## Common SOP Patterns

### Analysis/Review SOP

```markdown
# Review Code Changes for Security

## Overview
Systematically review code changes for security vulnerabilities and best practices.

## Parameters
- **Pull Request URL**: {pr_url}
- **Review Depth**: {depth} (quick, standard, thorough)

## Steps
1. Analyze authentication and authorization
2. Review input validation
3. Check secret management
4. Assess error handling

## Success Criteria
- [ ] All critical security issues identified
- [ ] Recommendations are specific and actionable
```

### Implementation SOP

```markdown
# Implement Feature Using TDD

## Overview
Implement new feature following test-driven development with comprehensive coverage.

## Parameters
- **Feature Description**: {feature_description}
- **Test Framework**: {test_framework}

## Steps
1. Write failing test (RED)
2. Write minimal implementation (GREEN)
3. Refactor while keeping tests green (REFACTOR)
4. Repeat for each requirement

## Success Criteria
- [ ] All tests pass
- [ ] Coverage ≥ 80%
- [ ] Feature meets requirements
```

### Deployment SOP

```markdown
# Deploy Application to Production

## Overview
Safe deployment process with validation and rollback procedures.

## Parameters
- **Environment**: {environment}
- **Version**: {version}
- **Rollback Plan**: {rollback_plan}

## Steps
1. Pre-deployment verification
2. Build and push container
3. Apply database migrations
4. Deploy application
5. Post-deployment verification

## Success Criteria
- [ ] All health checks passing
- [ ] Error rate within normal range
- [ ] Key functionality verified
```

## Best Practices

### SOP Writing

- Use active voice and imperative mood
- Start steps with action verbs
- Be specific about expected outcomes
- Include validation after major steps
- Provide measurable success criteria
- Cover common error scenarios

### SOP Organization

- Keep SOPs focused (single responsibility)
- Use parameters for reusability
- Link related SOPs
- Maintain version history
- Regular review and updates

### RFC 2119 Usage

- MUST for absolute requirements
- SHOULD for best practices
- MAY for optional enhancements
- Be consistent across all SOPs

## Related Plugins

- **hashi-agent-sop**: Execute SOPs via MCP server
- **jutsu-blueprints**: Technical blueprint documentation
- **jutsu-tdd**: Test-Driven Development principles
- **bushido**: Core quality principles

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.

## Links

- [RFC 2119: Key words for use in RFCs to Indicate Requirement Levels](https://www.ietf.org/rfc/rfc2119.txt)
- [Agent SOP Repository](https://github.com/strands-agents/agent-sop)
- [Markdown Guide](https://www.markdownguide.org/)
