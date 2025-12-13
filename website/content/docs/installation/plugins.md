---
title: "Installing Plugins"
description: "How to install Han plugins using interactive mode or auto-detection."
---

Once Han is installed, you can add plugins to extend its functionality. Han provides several ways to install plugins, from interactive selection to automatic detection based on your project.

## Interactive Mode

The simplest way to install plugins is using interactive mode:

```bash
han plugin install
```

This launches an interactive UI that lets you:

- Browse all available plugins
- See descriptions and categories (jutsu, do, hashi)
- Select multiple plugins to install
- View plugin dependencies

Use arrow keys to navigate, Space to select, and Enter to confirm.

## Auto-Detection

For a hands-off approach, let Han detect which plugins your project needs:

```bash
han plugin install --auto
```

Han analyzes your project and automatically installs relevant plugins:

- **jutsu** plugins based on detected languages and tools (biome.json → jutsu-biome, tsconfig.json → jutsu-typescript)
- **hashi** plugins for common MCP integrations
- **do** plugins for specialized workflows

This is perfect for:

- Setting up new projects quickly
- Ensuring you have the right validation hooks
- Onboarding team members to a project

## Installing Specific Plugins

You can also install plugins by name:

```bash
# Single plugin
han plugin install jutsu-biome

# Multiple plugins
han plugin install jutsu-biome jutsu-typescript hashi-github
```

Plugin names follow these patterns:

- **jutsu-{tool}**: Language and tool plugins (jutsu-biome, jutsu-bun, jutsu-typescript)
- **do-{discipline}**: Specialized agent workflows (do-claude-plugin-development)
- **hashi-{service}**: MCP server integrations (hashi-github, hashi-playwright-mcp)

## Within Claude Code

If you're using Claude Code, you can install plugins directly in the application:

```bash
/plugin install jutsu-biome@han
```

The `@han` suffix specifies the marketplace source. This method integrates with Claude Code's plugin management system.

## Listing Installed Plugins

To see what's already installed:

```bash
han plugin list
```

This shows:

- Plugin names and versions
- Installation scope (user, project, or local)
- Whether plugins are enabled
- Plugin descriptions

## Updating Plugins

Han plugins are automatically updated when you run:

```bash
han plugin install --auto
```

Or update specific plugins:

```bash
han plugin install jutsu-biome --force
```

## Removing Plugins

To uninstall a plugin:

```bash
han plugin remove jutsu-biome
```

This removes the plugin from your settings and cleans up any associated configuration.

## Next Steps

After installing plugins, you may want to:

- Configure [installation scopes](/docs/installation/scopes) to control where plugins are installed
- Set up [configuration files](/docs/configuration) to customize plugin behavior
- Learn about [smart caching](/docs/configuration/caching) for faster hook execution
