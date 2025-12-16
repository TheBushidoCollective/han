---
title: "From Scorched Earth to Boy Scout: How Han Learned Restraint"
description: "Han's checkpoint system brings focused, incremental improvement instead of overwhelming new adopters with every issue at once."
date: "2025-12-12"
author: "The Bushido Collective"
tags: ["checkpoints", "hooks", "adoption", "validation"]
category: "Technical Deep Dive"
---

Early Han was aggressive. Maybe too aggressive.

When you installed a jutsu plugin with validation hooks, Han went scorched earth. It found every lint error, every type issue, every test failure across your entire codebase. On the first session. Before you'd written a single line of code.

For maintainers of pristine codebases, this was fine. For everyone else - which is most of us - it was overwhelming. You'd install a plugin hoping for helpful validation, and immediately face hundreds of issues you didn't create and weren't ready to fix.

New adopters bounced. They disabled hooks or uninstalled plugins. The validation that was supposed to help became an obstacle.

## The Boy Scout Rule

The Boy Scout Rule says: leave the campground cleaner than you found it. Not pristine. Not spotless. Just *better*.

Han's new checkpoint system applies this principle to validation. Instead of identifying every problem in your codebase, hooks now focus on **the code you actually touched**. Work in a directory? Improve that directory. Leave the rest for later.

## How Checkpoints Work

When a Claude Code session starts, Han captures a checkpoint - a snapshot of file states at that moment. When hooks run at session end, they filter using this checkpoint.

**A file is only validated if:**

- It changed since the checkpoint (you modified it), AND
- It changed since the last hook run

This intersection ensures hooks analyze your actual work. Pre-existing issues in files you never opened are out of scope.

```
Session Start (t0):
├─ Checkpoint created
├─ File hashes captured for all project files

Your Work (t0 → t1):
├─ Modified: components/Button.tsx
├─ Untouched: utils/format.ts (has lint errors)

Session Stop (t1):
├─ Hook runs
├─ Filters to: components/Button.tsx only
└─ Pre-existing issues in utils/format.ts: not your problem today
```

## Incremental Improvement

The old approach had a certain logic: surface all problems so you know what exists. But in practice, this created paralysis:

- Developers felt blamed for issues they didn't cause
- The sheer volume made prioritization impossible
- Hooks got disabled, eliminating all validation
- Net result: worse quality, not better

The Boy Scout approach acknowledges reality: most codebases have accumulated issues. You can't fix everything at once, and demanding that creates learned helplessness.

Instead, checkpoint-based validation creates a sustainable path:

1. You touch a file
2. That file gets validated
3. You fix issues *in the code you were already changing*
4. Over time, frequently-touched code gets cleaner
5. Rarely-touched code stays as-is until relevant

## Technical Implementation

Checkpoints live in `~/.claude/projects/{slug}/han/checkpoints/`:

**Session Checkpoints**: `session_{session_id}.json`

- Created on SessionStart
- Contains SHA-256 hashes of all files
- Cleaned up after 24 hours

**Agent Checkpoints**: `agent_{agent_id}.json`

- Created for subagents (separate Claude instances)
- Scopes validation to each agent's work
- Prevents cross-contamination between parallel work

**Graceful Degradation**

- Missing checkpoint? Normal hook behavior
- Never silently skips validation
- Backwards compatible with existing workflows

## Configuration

Checkpoints are enabled by default. To disable (for intentional full-codebase sweeps):

```yaml
# han.yml
hooks:
  enabled: true
  checkpoints: false  # Validate all changed files, not just your session's
```

Most teams should keep checkpoints enabled. Disable only when deliberately addressing accumulated debt.

## Subagent Isolation

In complex workflows with spawned subagents, each gets its own checkpoint:

```
Main Session (session_abc):
├─ Checkpoint: session_abc.json
├─ Spawns Subagent 1 (agent_xyz):
│  ├─ Checkpoint: agent_xyz.json
│  └─ Works on feature-a/
└─ Spawns Subagent 2 (agent_def):
   ├─ Checkpoint: agent_def.json
   └─ Works on feature-b/
```

When Subagent 1 finishes, hooks only validate its changes. Subagent 2's work is isolated. No cascading failures.

## Getting Started

Checkpoints are available in Han v1.62.0+:

```bash
# Install or upgrade
curl -fsSL https://han.guru/install.sh | bash
# or
brew upgrade thebushidocollective/tap/han

# Checkpoints work automatically
# Just start a Claude Code session
```

If you previously disabled hooks because of overwhelming feedback, consider re-enabling them:

```yaml
# han.yml
hooks:
  enabled: true  # Give it another try
```

The experience is different now. Your session, your changes, your feedback. Nothing more.

---

**Resources:**

- [Han Documentation](https://han.guru/docs)
- [Checkpoint Blueprint](https://github.com/thebushidocollective/han/blob/main/blueprints/checkpoint-system.md)
- [Install Han](https://han.guru/install)
