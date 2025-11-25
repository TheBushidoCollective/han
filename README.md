# Han

A curated marketplace of Claude Code plugins that embody the principles of ethical and professional software development.

## What is Han?

Han (藩 - domain/clan) is a marketplace of Claude Code plugins built on the foundation of the seven Bushido virtues. Each plugin helps you write better code through skills, agents, validation hooks, and external integrations.

The marketplace is organized around Japanese martial arts philosophy:

- **Bushido** (武士道) - The core principles and quality standards
- **Buki** (武器) - Weapons: Language and tool skills with validation hooks
- **Dō** (道) - The Way: Specialized agents for development disciplines
- **Sensei** (先生) - Teachers: MCP servers providing external knowledge

## The Seven Virtues

The Bushido Code guides every plugin in this marketplace:

1. **Honesty (誠)** - Write code with clarity and transparency
2. **Respect (礼)** - Honor those who came before and those who will follow
3. **Courage (勇)** - Do the right thing, even when difficult
4. **Compassion (同情)** - Write with empathy for users and developers
5. **Loyalty (忠誠)** - Stay committed to quality and continuous improvement
6. **Discipline (自制)** - Master your tools and craft
7. **Justice (正義)** - Make fair decisions that serve the greater good

## Getting Started

### Automatic Installation (Recommended)

Use the `han` CLI tool to automatically detect and install appropriate plugins:

```bash
# Install globally
npm install -g @thebushidocollective/han

# Or use with npx (no installation required)
npx @thebushidocollective/han plugin install --auto
```

The installer will:

- Analyze your codebase using Claude Agent SDK
- Detect languages, frameworks, and testing tools
- Detect git hosting platform (GitHub/GitLab)
- Recommend appropriate plugins
- Configure `.claude/settings.json` automatically

### Via Claude Code `/plugin` Command

Use Claude Code's built-in plugin command to add the marketplace:

```
/plugin marketplace add thebushidocollective/han
```

Then install individual plugins:

```
/plugin install bushido@han
/plugin install buki-typescript@han
```

### Manual Installation

Add the Han marketplace to your Claude Code settings (`.claude/settings.json`):

```json
{
  "extraKnownMarketplaces": {
    "han": {
      "source": {
        "source": "github",
        "repo": "thebushidocollective/han"
      }
    }
  },
  "enabledPlugins": {
    "bushido": true
  }
}
```

Then browse available plugins using Claude Code's plugin interface.

## Plugin Categories

### 🎯 Bushido (Core)

The foundational plugin containing the seven virtues, enforcement hooks, and core quality skills.

**Always install this first** - it provides the philosophical foundation and universal quality principles (SOLID, TDD, Boy Scout Rule, etc.).

### ⚔️ Buki (Weapons)

Language and tool plugins that provide validation hooks for your development workflow.

**Categories:**

- **Testing Frameworks** - Jest, Mocha, Vitest, Pytest, RSpec, Cypress, JUnit, TestNG
- **Linting & Formatting** - ESLint, Biome, Prettier, Pylint, RuboCop, Clippy, Checkstyle, Markdownlint
- **Language-Specific** - TypeScript, Go, Rust, Elixir, Crystal, Swift, Kotlin, Scala, and more

Each buki plugin includes validation hooks that run on Stop and SubagentStop events, ensuring code quality before you continue.

**Browse all buki plugins:** Check the `/buki` directory in this repository.

### 🛤️ Dō (The Way)

Specialized agents focused on development disciplines and practices.

**Disciplines include:**

- Frontend, Backend, Infrastructure
- Security, Quality, Documentation
- Architecture, Product Management
- AI Collaboration and more

**Browse all dō plugins:** Check the `/do` directory in this repository.

### 👴 Sensei (Teachers)

MCP servers that provide external knowledge and integrations.

**Examples:**

- Library documentation
- API references
- External service integrations

**Browse all sensei plugins:** Check the `/sensei` directory in this repository.

## Using the Han CLI

### Install Plugins

```bash
# Interactive mode - browse and select plugins
npx @thebushidocollective/han plugin install

# Auto-detect mode - AI analyzes codebase
npx @thebushidocollective/han plugin install --auto

# Install specific plugin by name
npx @thebushidocollective/han plugin install buki-typescript
```

### Search Plugins

```bash
npx @thebushidocollective/han plugin search typescript
```

### Align Plugins with Codebase

Re-analyze your codebase and sync plugins with current state:

```bash
npx @thebushidocollective/han plugin align
```

### Uninstall

```bash
npx @thebushidocollective/han uninstall
```

## Philosophy

### Focus on Practice, Not Tools

Our **Dō** (disciplines) focus on the **art and practice** of development:

- Frontend is about presentation, UX, and the art of visual design
- Backend is about data modeling, architecture, and robust services
- Infrastructure is about reliability, automation, and operational excellence

We **separate** tools (Buki) from disciplines (Dō). Your **weapon** (language/framework) is chosen based on needs, but your **way** (discipline) remains constant.

### The Weapons Serve the Way

- Languages are **tools** (Buki skills), not identities
- Frameworks are **means**, not ends
- The **discipline** (Dō agents) defines who you are
- The **weapon** (Buki skills) is what you wield

### Quality Through Validation

Buki plugins include validation hooks that enforce quality standards:

- Run tests before stopping work
- Ensure code passes linting
- Validate compilation
- Check formatting

These hooks prevent you from continuing with broken code, embodying the Bushido virtues of Discipline and Justice.

## Learning Paths

### Beginner's Path (Shu - 守)

Follow the fundamentals:

1. **bushido** - Learn the seven virtues
2. **One Dō** - Choose your primary discipline
3. **One Buki** - Master one weapon first

### Intermediate Path (Ha - 破)

Break from tradition and explore:

1. **Multiple Dō** - Practice several disciplines
2. **Multiple Buki** - Expand your arsenal
3. **Sensei** - Seek wisdom from teachers

### Advanced Path (Ri - 離)

Transcend and innovate:

1. **All Dō** - Master multiple ways
2. **Create New Buki** - Contribute new weapons
3. **Become Sensei** - Share wisdom with others

## Contributing

We welcome contributions that honor the Bushido Code. See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- How to create new plugins
- Plugin structure and conventions
- Testing and validation requirements
- Submission process

## Repository Structure

```text
han/
├── bushido/              # Core foundation plugin
├── buki/                 # Weapon plugins (tools & validation)
├── do/                   # Discipline plugins (specialized agents)
├── sensei/               # Teacher plugins (MCP servers)
└── packages/
    └── bushido-han/      # CLI tool for installation & validation
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

Built by **[The Bushido Collective](https://thebushido.co)** - developers committed to honor, quality, and continuous improvement through disciplined practice.

We believe that software development is not just a technical practice, but a way of life guided by virtue, discipline, and the pursuit of excellence.

---

*"Beginning is easy - continuing is hard."* - Japanese Proverb

Walk the way of bushido. Practice with discipline. Build with honor.
