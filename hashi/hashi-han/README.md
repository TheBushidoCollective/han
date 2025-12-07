# hashi-han (DEPRECATED)

## ⚠️ DEPRECATED - Use han-core Instead

**This plugin has been deprecated and merged into `han-core`.**

All functionality from this plugin is now available in `han-core`. Please migrate:

```bash
# Uninstall this plugin
npx @thebushidocollective/han plugin uninstall hashi-han

# Install han-core instead
npx @thebushidocollective/han plugin install han-core
```

MCP server for running Han plugin hook commands via natural language.

## Overview

hashi-han exposes hook commands from your installed Han plugins as MCP tools, enabling natural language interaction with validation workflows.

Instead of remembering exact commands, you can say "run the TypeScript type check" or "lint the code with biome" and the MCP server handles the rest.

## Installation

```bash
npx @thebushidocollective/han plugin install hashi-han
```

## Features

- **Dynamic Tool Discovery**: Tools are generated from installed plugins. Install jutsu-typescript, get `jutsu_typescript_typecheck`.
- **Smart Caching**: All hook caching applies. Only runs when files have changed.
- **Multi-Directory Support**: Automatically discovers and runs in applicable directories.

## Available Tools

Tools are dynamically generated based on your installed plugins. Examples:

| Installed Plugin | Generated Tool | Description |
|-----------------|----------------|-------------|
| jutsu-typescript | `jutsu_typescript_typecheck` | Run TypeScript type checking |
| jutsu-biome | `jutsu_biome_lint` | Run Biome linting |
| jutsu-elixir | `jutsu_elixir_test` | Run Elixir tests |

## Tool Parameters

All tools accept these optional parameters:

- `verbose` (boolean): Show full command output. Default: false
- `failFast` (boolean): Stop on first failure. Default: true
- `directory` (string): Run only in a specific directory

## How It Works

1. The MCP server reads your installed plugins from Claude Code settings
2. For each plugin with hooks defined in `han-config.json`, it generates corresponding tools
3. When a tool is called, it executes the hook command with full caching support
4. Results are returned with success/failure status and output

## Requirements

- Claude Code with plugin support
- Han plugins installed via `npx @thebushidocollective/han plugin install`
