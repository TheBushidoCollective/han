---
title: "Installation Methods"
description: "Four ways to install Han: curl script, Homebrew, Claude Code plugin, or Claude CLI."
---

Han can be installed in four different ways depending on your workflow and environment. Choose the method that best fits your needs.

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
claude plugin add bushido@han
```

This integrates Han with the Claude CLI ecosystem and provides the same benefits as the Claude Code installation method.

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
