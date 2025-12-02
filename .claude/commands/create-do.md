---
description: Create a new do (discipline) plugin with specialized agents
---

# Create a Dō (道 - The Way) Plugin

Create a new dō plugin for: $ARGUMENTS

## What is a Dō?

Dōs represent "the way" or path of mastery in the Han marketplace. They provide specialized agents that embody expertise in specific development disciplines (frontend, backend, security, performance, etc.). Each dō contains one or more agents with deep domain knowledge.

## Plugin Structure

Create the following directory structure:

```
do/do-{discipline-name}/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata (ONLY plugin.json goes here)
├── agents/
│   └── {agent-name}.md     # Agent definition
├── han-config.json          # Han hook configurations (optional, at plugin root)
├── hooks/
│   └── hooks.json           # Claude Code hooks (optional)
├── skills/
│   └── {skill-name}/
│       └── SKILL.md        # Skill documentation (optional)
└── README.md               # Plugin documentation
```

**IMPORTANT**:
- Only `plugin.json` goes inside `.claude-plugin/`
- `hooks.json` goes in the `hooks/` directory
- `han-config.json` stays at the plugin root (NOT in hooks/)

## Step 1: Create plugin.json

Create `.claude-plugin/plugin.json`:

```json
{
  "name": "do-{discipline-name}",
  "version": "1.0.0",
  "description": "Specialized agents for {discipline area} including {key responsibilities}.",
  "author": {
    "name": "The Bushido Collective",
    "url": "https://thebushido.co"
  },
  "homepage": "https://github.com/thebushidocollective/han",
  "repository": "https://github.com/thebushidocollective/han",
  "license": "MIT",
  "keywords": [
    "{discipline}",
    "{specialty}",
    "agent",
    "{related-area}",
    "{technology}"
  ]
}
```

## Step 2: Create Agent Definitions

For each specialized role in your discipline, create an agent markdown file.

### Agent File: `agents/{agent-name}.md`

```markdown
---
name: {agent-name}
description: |
  {One-paragraph description of the agent's expertise, focus areas, and when to invoke them. Be specific about their domain and capabilities.}
model: inherit
color: {purple|blue|green|red|yellow|cyan|magenta}
---

# {Agent Title}

{Compelling tagline describing the agent's mastery}

## Role

{Detailed description of the agent's role, expertise level, and primary responsibilities. Set the context for what makes this agent uniquely qualified.}

## Core Responsibilities

### {Responsibility Area 1}

{Detailed explanation of this responsibility}

- {Specific capability}
- {Specific capability}
- {Specific capability}

### {Responsibility Area 2}

{Detailed explanation of this responsibility}

- {Specific capability}
- {Specific capability}
- {Specific capability}

### {Responsibility Area 3}

{Detailed explanation of this responsibility}

- {Specific capability}
- {Specific capability}
- {Specific capability}

## Approach

### {Methodology Name}

{Explain the agent's methodology and decision-making process}

1. **{Step 1}**: {What the agent does}
2. **{Step 2}**: {What the agent does}
3. **{Step 3}**: {What the agent does}
4. **{Step 4}**: {What the agent does}

## Technical Expertise

### {Expertise Area 1}

{Deep dive into specific technical knowledge}

- {Specific skill or tool}
- {Specific skill or tool}
- {Specific skill or tool}

### {Expertise Area 2}

{Deep dive into specific technical knowledge}

- {Specific skill or tool}
- {Specific skill or tool}
- {Specific skill or tool}

## Best Practices

{List the key best practices this agent follows}

1. **{Practice}**: {Why it matters}
2. **{Practice}**: {Why it matters}
3. **{Practice}**: {Why it matters}
4. **{Practice}**: {Why it matters}
5. **{Practice}**: {Why it matters}

## Common Challenges

### {Challenge Type 1}

{How the agent approaches this challenge}

### {Challenge Type 2}

{How the agent approaches this challenge}

### {Challenge Type 3}

{How the agent approaches this challenge}

## Deliverables

When engaged, this agent provides:

- **{Deliverable 1}**: {What this includes}
- **{Deliverable 2}**: {What this includes}
- **{Deliverable 3}**: {What this includes}
- **{Deliverable 4}**: {What this includes}

## Integration Points

{Describe how this agent works with other agents, tools, or processes}

- **{Integration 1}**: {How it works}
- **{Integration 2}**: {How it works}
- **{Integration 3}**: {How it works}

## Bushido Principles

This agent embodies:

- **{Virtue 1} ({Japanese} - {Romanization})**: {How this agent demonstrates this virtue}
- **{Virtue 2} ({Japanese} - {Romanization})**: {How this agent demonstrates this virtue}
- **{Virtue 3} ({Japanese} - {Romanization})**: {How this agent demonstrates this virtue}

## When to Invoke

Summon this agent when you need:

- {Specific scenario}
- {Specific scenario}
- {Specific scenario}
- {Specific scenario}
```

### Agent Frontmatter Guide

- **name**: Kebab-case identifier (e.g., "frontend-architect", "security-engineer")
- **description**: Multi-line YAML string with detailed agent purpose. Use `|` for multi-line.
- **model**: Usually "inherit" to use the default model
- **color**: Visual identifier in Claude Code UI (purple, blue, green, red, yellow, cyan, magenta)

### Agent Color Guidelines

- **purple**: Design, UI/UX, presentation
- **blue**: Architecture, planning, infrastructure
- **green**: Testing, quality, reliability
- **red**: Security, performance, critical systems
- **yellow**: Documentation, communication
- **cyan**: Data, analytics, integration
- **magenta**: Creative, experimental, research

## Step 3: Create Skills (Optional)

Dō plugins can include supporting skills that agents can invoke:

### Skill Directory Structure

```
skills/{skill-name}/
└── SKILL.md
```

### SKILL.md Format

```markdown
---
name: {discipline}-{skill-name}
description: Use when {specific scenario}. {What this skill provides}.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Task
---

# {Discipline} - {Skill Name}

{Overview of the skill}

## When to Use

{Specific scenarios where this skill applies}

## Methodology

{Step-by-step approach}

## Best Practices

{List of best practices}

## Examples

{Practical examples}

## Related Agents

- **{agent-name}**: {How this skill relates to the agent}
```

## Step 4: Write README.md

Create a comprehensive README:

```markdown
# Dō: {Discipline Name}

{Compelling description of the discipline and what these agents provide}

## What This Dō Provides

### Specialized Agents

This dō provides the following agents:

#### {Agent 1 Name}

{One-paragraph description of agent specialization}

**Invoke when**: {Specific scenarios}

#### {Agent 2 Name}

{One-paragraph description of agent specialization}

**Invoke when**: {Specific scenarios}

#### {Agent 3 Name}

{One-paragraph description of agent specialization}

**Invoke when**: {Specific scenarios}

### Supporting Skills

{If applicable, list supporting skills}

- **{skill-1}**: {brief description}
- **{skill-2}**: {brief description}

## Installation

Install via the Han marketplace:

\`\`\`bash
npx @thebushidocollective/han plugin install {plugin-name}
\`\`\`

Or install manually:

\`\`\`bash
claude plugin marketplace add thebushidocollective/han
claude plugin install do-{discipline-name}@han
\`\`\`

## Usage

### Invoking Agents

In Claude Code, invoke agents using the Task tool or natural language:

\`\`\`
"I need a {agent-name} to {task description}"
\`\`\`

Or explicitly:

\`\`\`
Please spawn a {agent-name} agent to help with {specific task}
\`\`\`

### Example Workflows

#### {Workflow 1}

1. {Step 1}
2. {Step 2}
3. {Step 3}

#### {Workflow 2}

1. {Step 1}
2. {Step 2}
3. {Step 3}

## Learning Path

### Shu (守) - Follow

{Beginner practices for this discipline}

### Ha (破) - Break

{Intermediate practices for this discipline}

### Ri (離) - Transcend

{Advanced practices for this discipline}

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.
```

## Step 5: Register in Marketplace

Add your plugin to `.claude-plugin/marketplace.json`:

```json
{
  "plugins": {
    "do-{discipline-name}": {
      "source": "directory",
      "path": "./do/do-{discipline-name}"
    }
  }
}
```

## Best Practices

### DO

✅ Create agents with deep, specific expertise (not generic generalists)
✅ Write detailed, comprehensive agent definitions (1000+ words)
✅ Include specific methodologies and decision-making frameworks
✅ Provide clear "when to invoke" guidance
✅ Link agents to Bushido virtues
✅ Include practical examples and scenarios
✅ Consider how agents work together
✅ Make agents opinionated based on best practices
✅ Include technical depth appropriate to the discipline
✅ Test agents with realistic scenarios

### DON'T

❌ Don't create vague or generic agents
❌ Don't duplicate functionality of existing agents
❌ Don't write shallow agent definitions (<500 words)
❌ Don't forget to specify when NOT to use an agent
❌ Don't ignore integration with other tools/agents
❌ Don't create too many agents (3-5 is ideal per dō)
❌ Don't use placeholder content
❌ Don't skip the philosophy and principles sections

## Agent Design Guidelines

### Agent Scope

Each agent should have:

- **Clear specialty**: One specific area of deep expertise
- **Distinct perspective**: Unique approach or methodology
- **Defined boundaries**: Know what they DON'T handle
- **Complementary relationships**: Work well with other agents

### Agent Personality

Agents should be:

- **Authoritative**: Demonstrate deep knowledge
- **Practical**: Focus on real-world application
- **Principled**: Follow best practices and patterns
- **Collaborative**: Work well in teams

### Common Agent Archetypes

1. **Architect**: High-level design and system structure
2. **Engineer**: Hands-on implementation and problem-solving
3. **Specialist**: Deep expertise in narrow domain
4. **Reviewer**: Quality assessment and improvement
5. **Consultant**: Advisory and strategic guidance

## Discipline Categories

### Development Disciplines

- Frontend Development
- Backend Development
- Mobile Development
- Full-Stack Development
- Game Development

### Engineering Disciplines

- Security Engineering
- Performance Engineering
- Platform Engineering
- Database Engineering
- Infrastructure Engineering
- Network Engineering

### Practice Disciplines

- Architecture
- Quality Assurance
- Site Reliability Engineering
- DevOps/Platform
- Technical Documentation

### Specialized Disciplines

- Accessibility Engineering
- Data Engineering
- Machine Learning Engineering
- Blockchain Development
- Embedded Development
- Graphics Engineering
- Compiler Development

## Examples of Well-Structured Dōs

Reference these examples:

- **do-frontend-development**: Excellent agent definitions with clear roles
- **do-security-engineering**: Strong technical depth
- **do-architecture**: Good balance of strategy and implementation

## Testing Your Dō

1. Install locally:

   ```bash
   claude plugin install /path/to/do-{discipline}@local
   ```

2. Invoke agents in various scenarios:

   ```
   "I need help with [scenario] - can a [agent-name] help?"
   ```

3. Verify agents provide appropriate depth and expertise

4. Test agent collaboration in complex scenarios

## Questions?

See the [Han documentation](https://thebushidocollective.github.io/han) or ask in [GitHub Discussions](https://github.com/thebushidocollective/han/discussions).
