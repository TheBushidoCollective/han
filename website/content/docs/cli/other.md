---
title: "Other Commands"
description: "Version, help, diagnostics, storage, parsing, and the remaining top-level han commands."
---

Everything the `han` CLI exposes outside the plugin and hook command groups.

## `han --version`

Show the current Han version, along with the binary location and config status.

### Usage

```bash
han --version
han -V
```

### Example

```bash
# Check version
$ han --version
1.61.6

# Use in scripts
if [ "$(han --version | head -1 | cut -d. -f1)" -ge 2 ]; then
  echo "Han v2+ detected"
fi
```

## `han --help`

Show help information for Han commands.

### Usage

```bash
# Show main help
han --help
han -h

# Show help for specific command
han plugin --help
han hook run --help
```

### Command groups

| Command | Purpose |
|---------|---------|
| `plugin` | Manage Han plugins |
| `create` | Scaffold new Han resources |
| `hook` | Hook utilities |
| `mcp` | Start a Han MCP server |
| `blueprints` | Manage technical blueprint documentation |
| `memory` | Memory system status |
| `keep` | Scoped key-value storage across sessions |
| `parse` | JSON and YAML parsing utilities |
| `reindex` | Clear the database and reindex from JSONL logs |
| `worktree` | Git worktree management |
| `coordinator` | Manage the coordinator daemon |
| `config` | Manage Han CLI configuration |
| `auth` | Manage authentication with the Han team server |
| `sync` | Manage data synchronization to the team platform |
| `browse` | Start the Han system browser dashboard |
| `doctor` | Run diagnostics |
| `setup` | Generate config files for non-Claude-Code agents |
| `completion` | Generate a shell completion script |
| `install` | Alias for `plugin install --auto` |
| `uninstall` | Remove the Han marketplace and plugins |

## Updating Han

There is no `han update` subcommand. Update through whichever channel installed the binary:

**Homebrew:**

```bash
brew update
brew upgrade thebushidocollective/tap/han
```

**curl installer:**

```bash
curl -fsSL https://han.guru/install.sh | bash
```

**npm:**

```bash
npm update -g @thebushidocollective/han
```

To refresh the plugin marketplace cache rather than the binary, use `han plugin update-marketplace`.

## `han doctor`

Run diagnostics against your Han installation: binary location, config file discovery, coordinator health, and index database status.

### Usage

```bash
han doctor

# Machine-readable
han doctor --json
```

### Options

| Option | Description |
|--------|-------------|
| `--json` | Output results as JSON |

## `han browse`

Start the Han system browser dashboard, a local UI for searching session history and inspecting hook activity.

### Usage

```bash
han browse

# Pick a port
han browse --port 41956

# Run the local dev server over HTTP instead of opening the remote dashboard
han browse --local
```

### Options

| Option | Description |
|--------|-------------|
| `-p, --port <port>` | Port to run the server on (default: 41956) |
| `-l, --local` | Run the local dev server for offline use |

## `han setup`

Generate config files so agents other than Claude Code can invoke Han's hook dispatch.

### Usage

```bash
# All supported agents
han setup

# One agent
han setup --agent codex

# Overwrite existing files
han setup --agent opencode --force
```

### Options

| Option | Description |
|--------|-------------|
| `--agent <name>` | One of `codex`, `kiro`, `gemini`, `opencode`, `agents-md` |
| `--all` | Generate configs for all agents (default) |
| `--force` | Overwrite existing config files |

## `han keep`

Scoped key-value storage for persisting state across sessions.

### Usage

```bash
# Save (reads stdin when no content is given)
han keep save build-notes "release blocked on flaky test"
cat notes.md | han keep save notes

# Read it back
han keep load build-notes

# Inspect and clean up
han keep list
han keep delete build-notes
han keep clear
```

Every subcommand takes `--global` or `--repo` to choose the storage scope.

## `han parse`

JSON and YAML utilities so plugin hooks do not need `jq` or `yq` on the box.

```bash
# Extract a path from JSON on stdin
echo '{"a":{"b":[1,2]}}' | han parse json a.b[0]

# Set a value
echo '{}' | han parse json-set a.b 42

# Validate a shape
echo '{"name":"x"}' | han parse json-validate --schema '{"name":"string"}'

# YAML, including markdown frontmatter
cat SKILL.md | han parse yaml name
cat SKILL.md | han parse yaml-set version 2.0.0

# Convert between the two
han parse yaml-to-json < config.yml
han parse json-to-yaml < config.json
```

## `han reindex`

Clear the index database and rebuild it from the JSONL session logs.

```bash
# Rebuild (default subcommand)
han reindex
han reindex --verbose

# Query the index, for testing
han reindex search "auth refactor"

# Check index state
han reindex status
```

## `han memory`

Prints the current state of the memory system. Memory is indexed automatically from Claude Code session transcripts, so there is nothing to run by hand; use `han browse` to search session history.

```bash
han memory
```

## `han worktree`

Git worktree management for parallel development.

```bash
han worktree add ../feature-x feature/x --create-branch
han worktree list --json
han worktree discover
han worktree remove ../feature-x --force
han worktree prune --dry-run
```

## `han coordinator`

Manage the coordinator daemon that indexes sessions in the background.

```bash
han coordinator start
han coordinator status
han coordinator logs --follow
han coordinator restart
han coordinator stop
```

On macOS, `han coordinator launchd install` registers the daemon to start on login, with matching `uninstall` and `status` subcommands.

## `han completion`

Generate a shell completion script.

```bash
han completion bash
han completion zsh
han completion fish
```

## `han install` and `han uninstall`

Top-level aliases kept for backwards compatibility.

```bash
# Same as: han plugin install --auto
han install
han install --scope local

# Remove the Han marketplace and all its plugins
han uninstall
```

`han install --scope` accepts `project` (default) or `local`.

## Learn More

- [Installation Guide](/docs/installation) - Getting started with Han
- [Plugin Commands](/docs/cli/plugins) - Managing plugins
- [Hook Commands](/docs/cli/hooks) - Running hooks
