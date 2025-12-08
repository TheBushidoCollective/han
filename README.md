# Han

A curated marketplace of Claude Code plugins that embody the principles of ethical and professional software development.

## What is Han?

Han (藩 - domain/clan) is a marketplace of Claude Code plugins built on the foundation of the seven Bushido virtues. Each plugin helps you write better code through skills, agents, validation hooks, and external integrations.

The marketplace is organized around Japanese martial arts philosophy:

- **Bushido** (武士道) - The core principles and quality standards
- **Jutsu** (術) - Techniques: Language and tool skills with validation hooks
- **Dō** (道) - The Way: Specialized agents for development disciplines
- **Hashi** (橋) - Bridges: MCP servers providing external integrations

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

### Quick Install (Recommended)

Install the `han` binary with a single command:

```bash
curl -fsSL https://han.guru/install.sh | bash
```

This installs han to `~/.claude/bin/han`, which Claude Code automatically adds to PATH when running hooks.

Then install plugins for your project:

```bash
han plugin install --auto
```

The installer will:

- Analyze your codebase using Claude Agent SDK
- Detect languages, frameworks, and testing tools
- Detect git hosting platform (GitHub/GitLab)
- Recommend appropriate plugins
- Configure `.claude/settings.json` automatically
- **Always install `core`** - Required for binary installation and hook infrastructure

### Alternative Installation Methods

#### Homebrew (macOS/Linux)

```bash
brew install thebushidocollective/tap/han
```

#### Via Claude Code (plugins only - requires separate han installation)

Add the marketplace, then install plugins:

```
/plugin marketplace add thebushidocollective/han
/plugin install bushido@han
```

> **Note:** Plugin hooks require `han` to be installed. Use `curl -fsSL https://han.guru/install.sh | bash` to install han first.

#### Manual Configuration

Add the Han marketplace to `.claude/settings.json`:

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
    "bushido@han": true
  }
}
```

> **Note:** Plugin hooks require `han` to be installed. Use `curl -fsSL https://han.guru/install.sh | bash` to install han first.

## Plugin Categories

### ⚙️ Core (Required)

**Essential infrastructure plugin - always required.**

The `core` plugin provides:

- **Binary auto-installation** - SessionStart hook that downloads han to `~/.claude/bin/han`
- **Hook infrastructure** - Delegation protocols, skill transparency, quality enforcement
- **MCP servers** - Hook execution, metrics tracking, documentation access
- **Universal principles** - Programming best practices that transcend languages

**This plugin is automatically included with `--auto` installation.**

### 🎯 Bushido (Recommended)

The foundational philosophy plugin containing the seven virtues and core quality skills.

**Strongly recommended** - provides philosophical foundation and universal quality principles (SOLID, TDD, Boy Scout Rule, etc.).

### ⚔️ Jutsu (Techniques)

Language and tool plugins that provide validation hooks for your development workflow.

**Categories:**

- **Testing Frameworks** - Jest, Mocha, Vitest, Pytest, RSpec, Cypress, JUnit, TestNG
- **Linting & Formatting** - ESLint, Biome, Prettier, Pylint, RuboCop, Clippy, Checkstyle, Markdownlint
- **Language-Specific** - TypeScript, Go, Rust, Elixir, Crystal, Swift, Kotlin, Scala, and more

Each jutsu plugin includes validation hooks that run on Stop and SubagentStop events, ensuring code quality before you continue.

**Browse all jutsu plugins:** Check the `/jutsu` directory in this repository.

### 🛤️ Dō (The Way)

Specialized agents focused on development disciplines and practices.

**Disciplines include:**

- Frontend, Backend, Infrastructure
- Security, Quality, Documentation
- Architecture, Product Management
- AI Collaboration and more

**Browse all dō plugins:** Check the `/do` directory in this repository.

### 🌉 Hashi (Bridges)

MCP servers that provide external knowledge and integrations.

**Examples:**

- Library documentation
- API references
- External service integrations

**Browse all hashi plugins:** Check the `/hashi` directory in this repository.

## Using the Han CLI

### Install Plugins

```bash
# Interactive mode - browse and select plugins
han plugin install

# Auto-detect mode - AI analyzes codebase
han plugin install --auto

# Install specific plugin by name
han plugin install jutsu-typescript
```

### Search Plugins

```bash
han plugin search typescript
```

### Align Plugins with Codebase

Re-analyze your codebase and sync plugins with current state:

```bash
han plugin align
```

### Uninstall

```bash
han uninstall
```

## Philosophy

### Focus on Practice, Not Tools

Our **Dō** (disciplines) focus on the **art and practice** of development:

- Frontend is about presentation, UX, and the art of visual design
- Backend is about data modeling, architecture, and robust services
- Infrastructure is about reliability, automation, and operational excellence

We **separate** tools (Jutsu) from disciplines (Dō). Your **technique** (language/framework) is chosen based on needs, but your **way** (discipline) remains constant.

### The Techniques Serve the Way

- Languages are **tools** (Jutsu skills), not identities
- Frameworks are **means**, not ends
- The **discipline** (Dō agents) defines who you are
- The **technique** (Jutsu skills) is what you wield

### Quality Through Validation

Jutsu plugins include validation hooks that enforce quality standards:

- Run tests before stopping work
- Ensure code passes linting
- Validate compilation
- Check formatting

These hooks prevent you from continuing with broken code, embodying the Bushido virtues of Discipline and Justice.

### Smart Hook Caching

Jutsu plugins use intelligent caching to avoid redundant validation runs:

- **Session Start**: Hooks prime their cache by hashing relevant files
- **Stop/SubagentStop**: Hooks only run if files have changed since the last successful run
- **Per-Project Cache**: Cache is stored in `~/.claude/projects/{project}/han/` and persists across sessions

This means if you haven't modified any TypeScript files, the TypeScript compiler won't run again. If you haven't touched any files matching the linter's patterns, linting is skipped.

#### How It Works

1. Each hook defines `ifChanged` patterns in `han-config.json`:

   ```json
   {
     "hooks": {
       "lint": {
         "command": "npx biome check --write",
         "dirsWith": ["biome.json"],
         "ifChanged": ["**/*.{js,jsx,ts,tsx,json}"]
       }
     }
   }
   ```

2. On SessionStart, hooks run with `--cache` to prime the manifest
3. On Stop, hooks check if any matching files changed before running
4. After successful execution, the cache manifest is updated

## Learning Paths

### Beginner's Path (Shu - 守)

Follow the fundamentals:

1. **bushido** - Learn the seven virtues
2. **One Dō** - Choose your primary discipline
3. **One Jutsu** - Master one technique first

### Intermediate Path (Ha - 破)

Break from tradition and explore:

1. **Multiple Dō** - Practice several disciplines
2. **Multiple Jutsu** - Expand your arsenal
3. **Hashi** - Connect with external knowledge

### Advanced Path (Ri - 離)

Transcend and innovate:

1. **All Dō** - Master multiple ways
2. **Create New Jutsu** - Contribute new techniques
3. **Build Hashi** - Create bridges to share knowledge

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
├── jutsu/                 # Weapon plugins (tools & validation)
├── do/                   # Discipline plugins (specialized agents)
├── hashi/               # Teacher plugins (MCP servers)
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
