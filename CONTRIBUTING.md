# Contributing to Han

We welcome contributions that honor the Bushido Code and help build a better marketplace for Claude Code plugins.

## The Bushido Way of Contributing

All contributions should embody the seven virtues:

1. **Honesty (誠)** - Be transparent about capabilities, limitations, and trade-offs
2. **Respect (礼)** - Honor existing conventions and the work of others
3. **Courage (勇)** - Suggest improvements and challenge the status quo when needed
4. **Compassion (同情)** - Consider the experience of plugin users and other contributors
5. **Loyalty (忠誠)** - Commit to long-term quality and maintainability
6. **Discipline (自制)** - Follow coding standards and test thoroughly
7. **Justice (正義)** - Make decisions that benefit the entire community

## Types of Contributions

### 🎯 New Bushido Skills

Add new quality principles and practices to the core bushido plugin.

**Requirements:**

- Must align with the seven virtues
- Include clear documentation in SKILL.md
- Provide practical examples
- Add to `/bushido/skills/` directory

### ⚔️ New Language/Validation Plugins

Create validation hooks for languages, frameworks, or tools.

**Requirements:**

- Include validation hooks for Stop and SubagentStop events
- Use `han hook run` command for validating various commands.
- Provide clear error messages
- Include README.md with usage examples

**Structure:**

```
plugins/languages/{name}/   # or plugins/validation/{name}/
├── .claude-plugin/
│   └── plugin.json
├── han-plugin.yml
├── hooks/
│   └── hooks.json        # Generated, do not hand-edit
├── skills/              # Optional
└── README.md
```

**Example `han-plugin.yml`:**

```yaml
hooks:
  test:
    command: npm test
    dirs_with:
      - package.json
    description: Run the project's test suite
    if_changed:
      - "**/*.ts"
      - "**/*.test.ts"
```

Hooks default to the `Stop` and `SubagentStop` events, so most validation plugins do not need an explicit `event:` key. Generate `hooks/hooks.json` from that file rather than writing it by hand:

```bash
han plugin generate-hooks plugins/languages/{name}
```

### 🛤️ New Discipline Plugins

Create specialized agents for development practices.

**Requirements:**

- Focus on practice and discipline, not specific tools
- Include agent markdown files with clear expertise
- Provide skills that embody the discipline
- Add to `plugins/disciplines/` directory

**Structure:**

```
plugins/disciplines/{discipline}/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   └── {agent-name}.md
├── skills/              # Optional
└── README.md
```

### 🌉 New Service/Tool Plugins

Add MCP servers that provide external knowledge and integrations.

**Requirements:**

- Follow MCP server specifications
- Include clear documentation
- Provide value beyond what's available in Claude's knowledge
- Add to `plugins/services/` or `plugins/tools/` directory

**Structure:**

```
plugins/services/{name}/   # or plugins/tools/{name}/
├── .claude-plugin/
│   └── plugin.json
├── .mcp.json
└── README.md
```

### 🔧 Han CLI Improvements

Enhance the `@thebushidocollective/han` package.

**Requirements:**

- Written in TypeScript
- Include tests
- Follow existing code style (Biome)
- Update documentation

## Using Claude to Contribute

Claude Code can help you generate high-quality plugins and contributions. You can use either the dedicated slash commands or natural language prompts.

### Using Slash Commands

Han provides three slash commands for creating plugins with comprehensive guidance:

- **`/create-jutsu`** - Create a new language/validation plugin with validation hooks
- **`/create-do`** - Create a new discipline plugin with specialized agents
- **`/create-hashi`** - Create a new service plugin with MCP server integration

These commands provide detailed, step-by-step instructions for creating each plugin type, including:

- Complete directory structure requirements
- Configuration file formats and examples
- Best practices and anti-patterns
- Testing and validation guidance
- Real-world examples from existing plugins

**Example usage:**

```
/create-jutsu
```

Then follow the comprehensive instructions provided by the command.

### Using Natural Language Prompts

You can also use natural language prompts to create plugins. Here are example prompts for each type of contribution:

### Creating a Language/Validation Plugin

**Example Prompt:**

```
Add a validation plugin for <tool-name> that validates <what it validates>.
It should use dirs_with <marker-file> and run <validation-command>.
Include skills for <skill-topics>.
```

**Real Example:**

```
Add a validation plugin for kubernetes that validates manifests.
It should use dirs_with *.yaml,*.yml and run kubeconform.
Include skills for kubernetes-manifests, kubernetes-resources, and kubernetes-security.
```

**What Claude Will Generate:**

- `plugins/validation/{name}/.claude-plugin/plugin.json` - Plugin metadata
- `plugins/validation/{name}/hooks/hooks.json` - Validation hooks with proper `han hook run` usage
- `plugins/validation/{name}/README.md` - Installation and usage documentation
- `plugins/validation/{name}/skills/{skill-name}/SKILL.md` - Comprehensive skill documentation

### Creating a Discipline Agent

**Example Prompt:**

```
Add a discipline plugin for <discipline> with an agent that acts as <expert-role>.
Include skills for <skill-topics>.
```

**Real Example:**

```
Add a discipline plugin for SRE with an agent that acts as a site reliability engineer.
Include skills for monitoring, incident-response, and reliability engineering.
```

**What Claude Will Generate:**

- `plugins/disciplines/{discipline}/.claude-plugin/plugin.json` - Plugin metadata
- `plugins/disciplines/{discipline}/agents/{agent-name}.md` - Agent persona and expertise
- `plugins/disciplines/{discipline}/README.md` - Overview and usage guide
- `plugins/disciplines/{discipline}/skills/{skill-name}/SKILL.md` - Discipline-specific skills

### Creating Bushido Skills

**Example Prompt:**

```
Add a bushido skill for <principle> that teaches <what it teaches>.
Include examples of good and bad practices.
```

**Real Example:**

```
Add a bushido skill for the boy-scout-rule that teaches leaving code better than you found it.
Include examples of good and bad refactoring practices.
```

**What Claude Will Generate:**

- `bushido/skills/{skill-name}/SKILL.md` - Detailed skill documentation with examples

### Creating Multiple Related Plugins

**Example Prompt:**

```
Add validation plugins for <tool1>, <tool2>, and <tool3> along with other comparable deployment tools.
Also create a discipline plugin acting as an <expert-role>.
```

**Real Example:**

```
Add validation plugins for kubernetes, helm, and terraform along with other comparable deployment tools.
Also create a discipline plugin acting as an SRE.
```

**What Claude Will Generate:**

Multiple complete plugins with all necessary files, maintaining consistency across all of them.

### Tips for Effective Prompts

1. **Be Specific About Tools**: Name the exact tools and commands to use
2. **Specify Marker Files**: Indicate what files identify a project type
3. **Request Skills**: List the skill topics you want covered
4. **Mention Examples**: Ask for code examples and best practices
5. **Request Multiple**: You can ask for multiple related plugins at once

### What Claude Generates Automatically

When you request plugin generation, Claude will:

- ✅ Use proper directory structure
- ✅ Follow naming conventions (short names matching directory)
- ✅ Include marketplace.json with metadata
- ✅ Create hooks.json with `han hook run` patterns
- ✅ Generate comprehensive README.md files
- ✅ Write detailed SKILL.md files with examples
- ✅ Follow code style and formatting guidelines
- ✅ Include proper error handling
- ✅ Add validation commands with correct flags
- ✅ Register plugins in `.claude-plugin/marketplace.json`

### Validating Generated Files

After Claude generates files, review:

1. **Hook Commands**: Ensure hooks are declared in `han-plugin.yml` and `hooks/hooks.json` was regenerated with `han plugin generate-hooks`
2. **Marker Files**: Verify marker files match project types
3. **Skills**: Check that skills are comprehensive and accurate
4. **Examples**: Ensure code examples are correct and follow best practices
5. **Marketplace Entry**: Confirm plugin is registered in root marketplace.json

## Contribution Process

### 1. Discuss First

For significant changes:

- Open an issue to discuss the proposal
- Explain how it aligns with the Bushido virtues
- Get feedback from maintainers

### 2. Fork and Branch

```bash
# Fork the repository
# Clone your fork
git clone https://github.com/YOUR_USERNAME/han.git

# Create a feature branch
git checkout -b feature/your-feature-name
```

### 3. Make Changes

- Follow existing code style and conventions
- Write clear commit messages
- Keep changes focused and atomic

### 4. Test Thoroughly

For validation plugins:

```bash
# Test validation hooks work correctly
# Ensure they fail when they should
# Ensure they pass when they should
```

For han CLI:

```bash
cd packages/han
npm run typecheck
npm run lint
npm test
```

### 5. Document

- Update README.md if adding features
- Include examples in plugin documentation
- Document any breaking changes

### 6. Submit Pull Request

**PR Title Format:**

- `feat(validation): add markdownlint plugin`
- `fix(han): improve error messages`
- `docs: update contributing guidelines`

**PR Description Should Include:**

- What changed and why
- How it embodies the Bushido virtues
- Testing performed
- Screenshots/examples if applicable

## Plugin Naming Conventions

### Languages/Validation Plugins

- `{tool-name}` - e.g., `jest`, `typescript`, `biome`
- Use lowercase, hyphenated names
- Name after the tool, not the language (e.g., `pytest` not `python-testing`)
- Directory: `plugins/languages/{name}/` or `plugins/validation/{name}/`

### Discipline Plugins

- `{discipline}` - e.g., `frontend-development`, `security-engineering`
- Focus on the practice, not the tools
- Use general terms that transcend specific technologies
- Directory: `plugins/disciplines/{name}/`

### Service/Tool Plugins

- `{service}` - e.g., `github`, `playwright`
- Name after the knowledge source or service
- Directory: `plugins/services/{name}/` or `plugins/tools/{name}/`

## Code Style

### TypeScript/JavaScript

- Use Biome for linting and formatting
- Prefer functional patterns
- Use TypeScript for type safety
- Write descriptive variable names

### Markdown

- Use proper headings hierarchy
- Include code examples
- Keep lines reasonably short
- Use markdownlint-compliant formatting

### JSON

- Use 2-space indentation
- No trailing commas
- Alphabetize keys when reasonable

## Validation Hook Guidelines

### Declare hooks in han-plugin.yml

Validation plugins declare their hooks in `han-plugin.yml`, then generate `hooks/hooks.json` from it:

```yaml
hooks:
  test:
    command: <test-command>
    dirs_with:
      - <marker-file>
```

```bash
han plugin generate-hooks
```

The generated `hooks.json` wires each hook to `han hook run <plugin> <hook>`. The older inline form, `han hook run --dirs-with <marker> -- <command>`, still works but is legacy: it cannot express `if_changed`, dependencies, event selection, or `${HAN_FILES}` targeting.

There is no `--fail-fast` flag. Earlier documentation prescribed one; it does not exist in the CLI.

### Choose Appropriate Marker Files

- `package.json` - JavaScript/TypeScript projects
- `Gemfile` - Ruby projects
- `Cargo.toml` - Rust projects
- `go.mod` - Go modules
- `pyproject.toml` - Python projects
- `pom.xml` - Maven projects
- `build.gradle.kts` - Gradle projects

### Error Messages

Don't add redundant error messages after the hook command - it handles errors automatically.

**Good:**

```yaml
hooks:
  test:
    command: npm test
    dirs_with:
      - package.json
```

**Bad:**

```yaml
hooks:
  test:
    command: npm test || (echo 'Tests failed'; exit 2)
    dirs_with:
      - package.json
```

## Review Process

### What We Look For

1. **Alignment with Bushido** - Does this honor the seven virtues?
2. **Quality** - Is the code well-written and tested?
3. **Documentation** - Can users understand how to use it?
4. **Value** - Does this add meaningful capability?
5. **Maintainability** - Can we maintain this long-term?

### Feedback

- We'll provide constructive feedback
- Address comments promptly
- Ask questions if anything is unclear
- Iterate until the contribution meets standards

## Community Guidelines

### Be Respectful

- Treat all contributors with respect
- Assume good intentions
- Provide constructive feedback
- Help newcomers learn

### Be Professional

- Keep discussions focused on the work
- Avoid personal attacks
- Accept feedback gracefully
- Acknowledge the work of others

### Be Collaborative

- Share knowledge freely
- Help others succeed
- Build on existing work
- Give credit where due

## Questions?

- Open an issue for general questions
- Tag maintainers for urgent matters
- Check existing issues and PRs first
- Be patient - we're all volunteers

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

*"Beginning is easy - continuing is hard."* - Japanese Proverb

Thank you for contributing to the Way of Bushido. Your commitment to quality and excellence makes this community stronger.
