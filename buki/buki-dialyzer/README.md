# Dialyzer

Advanced Dialyzer skills for static analysis of Erlang and Elixir code.

## Skills

- **dialyzer-configuration**: PLT management, analysis flags, warning filters
- **dialyzer-analysis**: Type specifications, common warnings, success typing
- **dialyzer-integration**: CI/CD setup, IDE integration, team workflows

## Hooks

- **Stop/SubagentStop**: Runs `mix dialyzer` validation on all Elixir projects

## Installation

For `han` CLI installation instructions, visit [han.guru](https://han.guru).

```bash
han install buki-dialyzer
```

## Usage

The Dialyzer hook automatically runs when you complete a task, checking for type errors and discrepancies in your Elixir code.

## Requirements

- Elixir project with mix.exs
- dialyxir dependency in mix.exs
