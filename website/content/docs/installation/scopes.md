---
title: "Installation Scopes"
description: "Choose where plugins are installed: project or local scope, and why Han refuses user scope."
---

Han installs plugins at one of two scopes, which controls where the plugin is configured and who on your team gets it.

## Project Scope (Default)

Plugins installed at project scope are shared with your team:

```bash
# Project scope is the default
han plugin install typescript

# Or be explicit
han plugin install typescript --scope project
```

**Configuration location:** `.claude/settings.json` (committed to version control)

**Best for:**

- Project-specific validation hooks (biome, typescript, markdown)
- Language-specific plugins needed by all contributors
- Enforcing team standards and quality checks
- MCP server integrations the whole team should share

**Advantages:**

- Team members get the same plugins automatically
- Version-controlled plugin configuration
- Enforces project standards across the team
- Works in CI, where there is no interactive user profile

## Local Scope

Plugins installed at local scope are personal and not shared:

```bash
han plugin install playwright --scope local
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
- Good for trying out a new plugin
- Overrides project settings without conflicts

## Why Not User Scope

`han plugin install --scope user` is rejected:

```text
Error: --scope "user" is not supported. Han plugins must be installed at project or local scope.
Use --scope "project" (default) or --scope "local" instead.
```

Han plugins carry validation hooks that run against a specific repository. Installing them globally in `~/.claude/settings.json` would fire a project's linters inside every unrelated project you open, and would make the set of active quality gates invisible to your team.

User scope is not gone everywhere, though. `han plugin list --scope user` and `han plugin uninstall --scope user` both work, because Han still has to see and remove plugins written to `~/.claude/settings.json` by an older version or by hand. In fact `uninstall` defaults to `user`, so pass `--scope project` explicitly when removing a plugin you installed normally.

## Scope Selection

When you omit `--scope`, Han does not just assume `project`:

1. If Han is already configured in `.claude/settings.local.json` or `.claude/settings.json`, it reuses that existing scope and tells you which one
2. Otherwise it installs to `project` and prints `Installing to project scope (.claude/settings.json)`

This keeps a repo from ending up with half its plugins in one file and half in the other.

## Scope Recommendations

| Plugin Type | Recommended Scope | Example |
|-------------|-------------------|---------|
| Validation plugins | Project | biome, typescript |
| Team standards | Project | markdown, shellcheck |
| MCP servers the team shares | Project | github, playwright-mcp |
| Discipline agents | Project or Local | frontend, backend |
| Experiments | Local | Any plugin you're testing |

## How Scopes Interact

Claude Code merges settings files with this precedence, later overriding earlier:

1. User scope (`~/.claude/settings.json`)
2. Project scope (`.claude/settings.json`)
3. Local scope (`.claude/settings.local.json`)

Local settings win, so you can override a team default for yourself without touching the shared file.

## Changing Scopes

To move a plugin between scopes, uninstall it from the old scope and install it to the new one:

```bash
# Remove from its current scope
han plugin uninstall biome --scope local

# Install to the new scope
han plugin install biome --scope project
```

## Checking Plugin Scopes

View which scope each plugin is installed in:

```bash
han plugin list

# Or narrow to one scope
han plugin list --scope project
```

## Best Practices

1. **Default to project scope** so quality gates are visible and shared
2. **Reserve local scope** for personal preferences and experiments
3. **Document project plugins** in your README so team members know what's expected
4. **Pass `--scope` explicitly when uninstalling**, since `uninstall` defaults to `user`
5. **Review scopes periodically** to ensure plugins are in the right place

## Next Steps

Now that you understand scopes, learn about:

- [Configuration files](/docs/configuration) to customize plugin behavior
- [Smart caching](/docs/configuration/caching) to optimize hook performance
- [CLI commands](/docs/cli) for advanced plugin management
