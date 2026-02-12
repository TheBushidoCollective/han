---
name: cli-interface
summary: Interactive CLI with Commander.js, Ink UI, and AI-powered plugin discovery via Agent SDK
---

# Han CLI Interface

## Overview

The Han CLI provides a command-line interface for managing Claude Code plugins from The Bushido Collective's marketplace. It uses Commander.js for argument parsing, Ink (React for CLI) for interactive UIs, and Claude Agent SDK for AI-powered features like plugin discovery and repository analysis.

## Technology Stack

- **Commander.js**: CLI argument parsing and command structure
- **Ink**: React-based terminal UI for interactive components
- **Claude Agent SDK**: AI-powered analysis features (summary, gaps)
- **Bun**: Runtime and bundling
- **YAML**: Plugin configuration parsing

## Entry Point

`packages/han/lib/main.ts` - Main CLI entry point

Key responsibilities:
- Command registration via Commander.js
- Re-execution logic for `hanBinary` override (development mode)
- Version information with binary location
- Telemetry initialization
- Shell completion support

### Re-execution Pattern

The CLI supports development mode via `.claude/han.yml`:

```yaml
hanBinary: bun "$(git rev-parse --show-toplevel)/packages/han/lib/main.ts"
```

When set, all `han` CLI calls delegate to the local TypeScript source instead of the installed binary. This enables live development without rebuilding/reinstalling.

## Command Structure

```
han [command] [options]
```

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
  - `project`: .claude/settings.json (project-specific, committed)
  - `local`: .claude/settings.local.json (gitignored, personal)

**Examples:**

```bash
# Interactive installation
han plugin install

# Auto-detect recommended plugins
han plugin install --auto

# Install specific plugin
han plugin install typescript

# Search-based installation (if not exact match)
han plugin install playwright
# Shows: playwright, playwright-mcp, etc.

# Install to project scope
han plugin install biome --scope project

# Install multiple plugins
han plugin install typescript react nextjs
```

**Implementation:** `lib/commands/plugin/install.ts`

**Features:**

- Always includes `bushido` as dependency
- Validates plugins against marketplace
- Interactive selector for ambiguous queries (uses `PluginSelector` component)
- Shows installation confirmation and restart prompt

#### `han plugin list`

List all installed plugins across all scopes.

**Options:**

- `--scope <scope>` - Filter by scope: `user`, `project`, `local`, or `all` (default)

**Implementation:** `lib/commands/plugin/list.ts`

#### `han plugin search [query]`

Search for plugins in the Han marketplace.

**Behavior:**

- Without query: Shows all available plugins
- With query: Filters by name, description, keywords, and category

**Implementation:** `lib/commands/plugin/search.ts`

#### `han plugin uninstall <plugin-names...>`

Uninstall one or more plugins.

**Options:**

- `--scope <scope>` - Uninstall from specific scope (default: `user`)

**Implementation:** `lib/commands/plugin/uninstall.ts`

#### `han plugin update`

Update the local marketplace cache.

**Implementation:** `lib/commands/plugin/update.ts`

#### `han plugin validate [path]`

Validate plugin structure and configuration.

**Implementation:** `lib/commands/plugin/validate.ts`

#### `han plugin generate-hooks`

Generate hooks.json from han-plugin.yml.

**Implementation:** `lib/commands/plugin/generate-hooks.ts`

### Browse Command

#### `han browse`

Start the Han system browser dashboard.

**Options:**

- `-p, --port <port>` - Port to run the server on (default: 41956)
- `-l, --local` - Run local dev server with HTTP (for offline use; default: open remote dashboard)

**Implementation:** `lib/commands/browse/index.ts`

See [Browse Architecture](./browse-architecture.md) for details.

### Hook Commands

#### `han hook context`

Output session context for hooks.

**Implementation:** `lib/commands/hook/context.ts`

#### `han hook dispatch <event>`

Dispatch hooks for an event (SessionStart, UserPromptSubmit, etc.).

**Implementation:** `lib/commands/hook/dispatch.ts`

#### `han hook orchestrate <event>`

Orchestrate hooks from multiple plugins for an event.

**Implementation:** `lib/commands/hook/orchestrate.ts`

#### `han hook run <plugin> <hook>`

Run a specific hook from a plugin.

**Options:**

- `--cached` - Skip if no changes detected
- `--cache=false` - Force re-run ignoring cache

**Implementation:** `lib/commands/hook/run.ts`

#### `han hook list`

List configured hooks.

**Implementation:** `lib/commands/hook/list.ts`

#### `han hook wait`

Wait for hooks to complete (used in async hook execution).

**Implementation:** `lib/commands/hook/wait.ts`

### MCP Commands

#### `han mcp`

Start the Han MCP server (stdio JSON-RPC).

**Capabilities:**

- Exposes hook commands as tools (e.g., `jutsu_typescript_lint`)
- Unified memory tool (auto-routing to personal, team, rules)
- Dynamic discovery of exposed MCP servers from plugins

**Implementation:** `lib/commands/mcp/server.ts`

#### `han mcp blueprints`

Start the Blueprints MCP server.

**Implementation:** `lib/commands/mcp/blueprints.ts`

#### `han mcp memory`

Start the Memory DAL MCP server (read-only search tools for Memory Agent).

**Implementation:** `lib/commands/mcp/dal.ts`

See [MCP Server](./mcp-server.md) for architecture details.

### Memory Command

#### `han memory <question>`

Query Han memory system (personal, team, rules).

**Implementation:** `lib/commands/memory/index.ts`

See [Han Memory System](./han-memory-system.md) for architecture.

### Coordinator Commands

#### `han coordinator start`

Start the coordinator daemon.

**Implementation:** `lib/commands/coordinator/daemon.ts`

#### `han coordinator stop`

Stop the coordinator daemon.

#### `han coordinator status`

Check coordinator health.

**Implementation:** `lib/commands/coordinator/health.ts`

#### `han coordinator install` (macOS only)

Install coordinator as launchd service.

**Implementation:** `lib/commands/coordinator/launchd/install.ts`

See [Coordinator Daemon](./coordinator-daemon.md) for architecture.

### Blueprints Commands

#### `han blueprints list`

List all blueprints.

#### `han blueprints read <name>`

Read a specific blueprint.

#### `han blueprints write <name>`

Write a blueprint.

**Implementation:** `lib/commands/blueprints/index.ts`

### Other Commands

#### `han keep <note>`

Save a note to personal memory.

**Implementation:** `lib/commands/keep/index.ts`

#### `han parse <jsonl-file>`

Parse and display JSONL transcript.

**Implementation:** `lib/commands/parse/index.ts`

#### `han index`

Re-index JSONL transcripts to database.

**Implementation:** `lib/commands/index/index.ts`

#### `han create plugin <name>`

Create a new plugin from template.

**Implementation:** `lib/commands/create/plugin.ts`

#### `han setup`

Setup hook for plugin installation.

**Implementation:** `lib/commands/setup/index.ts`

#### `han doctor`

Diagnose han installation and configuration.

**Implementation:** `lib/commands/doctor.ts`

#### `han worktree list`

List git worktrees.

**Implementation:** `lib/commands/worktree/list.ts`

#### `han completion`

Generate shell completion scripts (bash, zsh, fish).

**Implementation:** `lib/commands/completion/index.ts`

## Interactive UI Components

### PluginSelector (Ink Component)

Interactive plugin selector used by `han plugin install`.

**File:** `lib/plugin-selector.tsx`

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

**UI States:**

**Selection Mode:**

```
Select plugins to install (Space to toggle, Enter to confirm):

  [ ] typescript ⭐
  [✓] biome ⭐
  [ ] playwright-mcp
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

  react (Language): React hooks patterns and optimization
  nextjs (Framework): Next.js development support
  ← Back to selection
```

**Search Mode (Navigating):**

```
Search for plugins:

Search: react

↑↓ navigate, Enter to add, ESC to continue typing

> react (Language): React hooks patterns and optimization
  nextjs (Framework): Next.js development support
  ← Back to selection
```

## File Organization

```
packages/han/lib/
├── main.ts                           # CLI entry point, command registration
├── shared.ts                         # Shared utilities, types
├── config/                           # Configuration management
│   ├── claude-settings.ts            # Claude Code settings
│   └── han-settings.ts               # Han configuration
├── commands/                         # Command definitions
│   ├── plugin/
│   │   ├── index.ts                  # Plugin command group
│   │   ├── install.ts                # Install command
│   │   ├── list.ts                   # List command
│   │   ├── search.ts                 # Search command
│   │   ├── uninstall.ts              # Uninstall command
│   │   ├── update.ts                 # Update marketplace command
│   │   ├── validate.ts               # Validate plugin command
│   │   └── generate-hooks.ts         # Generate hooks.json
│   ├── browse/                       # Browse dashboard
│   │   ├── index.ts                  # Browse command
│   │   ├── server.ts                 # GraphQL + Vite server
│   │   └── watch.ts                  # File watcher
│   ├── hook/                         # Hook commands
│   │   ├── index.ts                  # Hook command group
│   │   ├── context.ts                # Session context
│   │   ├── dispatch.ts               # Dispatch hooks
│   │   ├── orchestrate.ts            # Orchestrate hooks
│   │   ├── run.ts                    # Run specific hook
│   │   ├── list.ts                   # List hooks
│   │   └── wait.ts                   # Wait for completion
│   ├── mcp/                          # MCP servers
│   │   ├── index.ts                  # MCP command group
│   │   ├── server.ts                 # Main MCP server
│   │   ├── blueprints.ts             # Blueprints MCP server
│   │   ├── dal.ts                    # Memory DAL MCP server
│   │   ├── exposed-tools.ts          # Exposed MCP discovery
│   │   └── backend-pool.ts           # MCP backend pool
│   ├── coordinator/                  # Coordinator daemon
│   │   ├── index.ts                  # Coordinator commands
│   │   ├── daemon.ts                 # Daemon lifecycle
│   │   ├── server.ts                 # GraphQL server
│   │   ├── health.ts                 # Health check
│   │   ├── tls.ts                    # TLS certificate
│   │   └── launchd/install.ts        # macOS launchd
│   ├── memory/index.ts               # Memory query
│   ├── blueprints/index.ts           # Blueprint commands
│   ├── keep/index.ts                 # Keep notes
│   ├── parse/index.ts                # Parse JSONL
│   ├── index/index.ts                # Re-index
│   ├── create/                       # Create plugin
│   ├── setup/index.ts                # Setup hook
│   ├── doctor.ts                     # Diagnose installation
│   ├── worktree/                     # Git worktree commands
│   ├── completion/                   # Shell completions
│   └── aliases.ts                    # Command aliases
├── plugin-selector.tsx               # Interactive selector UI (Ink)
├── plugin-selector-wrapper.tsx       # TSX wrapper for selector
├── memory/                           # Memory system
├── events/                           # Event logging
└── telemetry/                        # OpenTelemetry
```

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

## Related Systems

- [MCP Server](./mcp-server.md) - MCP tool exposure
- [Hook System](./hook-system.md) - Hook execution
- [Browse Architecture](./browse-architecture.md) - Browse dashboard
- [Coordinator Daemon](./coordinator-daemon.md) - Background service
- [Han Memory System](./han-memory-system.md) - Memory queries
- [Settings Management](./settings-management.md) - Configuration precedence