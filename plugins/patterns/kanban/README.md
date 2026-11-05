# Kanban

Kanban task and dependency management for AI coding agents using the YYLO Ledger CLI.

## Skills

- **ledger-tasks-yylo**: Retrieve any YYLO Ledger Record by ID, discover PDRs and artifacts, and manage tasks and dependencies.

## Installation

Install with the han CLI:

```bash
han plugin install kanban
```

In Claude Code, invoke the skill as `/kanban:ledger-tasks-yylo`. The YYLO Ledger CLI must be installed separately.

## Source

This skill is vendored from [yylo-dev/yylo-skills](https://github.com/yylo-dev/yylo-skills/tree/035023f66153d032d08da9203eb15f0cdaedb616/skills/ledger-tasks-yylo), the skill pack for the YYLO Ledger Kanban CLI (`yy ledger` / `yylo-ledger`). See [LICENSE](LICENSE) for the upstream MIT license and copyright notice. Please report skill-level issues upstream.
