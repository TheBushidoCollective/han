# Hashi: Agent SOP

MCP server configuration for Agent SOP integration providing Standard Operating Procedures (SOPs) for AI agents with markdown-based workflow definitions, RFC 2119 compliance, and comprehensive SOP authoring capabilities.

## What This Hashi Provides

### MCP Server: agent-sops

Agent SOP transforms single-use prompts into reusable workflow templates. Rather than embedding all instructions upfront, SOPs enable progressive context disclosure—AI assistants load only relevant workflows based on specific tasks. This approach optimizes context efficiency while providing specialized procedures for complex, multi-step workflows.

This hashi connects Claude Code to the Agent SOP system and provides:

- **Reusable Workflow Templates**: Standard Operating Procedures defined in markdown format
- **RFC 2119 Constraint Keywords**: Use MUST, SHOULD, MAY for precise agent guidance
- **Parameterized Inputs**: Reuse SOPs across different contexts
- **Multi-step Workflows**: Complex development patterns like TDD, code analysis, and feature implementation
- **Custom SOP Loading**: Add your own SOPs for team-specific workflows

### SOP Authoring Skills

Comprehensive skills for writing and maintaining high-quality SOPs:

- **sop-authoring**: Write clear, actionable SOPs with effective instruction design
- **sop-structure**: Organize SOPs with proper sections and markdown formatting
- **sop-rfc2119**: Use RFC 2119 keywords (MUST, SHOULD, MAY) for precise requirements
- **sop-maintenance**: Keep SOPs current through versioning and updates

### SOP Commands

Slash commands for guided SOP creation and maintenance:

- **/create-sop**: Step-by-step guidance for creating new SOP files
- **/update-sop**: Instructions for updating existing SOPs with versioning

### Available Tools

Once installed, Claude Code gains access to these SOP-based workflows through MCP tools:

- `codebase-summary`: Analyzes codebases and generates comprehensive documentation
- `code-assist`: Implements features using test-driven development workflows
- `pdd`: Prompt-driven development for complex problem-solving
- `code-task-generator`: Breaks requirements into actionable tasks
- `eval`: Automated evaluation workflows for AI agents

## Installation

### Prerequisites

Install the Agent SOP package:

**Via Homebrew:**

```bash
brew install strands-agents-sops
```

**Via pip:**

```bash
pip install strands-agents-sops
```

### Via Han Marketplace

```bash
npx @thebushidocollective/han plugin install hashi-agent-sop
```

Or install manually:

```bash
claude plugin marketplace add thebushidocollective/han
claude plugin install hashi-agent-sop@han
```

### Configuration

The plugin works out of the box with built-in SOPs. To add custom SOPs:

#### Method 1: Environment Variable (Recommended)

Set the `AGENT_SOP_PATHS` environment variable with colon-separated directory paths:

```bash
# In ~/.zshrc or ~/.bashrc
export AGENT_SOP_PATHS="~/my-sops:~/team-sops"
```

The plugin is pre-configured to use this variable automatically. If not set, it defaults to the plugin's built-in SOPs.

#### Method 2: Override Configuration

To override the default behavior, update your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "agent-sops": {
      "args": ["mcp", "--sop-paths", "~/my-sops:~/team-sops"]
    }
  }
}
```

**Custom SOP Configuration:**

- Supports colon-separated directory paths
- Use `~` for home directory expansion
- Files must have `.sop.md` extension
- Custom SOPs override built-in ones with matching names

### Manual Installation

If not using Han, add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "agent-sops": {
      "command": "strands-agents-sops",
      "args": ["mcp"]
    }
  }
}
```

## Usage

### Example 1: Generate Codebase Documentation

Use the `codebase-summary` SOP to analyze and document a codebase:

```
User: Analyze this codebase and generate documentation
Claude: [uses codebase-summary tool to analyze the repository structure, key files, and generate comprehensive documentation]
```

### Example 2: Implement Feature with TDD

Use the `code-assist` SOP for test-driven development:

```
User: Implement user authentication using TDD
Claude: [uses code-assist tool to follow TDD workflow - write failing tests, implement code, refactor]
```

### Example 3: Break Down Requirements

Use the `code-task-generator` SOP to decompose complex requirements:

```
User: Break down this feature into actionable tasks
Claude: [uses code-task-generator tool to analyze requirements and create task breakdown]
```

### Example 4: Prompt-Driven Development

Use the `pdd` SOP for complex problem-solving:

```
User: Design a scalable architecture for real-time notifications
Claude: [uses pdd tool to guide through systematic problem analysis and solution design]
```

### Example 5: Evaluate Agent Performance

Use the `eval` SOP for automated evaluation:

```
User: Evaluate the implementation against these criteria
Claude: [uses eval tool to run evaluation workflow and provide structured feedback]
```

## Tool Reference

### `codebase-summary`

**Purpose**: Analyzes codebases and generates comprehensive documentation including structure, patterns, and key components.

**Use Cases**:

- Onboarding new team members
- Generating project documentation
- Understanding legacy codebases
- Creating architectural overviews

### `code-assist`

**Purpose**: Implements features using test-driven development workflows with Red-Green-Refactor cycle.

**Use Cases**:

- Feature implementation with TDD
- Bug fixes with test coverage
- Refactoring with safety nets
- Code quality improvement

### `pdd`

**Purpose**: Prompt-driven development for complex problem-solving with systematic analysis.

**Use Cases**:

- Architectural design decisions
- Complex algorithm development
- System integration planning
- Technical spike exploration

### `code-task-generator`

**Purpose**: Breaks down requirements into actionable, prioritized tasks.

**Use Cases**:

- Sprint planning
- Feature decomposition
- Story breakdown
- Work estimation

### `eval`

**Purpose**: Automated evaluation workflows for AI agents and implementations.

**Use Cases**:

- Code review automation
- Quality assessment
- Implementation validation
- Performance evaluation

## Creating and Authoring SOPs

### Using the /create-sop Command

For guided SOP creation, use the `/create-sop` command:

```
/create-sop
```

Claude will guide you through:

1. Determining the SOP purpose and type
2. Structuring sections properly
3. Adding RFC 2119 keywords appropriately
4. Creating success criteria and error handling
5. Saving to the correct location

### Using the /update-sop Command

When SOPs need changes, use the `/update-sop` command:

```
/update-sop
```

Claude will help you:

1. Read and analyze the current SOP
2. Determine appropriate version bump
3. Update changelog with changes
4. Modify affected sections
5. Ensure consistency across related SOPs

### Using SOP Authoring Skills

The SOP authoring skills are automatically available when this plugin is installed:

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

### SOP File Naming Convention

SOPs must use the `.sop.md` extension:

```
✅ deployment-production.sop.md
✅ code-review-security.sop.md
✅ database-migration.sop.md

❌ deployment.md (missing .sop)
❌ checklist.txt (wrong extension)
```

### RFC 2119 Keywords

This plugin teaches proper use of RFC 2119 requirement keywords:

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

## Creating Custom SOPs

You can create your own SOPs for team-specific workflows:

1. Create a directory for your SOPs:

```bash
mkdir -p ~/my-sops
```

1. Create an SOP file with `.sop.md` extension:

```bash
touch ~/my-sops/deployment-checklist.sop.md
```

1. Define your SOP using markdown with RFC 2119 keywords:

```markdown
# Deployment Checklist SOP

## Overview
This SOP ensures safe deployments to production.

## Steps

1. You MUST run all tests before deployment
2. You SHOULD verify staging environment matches production
3. You MUST check rollback procedures are in place
4. You MAY notify the team in Slack
5. You MUST monitor logs for 15 minutes post-deployment

## Parameters
- Environment: {environment}
- Version: {version}
```

1. Configure the MCP server to load your custom SOPs:

```json
{
  "mcpServers": {
    "agent-sops": {
      "command": "strands-agents-sops",
      "args": ["mcp", "--sop-paths", "~/my-sops"]
    }
  }
}
```

## Security Considerations

- Custom SOPs are loaded from local filesystem paths you specify
- SOPs are executed in the context of Claude Code's permissions
- Review custom SOPs before adding them to ensure they follow security best practices
- SOPs that interact with external services should include appropriate authentication
- Be cautious with SOPs that perform destructive operations

## Limitations

- SOPs are markdown-based templates and require AI interpretation
- Complex workflows may need multiple SOP invocations
- Custom SOPs must follow the `.sop.md` naming convention
- SOP parameters are passed through Claude's context window

## Troubleshooting

### Issue: MCP server fails to start

**Solution**: Ensure `strands-agents-sops` is installed:

```bash
# Check installation
which strands-agents-sops

# Reinstall if needed
brew reinstall strands-agents-sops
# or
pip install --upgrade strands-agents-sops
```

### Issue: Custom SOPs not loading

**Solution**: Verify the path configuration and file naming:

1. Check that paths use absolute paths or `~` for home directory
2. Ensure SOP files have `.sop.md` extension
3. Verify directory permissions allow reading
4. Check Claude Code logs for path errors

### Issue: SOP tools not appearing

**Solution**: Restart Claude Code after plugin installation:

```bash
# Exit Claude Code and restart
# Or reload configuration if using the extension
```

### Issue: SOP execution errors

**Solution**: Review the SOP structure:

1. Ensure valid markdown syntax
2. Check RFC 2119 keywords are properly used
3. Verify parameter placeholders match invocation
4. Test SOP in isolation before integration

## Related Plugins

- **bushido**: Core quality principles and enforcement
- **jutsu-tdd**: Test-Driven Development principles
- **jutsu-blueprints**: Technical blueprint documentation
- **jutsu-markdown**: Markdown documentation and linting
- **do-backend-development**: Backend engineering agents
- **do-frontend-development**: Frontend engineering agents

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.

## Links

- [Agent SOP Repository](https://github.com/strands-agents/agent-sop)
- [Agent SOP Documentation](https://github.com/strands-agents/agent-sop#readme)
- [MCP Protocol Specification](https://modelcontextprotocol.io)
- [Strands Agents](https://github.com/strands-agents)
