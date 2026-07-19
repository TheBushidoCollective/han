---
title: "Installation Methods"
description: "Install Han for Claude Code, OpenCode, or standalone use via curl, Homebrew, or plugin install."
---

Han works with Claude Code, OpenCode, Gemini CLI, Codex CLI, Kiro CLI, Google Antigravity, and as a standalone CLI. Choose the method that fits your workflow.

## Quick Install (Recommended)

The fastest way to get started is using the curl script:

```bash
curl -fsSL https://han.guru/install.sh | bash
```

This script:

- Downloads the latest Han binary for your platform
- Installs it to `~/.claude/bin/han`
- Adds the binary to your PATH
- Works on macOS, Linux, and Windows (WSL)

## Homebrew

If you prefer using Homebrew on macOS or Linux:

```bash
brew install thebushidocollective/tap/han
```

Homebrew installation provides:

- Automatic updates via `brew upgrade`
- Integration with your existing package management workflow
- Easy uninstallation via `brew uninstall han`

## Claude Code Plugin

If you're using Claude Code, you can install Han directly within the application:

```bash
/plugin install bushido@han
```

This method:

- Automatically installs the Han binary to `~/.claude/bin/han` on first session start
- Ensures hooks work immediately without manual setup
- Integrates seamlessly with Claude Code's plugin system
- Requires no manual PATH configuration

## Claude CLI

For users of the Claude CLI:

```bash
claude plugin install bushido@han
```

This integrates Han with the Claude CLI ecosystem and provides the same benefits as the Claude Code installation method.

## OpenCode

Han works with [OpenCode](https://opencode.ai) through a bridge plugin that translates OpenCode's event system into Han hook executions.

1. Install Han using any method above
2. Install Han plugins: `han plugin install --auto`
3. Add the bridge to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-plugin-han"]
}
```

Your Han validation hooks (biome, eslint, typescript, etc.) now run in OpenCode. See the [full OpenCode guide](/docs/installation/opencode) for details.

## Gemini CLI

Han works with [Gemini CLI](https://github.com/google-gemini/gemini-cli) through a Gemini extension that wires Han's hooks into Gemini's lifecycle events (BeforeTool, AfterTool, AfterAgent, SessionStart, SessionEnd).

See the [full Gemini CLI guide](/docs/installation/gemini-cli) for setup.

## Codex CLI

Han works with [OpenAI Codex CLI](https://developers.openai.com/codex/) through Codex's lifecycle hook system (`[features] hooks = true` plus a `hooks.json` wiring `codex-plugin-han` to PreToolUse, PostToolUse, Stop, and the other Codex events).

See the [full Codex CLI guide](/docs/installation/codex) for setup.

## Kiro CLI

Han works with [Kiro CLI](https://kiro.dev) through a Kiro agent definition that maps Kiro's agent hooks (agentSpawn, userPromptSubmit, preToolUse, postToolUse, stop) to Han's validation pipeline.

See the [full Kiro CLI guide](/docs/installation/kiro) for setup.

## Antigravity

Han works with [Google Antigravity IDE](https://antigravity.google) through a bridge plugin that exposes Han's plugin ecosystem (skills, disciplines, validation) as MCP tools. Antigravity lacks lifecycle hooks like Claude Code/OpenCode, so capabilities are surfaced as callable MCP tools instead.

See the [full Antigravity guide](/docs/installation/antigravity) for setup.

## Next Steps

After installing Han, you'll want to:

1. [Install plugins](/docs/installation/plugins) to add functionality
2. Configure your [installation scope](/docs/installation/scopes) preferences
3. Set up [configuration files](/docs/configuration) for your project

## Verifying Installation

After installation, verify Han is working:

```bash
han --version
```

You should see the current version number. If you encounter any issues, ensure `~/.claude/bin` is in your PATH.
