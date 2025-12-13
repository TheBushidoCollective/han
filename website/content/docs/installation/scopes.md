---
title: "Installation Scopes"
description: "Choose where plugins are installed: user, local, or project scope."
---

Han supports three installation scopes that control where plugins are configured and who can access them. Understanding scopes helps you organize plugins effectively across your projects.

## User Scope (Default)

Plugins installed at user scope apply across all your projects:

```bash
# User scope is the default
han plugin install hashi-playwright-mcp

# Or be explicit
han plugin install hashi-playwright-mcp --scope user
```

**Configuration location:** `~/.claude/settings.json`

**Best for:**

- MCP server integrations (hashi-github, hashi-gitlab, hashi-playwright-mcp)
- General-purpose tools used across multiple projects
- Personal productivity plugins (do-* agents)
- Plugins you want available everywhere

**Advantages:**

- Install once, use everywhere
- No need to reinstall for each project
- Reduces duplication in project settings
- Ideal for personal tooling

## Project Scope

Plugins installed at project scope are shared with your team:

```bash
han plugin install jutsu-typescript --scope project
```

**Configuration location:** `.claude/settings.json` (committed to version control)

**Best for:**

- Project-specific validation hooks (jutsu-biome, jutsu-typescript, jutsu-markdown)
- Language-specific plugins needed by all contributors
- Enforcing team standards and quality checks
- Ensuring consistent development environment

**Advantages:**

- Team members get the same plugins automatically
- Version-controlled plugin configuration
- Enforces project standards across the team
- Great for CI/CD integration

## Local Scope

Plugins installed at local scope are personal and not shared:

```bash
han plugin install jutsu-playwright --scope local
```

**Configuration location:** `.claude/settings.local.json` (gitignored)

**Best for:**

- Personal experiments and testing
- Plugins you don't want to force on teammates
- Overriding project defaults for your workflow
- Development tools specific to your setup

**Advantages:**

- Private to your environment
- Won't affect other team members
- Perfect for trying out new plugins
- Override project settings without conflicts

## Scope Recommendations

Here's a quick guide for choosing scopes:

| Plugin Type | Recommended Scope | Example |
|-------------|-------------------|---------|
| MCP Servers | User | hashi-github, hashi-playwright-mcp |
| Language Validators | Project | jutsu-biome, jutsu-typescript |
| Team Standards | Project | jutsu-markdown, jutsu-shellcheck |
| Personal Tools | User or Local | do-* agents |
| Experiments | Local | Any plugin you're testing |

## How Scopes Interact

When plugins are installed at multiple scopes, Han merges the configurations with this precedence (later overrides earlier):

1. User scope (`~/.claude/settings.json`)
2. Project scope (`.claude/settings.json`)
3. Local scope (`.claude/settings.local.json`)

This means local settings always take precedence, allowing you to override team or personal defaults.

## Changing Scopes

To move a plugin between scopes, reinstall with the desired scope:

```bash
# Remove from current scope
han plugin remove jutsu-biome

# Install to new scope
han plugin install jutsu-biome --scope project
```

## Checking Plugin Scopes

View which scope each plugin is installed in:

```bash
han plugin list
```

The output shows the installation scope for each plugin, helping you understand your current configuration.

## Best Practices

1. **Start with user scope** for general tools, then move to project scope when your team needs them
2. **Use project scope** for validation hooks that enforce code quality standards
3. **Reserve local scope** for personal preferences and experiments
4. **Document project plugins** in your README so team members know what's expected
5. **Review scopes periodically** to ensure plugins are in the right place

## Next Steps

Now that you understand scopes, learn about:

- [Configuration files](/docs/configuration) to customize plugin behavior
- [Smart caching](/docs/configuration/caching) to optimize hook performance
- [CLI commands](/docs/cli) for advanced plugin management
