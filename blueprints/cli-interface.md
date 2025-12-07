---
name: cli-interface
summary: Interactive CLI with AI-powered plugin discovery
---

# Han CLI Interface

## Overview

The Han CLI provides a command-line interface for managing Claude Code plugins from The Bushido Collective's marketplace. It includes AI-powered features for plugin discovery, repository analysis, and gap identification.

## Command Structure

```
han [command] [options]
```

## Top-Level Commands

### Plugin Management Commands

#### `han plugin install [plugin-names...]`

Install one or more plugins from the Han marketplace.

**Behavior:**

- If no plugin names provided: Shows interactive selector with auto-detected plugins
- If `--auto` flag: Auto-detects and installs recommended plugins based on codebase analysis
- If exact plugin name(s): Installs specified plugins directly
- If inexact match (single plugin): Searches marketplace and shows interactive selector with matches

**Options:**

- `--auto` - Auto-detect and install recommended plugins using AI analysis
- `--scope <scope>` - Installation scope: `user` (default), `project`, or `local`
  - `user`: ~/.claude/settings.json (shared across all projects)
  - `project`: .claude/settings.json (project-specific)
  - `local`: .claude/settings.local.json (gitignored, personal)

**Examples:**

```bash
# Interactive installation
han plugin install

# Auto-detect recommended plugins
han plugin install --auto

# Install specific plugin
han plugin install jutsu-typescript

# Search-based installation (if not exact match)
han plugin install playwright
# Shows: jutsu-playwright, hashi-playwright-mcp, etc.

# Install to project scope
han plugin install jutsu-biome --scope project

# Install multiple plugins
han plugin install jutsu-typescript jutsu-react jutsu-nextjs
```

**Implementation:** `lib/commands/plugin/install.ts` → `lib/plugin-install.ts`

**Features:**

- Always includes `bushido` as dependency
- Validates plugins against marketplace
- Interactive selector for ambiguous queries (uses `PluginSelector` component)
- Shows installation confirmation and restart prompt
- Automatically configures dispatch hooks

#### `han plugin list`

List all installed plugins across all scopes.

**Options:**

- `--scope <scope>` - Filter by scope: `user`, `project`, `local`, or `all` (default)

**Output:**

- Table showing: Plugin name, Scope, Category, Description
- Total count of installed plugins

**Examples:**

```bash
# List all plugins
han plugin list

# List only user-scoped plugins
han plugin list --scope user

# List project-specific plugins
han plugin list --scope project
```

**Implementation:** `lib/commands/plugin/list.ts` → `lib/plugin-list.ts`

#### `han plugin search [query]`

Search for plugins in the Han marketplace.

**Behavior:**

- Without query: Shows all available plugins
- With query: Filters by name, description, keywords, and category

**Output:**

- Table showing: Name, Category, Description
- Match count and installation instructions

**Examples:**

```bash
# Show all plugins
han plugin search

# Search for TypeScript-related plugins
han plugin search typescript

# Search for testing tools
han plugin search test

# Search by category
han plugin search jutsu
```

**Implementation:** `lib/commands/plugin/search.ts` → `lib/plugin-search.ts`

#### `han plugin uninstall <plugin-names...>`

Uninstall one or more plugins.

**Options:**

- `--scope <scope>` - Uninstall from specific scope (default: `user`)

**Examples:**

```bash
han plugin uninstall jutsu-typescript
han plugin uninstall jutsu-react jutsu-nextjs
han plugin uninstall hashi-playwright-mcp --scope project
```

**Implementation:** `lib/commands/plugin/uninstall.ts`

#### `han plugin update`

Update the local marketplace cache.

**Behavior:**

- Fetches latest plugin metadata from GitHub
- Updates local cache (~/.han-cache/marketplace.json)

**Implementation:** `lib/commands/plugin/update.ts`

### Analysis Commands

#### `han explain`

Show comprehensive overview of Han configuration.

**Output:**

- Installed plugins table with capabilities
- Features legend (📜 Commands, ⚔️ Skills, 🪝 Hooks, 🔌 MCP)
- Summary statistics
- Marketplace status
- Useful commands reference

**Features Analyzed:**

- Commands: Slash commands available from plugins
- Skills: Specialized skills/prompts
- Hooks: Lifecycle hooks configured
- MCP: MCP servers enabled

**Examples:**

```bash
han explain
```

**Implementation:** `lib/explain.ts`

**Output Format:**

```
🏯 Han Configuration Overview

📦 Installed Plugins

┌─────────────────────────┬───────────────┬──────────┬───────────────┐
│ Plugin                  │ Category      │ Scope    │ Features      │
├─────────────────────────┼───────────────┼──────────┼───────────────┤
│ bushido                 │ Core          │ User     │ 📜 🪝         │
│ jutsu-typescript        │ Language      │ User     │ 📜 ⚔️ 🪝      │
│ hashi-playwright-mcp    │ MCP Server    │ User     │ 🔌            │
└─────────────────────────┴───────────────┴──────────┴───────────────┘

📊 Features Legend:
  📜 Commands   - Slash commands available
  ⚔️  Skills     - Specialized skills/prompts
  🪝 Hooks      - Lifecycle hooks configured
  🔌 MCP        - MCP servers enabled

📈 Summary:
  Total Plugins: 3
  With Commands: 2
  With Skills: 1
  With Hooks: 2
  With MCP Servers: 1
```

#### `han summary`

AI-powered summary of how Han is improving the repository.

**Behavior:**

- Analyzes installed plugins and their capabilities
- Uses Claude Agent SDK to explore the repository
- Generates natural language summary of improvements
- Streams output in real-time

**Features:**

- Uses Claude Haiku model for fast analysis
- Read-only codebase exploration (glob, grep, read_file)
- Concrete examples of capabilities added
- Focus on actual workflow improvements

**Examples:**

```bash
han summary
```

**Implementation:** `lib/summary.ts`

**Sample Output:**

```
🏯 Generating Han Summary...

Analyzing installed plugins...
Analyzing repository...
Generating AI summary...

🤖 AI Analysis:

## How Han is Improving This Repository

### Code Quality (jutsu-typescript, jutsu-biome)
The TypeScript and Biome plugins provide automated type checking and code
formatting, ensuring consistent code style across the team. The hooks validate
code before commits, catching errors early.

### Testing Infrastructure (hashi-playwright-mcp)
The Playwright MCP integration enables browser automation and end-to-end testing
capabilities directly from Claude Code, streamlining test development.

### Overall Impact
Han plugins have automated quality checks, standardized formatting, and enabled
advanced testing capabilities, reducing manual review time and improving code
consistency.
```

#### `han gaps`

AI-powered analysis of repository gaps and plugin recommendations.

**Behavior:**

- Analyzes codebase structure and technologies
- Identifies gaps in current plugin coverage
- Recommends specific plugins to fill gaps
- Provides evidence-based reasoning
- Streams output in real-time

**Features:**

- Uses Claude Agent SDK with codebase statistics
- Compares installed vs available plugins
- Technology detection (package.json, config files, etc.)
- Evidence-based recommendations

**Examples:**

```bash
han gaps
```

**Implementation:** `lib/gaps.ts`

**Sample Output:**

```
🔍 Analyzing Repository Gaps...

Analyzing codebase...
Fetching plugin data...
Exploring repository structure...
Generating AI analysis...

🤖 Gap Analysis:

## Repository Analysis
This is a Next.js application with TypeScript, using Playwright for testing.
Package.json shows React 18 and several UI libraries.

## Identified Gaps
1. **Missing React Development Tools**: No React-specific linting or hooks
2. **No Next.js Support**: Next.js patterns not being validated
3. **Missing Markdown Tools**: README and docs lack linting

## Recommended Plugins
1. **jutsu-react** - Adds React hooks patterns and best practices
   - Evidence: Found 15+ React components in src/components/
   - Benefit: Validates hooks usage, suggests optimizations

2. **jutsu-nextjs** - Next.js specific development support
   - Evidence: next.config.js and App Router usage detected
   - Benefit: Validates routing patterns, data fetching

3. **jutsu-markdown** - Markdown linting and formatting
   - Evidence: 8 .md files in repository
   - Benefit: Consistent documentation style

## Summary
Implementing these 3 plugins would add specialized support for the core
technologies in use, improving code quality and developer experience.

💡 To install recommended plugins, run: han plugin install <plugin-name>
   Or use: han plugin install --auto
```

### Other Commands

#### `han hook <subcommand>`

Manage Claude Code hooks.

**Subcommands:**

- `han hook list` - List configured hooks
- `han hook add <hook-type> <command>` - Add a hook
- `han hook remove <hook-type> <command>` - Remove a hook

**Implementation:** `lib/commands/hook/index.ts`

#### `han mcp <subcommand>`

Manage MCP server configurations.

**Subcommands:**

- `han mcp list` - List configured MCP servers
- `han mcp enable <server>` - Enable an MCP server
- `han mcp disable <server>` - Disable an MCP server

**Implementation:** `lib/commands/mcp/index.ts`

#### `han metrics <subcommand>`

View and manage Han usage metrics.

**Implementation:** `lib/commands/metrics/index.ts`

## UI Components

### PluginSelector (Ink Component)

Interactive plugin selector used by `han plugin install`.

**Features:**

- Two modes: Selection mode and Search mode
- Keyboard navigation (↑↓ arrows, Space to toggle, Enter to confirm)
- Search functionality with live filtering
- Visual indicators (⭐ recommended, (installed), ✓ selected)
- Smooth mode transitions

**Mode Transitions:**

- Selection → Search: Select "🔍 Search for more plugins"
- Search → Navigation: Press Enter after typing query
- Navigation → Typing: Press ESC or type any character
- Search → Selection: Select "← Back to selection" or ESC when typing

**Implementation:** `lib/plugin-selector.tsx`, `lib/plugin-selector-wrapper.tsx`

**UI States:**

**Selection Mode:**

```
Select plugins to install (Space to toggle, Enter to confirm):

  [ ] jutsu-typescript ⭐
  [✓] jutsu-biome ⭐
  [ ] hashi-playwright-mcp
  > 🔍 Search for more plugins
    ✅ Done - Install selected plugins
    ❌ Cancel

2 plugin(s) selected • ⭐ = recommended • Use ↑↓ arrows to navigate
```

**Search Mode (Typing):**

```
Search for plugins:

Search: react█

Press Enter to navigate results, or continue typing to refine

  jutsu-react (Language): React hooks patterns and optimization
  jutsu-nextjs (Framework): Next.js development support
  ← Back to selection
```

**Search Mode (Navigating):**

```
Search for plugins:

Search: react

↑↓ navigate, Enter to add, ESC to continue typing

> jutsu-react (Language): React hooks patterns and optimization
  jutsu-nextjs (Framework): Next.js development support
  ← Back to selection
```

## File Organization

```
packages/bushido-han/
├── lib/
│   ├── main.ts                      # CLI entry point, command registration
│   ├── shared.ts                    # Shared utilities, types, Claude SDK integration
│   ├── codebase-analyzer.ts         # Codebase analysis for AI features
│   │
│   ├── commands/                    # Command definitions
│   │   ├── plugin/
│   │   │   ├── index.ts             # Plugin command group
│   │   │   ├── install.ts           # Install command
│   │   │   ├── list.ts              # List command
│   │   │   ├── search.ts            # Search command
│   │   │   ├── uninstall.ts         # Uninstall command
│   │   │   └── update.ts            # Update marketplace command
│   │   ├── hook/index.ts            # Hook commands
│   │   ├── mcp/index.ts             # MCP commands
│   │   ├── metrics/index.ts         # Metrics commands
│   │   └── aliases.ts               # Command aliases
│   │
│   ├── plugin-install.ts            # Plugin installation logic
│   ├── plugin-list.ts               # Plugin listing logic
│   ├── plugin-search.ts             # Plugin search logic
│   ├── plugin-selector.tsx          # Interactive selector UI (Ink)
│   ├── plugin-selector-wrapper.tsx  # TSX wrapper for selector
│   │
│   ├── explain.ts                   # Han configuration overview
│   ├── summary.ts                   # AI-powered improvement summary
│   └── gaps.ts                      # AI-powered gap analysis
│
└── blueprints/
    ├── distribution-architecture.md # Binary distribution docs
    └── cli-interface.md             # This file
```

## Technology Stack

- **Commander.js**: CLI argument parsing and command structure
- **Ink**: React-based terminal UI for interactive components
- **Claude Agent SDK**: AI-powered analysis features
- **cli-table3**: Table formatting for output
- **Bun**: Runtime and bundling

## AI Features Architecture

### Claude Agent SDK Integration

AI-powered commands (`summary`, `gaps`) use the Claude Agent SDK for repository analysis:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const agent = query({
  prompt: analysisPrompt,
  options: {
    model: "haiku",                    // Fast, cost-effective
    includePartialMessages: true,      // Stream responses
    allowedTools: ["read_file", "glob", "grep"],  // Read-only access
    pathToClaudeCodeExecutable: claudePath
  }
});

// Stream response
for await (const sdkMessage of agent) {
  if (sdkMessage.type === "assistant") {
    for (const block of sdkMessage.message.content) {
      if (block.type === "text") {
        process.stdout.write(block.text);
      }
    }
  }
}
```

**Key Design Decisions:**

- **Haiku model**: Fast and cost-effective for analysis tasks
- **Read-only tools**: Safety constraint (glob, grep, read_file only)
- **Streaming output**: Real-time feedback for better UX
- **Evidence-based**: AI must provide concrete examples from codebase

### Codebase Analysis

The `codebase-analyzer.ts` module provides statistics for AI context:

```typescript
interface CodebaseStats {
  packageJson?: PackageJson;
  frameworks: string[];
  languages: Map<string, number>;  // extension → file count
  configFiles: string[];
  totalFiles: number;
}
```

This data helps the AI:

- Detect technologies in use
- Understand project structure
- Make relevant plugin recommendations
- Provide evidence-based analysis

## Error Handling

All commands follow consistent error handling:

1. Try-catch blocks around async operations
2. User-friendly error messages to stderr
3. Exit code 1 on failure, 0 on success
4. Graceful degradation when possible

Example:

```typescript
try {
  await someOperation();
  process.exit(0);
} catch (error: unknown) {
  console.error(
    "Error message:",
    error instanceof Error ? error.message : error
  );
  process.exit(1);
}
```

## Installation Scopes

The CLI supports three installation scopes:

1. **User Scope** (`~/.claude/settings.json`)
   - Default for most plugins
   - Shared across all projects
   - MCP servers, general-purpose plugins

2. **Project Scope** (`.claude/settings.json`)
   - Project-specific plugins
   - Committed to version control
   - Team-shared configuration

3. **Local Scope** (`.claude/settings.local.json`)
   - Gitignored personal preferences
   - Developer-specific overrides
   - Not shared with team

## Future Enhancements

Potential improvements to consider:

1. **Plugin Dependencies**: Automatic installation of plugin dependencies
2. **Plugin Profiles**: Save/load plugin configurations
3. **Bulk Operations**: `han plugin install --all` for all recommended
4. **Version Management**: Pin/upgrade specific plugin versions
5. **Custom Prompts**: Allow custom analysis prompts for `summary`/`gaps`
6. **Export Reports**: Save AI analysis to markdown files
7. **Interactive Config**: `han init` wizard for initial setup
