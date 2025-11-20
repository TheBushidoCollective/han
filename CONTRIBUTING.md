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

### ⚔️ New Buki Plugins (Weapons)

Create validation hooks for languages, frameworks, or tools.

**Requirements:**

- Include validation hooks for Stop and SubagentStop events
- Use `han validate` command for monorepo support
- Provide clear error messages
- Include README.md with usage examples

**Structure:**

```
buki-{name}/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   └── hooks.json
├── skills/              # Optional
└── README.md
```

**Example hooks.json:**

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx -y @thebushidocollective/han validate --fail-fast --dirs-with package.json npm test"
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx -y @thebushidocollective/han validate --fail-fast --dirs-with package.json npm test"
          }
        ]
      }
    ]
  }
}
```

### 🛤️ New Dō Plugins (Disciplines)

Create specialized agents for development practices.

**Requirements:**

- Focus on practice and discipline, not specific tools
- Include agent markdown files with clear expertise
- Provide skills that embody the discipline
- Add to `/do/` directory

**Structure:**

```
do-{discipline}/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   └── {agent-name}.md
├── skills/              # Optional
└── README.md
```

### 👴 New Sensei Plugins (Teachers)

Add MCP servers that provide external knowledge and integrations.

**Requirements:**

- Follow MCP server specifications
- Include clear documentation
- Provide value beyond what's available in Claude's knowledge
- Add to `/sensei/` directory

**Structure:**

```
sensei-{name}/
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

For buki plugins:

```bash
# Test validation hooks work correctly
# Ensure they fail when they should
# Ensure they pass when they should
```

For han CLI:

```bash
cd packages/bushido-han
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

- `feat(buki): add markdownlint plugin`
- `fix(han): improve error messages`
- `docs: update contributing guidelines`

**PR Description Should Include:**

- What changed and why
- How it embodies the Bushido virtues
- Testing performed
- Screenshots/examples if applicable

## Plugin Naming Conventions

### Buki (Weapons)

- `buki-{tool-name}` - e.g., `buki-jest`, `buki-typescript`
- Use lowercase, hyphenated names
- Name after the tool, not the language (e.g., `buki-pytest` not `buki-python-testing`)

### Dō (Disciplines)

- `do-{discipline}` - e.g., `do-frontend`, `do-security`
- Focus on the practice, not the tools
- Use general terms that transcend specific technologies

### Sensei (Teachers)

- `sensei-{service}` - e.g., `sensei-context7`, `sensei-github`
- Name after the knowledge source or service

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

### Use han validate

All buki plugins should use the `han validate` command:

```json
{
  "type": "command",
  "command": "npx -y @thebushidocollective/han validate --fail-fast --dirs-with <marker-file> <test-command>"
}
```

### Choose Appropriate Marker Files

- `package.json` - JavaScript/TypeScript projects
- `Gemfile` - Ruby projects
- `Cargo.toml` - Rust projects
- `go.mod` - Go modules
- `pyproject.toml` - Python projects
- `pom.xml` - Maven projects
- `build.gradle.kts` - Gradle projects

### Error Messages

Don't add redundant error messages after `han validate` - it handles errors automatically.

**Good:**

```json
"command": "npx -y @thebushidocollective/han validate --fail-fast --dirs-with package.json npm test"
```

**Bad:**

```json
"command": "npx -y @thebushidocollective/han validate --fail-fast --dirs-with package.json npm test || (echo 'Tests failed'; exit 2)"
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
