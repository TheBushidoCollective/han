---
title: "Han Learns: Automatic Plugin Detection for Your Projects"
description: "Introducing intelligent plugin auto-detection that watches what you're building and automatically installs the right Han plugins for your project."
date: "2026-02-02"
author: "The Bushido Collective"
tags: ["han", "plugins", "auto-detection", "developer-experience"]
category: "Features"
---

One of the biggest friction points with plugin systems is knowing what to install. You start a new project, type some code, and then... wait, do I need the TypeScript plugin? What about Biome? Is there a plugin for Relay?

Today we're introducing **Han Learns** - a feature that watches what you're building and automatically installs the right plugins for your project.

## The Problem with Manual Installation

When you start using Han, you typically run `han plugin install --auto` to detect what plugins your project needs. This works great for established projects with clear marker files.

But what about:

- **New projects** where you're still figuring out the stack?
- **Adding new tools** mid-project (like adding Playwright for E2E tests)?
- **Monorepos** where different packages use different technologies?

You'd have to remember to re-run the detection, or manually install plugins as you add dependencies. That's friction we wanted to eliminate.

## How Han Learns Works

Han Learns uses a `PostToolUse` hook that triggers whenever Claude writes or edits a file. Here's what happens:

1. **File change detected**: You write a `tsconfig.json` or add a `biome.json`
2. **Directory scan**: Han walks up the directory tree from the modified file
3. **Pattern matching**: Each directory is checked against plugin `dirs_with` patterns
4. **Automatic installation**: Matching plugins are installed to project scope

```
You write: packages/web/biome.json

Han detects:
  - packages/web/biome.json matches jutsu-biome (dirs_with: ["biome.json"])

Han runs:
  claude plugin install jutsu-biome@han --scope project

You see:
  ✓ Auto-installed Han plugin(s): jutsu-biome
  These plugins were detected based on files in your project.
```

No AI involved - just fast, deterministic pattern matching against known plugin definitions.

## The dirs_with Pattern System

Every Han plugin can define marker files that indicate it should be used:

```yaml
# jutsu-typescript/han-plugin.yml
hooks:
  typecheck:
    command: "npx -y --package typescript tsc --noEmit"
    dirs_with:
      - "tsconfig.json"
    if_changed:
      - "**/*.{ts,tsx,mts,cts}"
```

```yaml
# jutsu-biome/han-plugin.yml
hooks:
  lint:
    command: "npx -y @biomejs/biome check --write"
    dirs_with:
      - "biome.json"
    if_changed:
      - "**/*.{js,jsx,ts,tsx,json,jsonc}"
```

```yaml
# jutsu-relay/han-plugin.yml
hooks:
  codegen:
    command: "npx relay-compiler"
    dirs_with:
      - "relay.config.json"
      - "relay.config.js"
```

When you create any of these marker files, Han automatically knows what plugin to install.

## Smart Session Tracking

Han Learns is smart enough to not spam you with repeated suggestions. Once a plugin is suggested in a session:

1. It's recorded in session-specific storage
2. Won't be suggested again in that session
3. Fresh sessions get fresh detection

This means you can freely edit files without seeing the same suggestion repeatedly.

## Configuring Learn Mode

Not everyone wants fully automatic plugin installation. You can control this behavior in your `han.yml`:

```yaml
# han.yml (project root) or .claude/han.yml

learn:
  mode: auto  # "auto" | "ask" | "none"
```

**Available modes:**

- **`auto`** (default): Automatically install detected plugins
- **`ask`**: Suggest plugins but don't install - shows what would be installed with the command to run
- **`none`**: Disable auto-detection entirely

Example with "ask" mode:

```
Han detected plugin(s) that may be useful: jutsu-biome, jutsu-typescript
These plugins were detected based on files in your project.
To install, run: claude plugin install jutsu-biome@han jutsu-typescript@han --scope project
```

This gives you full control over what gets installed while still benefiting from Han's detection capabilities.

## Project Scope by Default

Auto-detected plugins install to **project scope** (`.claude/settings.json`), not user scope. This means:

- Plugins are specific to your project
- Team members get them when they clone your repo
- Different projects can have different plugin sets
- Your global settings stay clean

## Hooks Work Immediately

Here's the magic: because Han's core plugin orchestrates all hooks dynamically, newly installed plugin hooks work **immediately in the same session**.

When Han installs a plugin like `jutsu-typescript`:
- **Hooks** (like typecheck on Stop) are active immediately - Han's orchestrator dynamically discovers and runs them

What requires a restart:
- **MCP servers** - connections are established at Claude Code startup
- **Skills/Commands** - may require restart depending on how Claude Code caches plugin content

So when you see:
```
✓ Auto-installed Han plugin(s): jutsu-biome
Hooks from these plugins are now active. MCP servers require a restart.
```

You can keep working - the validation hooks are already running. The biome linting will trigger on your next Stop event.

## VCS Integration Detection

Han Learns also detects your version control system and automatically installs the appropriate integration plugin:

- **GitHub** remote → `hashi-github` (Issues, PRs, Actions, code search)
- **GitLab** remote → `hashi-gitlab` (Issues, MRs, CI/CD)

This happens automatically when Han detects your git remote URL:

```
You push to: git@github.com:myorg/myproject.git

Han detects:
  - Remote host github.com matches hashi-github

Han runs:
  claude plugin install hashi-github@han --scope project

You see:
  ✓ Auto-installed Han plugin(s): hashi-github
```

This means your Claude session automatically gets access to your repo's issues, PRs, and other VCS features - no configuration needed.

## Real-World Example

Let's say you're starting a new Next.js project:

**Day 1**: You create `package.json` and `tsconfig.json`
```
✓ Auto-installed Han plugin(s): jutsu-typescript
```

**Day 2**: You add `biome.json` for linting
```
✓ Auto-installed Han plugin(s): jutsu-biome
```

**Day 3**: You create `playwright.config.ts` for E2E tests
```
✓ Auto-installed Han plugin(s): jutsu-playwright
```

**Day 4**: You add `relay.config.json` for GraphQL
```
✓ Auto-installed Han plugin(s): jutsu-relay
```

Each time you add a technology to your project, Han learns about it and installs the appropriate validation hooks. No manual intervention required.

## Under the Hood

The implementation is straightforward:

1. **PostToolUse hook** watches Edit/Write/NotebookEdit tools
2. **Directory walking** starts from the modified file's parent
3. **Pattern matching** checks each directory against marketplace plugins
4. **Claude CLI installation** ensures proper marketplace cloning

```typescript
// Walk up directory tree
while (currentDir.length >= projectRoot.length) {
  for (const plugin of plugins) {
    if (pluginMatchesDirectory(plugin, currentDir)) {
      installPlugin(plugin.name);
    }
  }
  currentDir = dirname(currentDir);
}
```

Using `claude plugin install` instead of just modifying settings ensures the marketplace is properly cloned and plugins are fully available.

## What's Next

Han Learns is just the beginning of making plugin management invisible. Future improvements might include:

- **Dependency detection**: Scanning `package.json` for dependencies that have Han plugins
- **Framework detection**: Understanding project structure beyond marker files
- **Plugin recommendations**: Suggesting related plugins based on what you've installed

For now, Han Learns solves the most common case: you add a config file, and the right plugin just appears.

## Try It Now

Han Learns is included in the latest Han core plugin. If you have Han installed, it's already working.

Create a new config file in your project and watch Han learn:

```bash
# In a new directory
echo '{}' > tsconfig.json
# Han will detect and install jutsu-typescript

echo '{}' > biome.json
# Han will detect and install jutsu-biome
```

Or just start building - Han will figure out the rest.

---

*The best plugin system is one you don't have to think about. Han Learns makes plugins invisible - they just appear when you need them.*
