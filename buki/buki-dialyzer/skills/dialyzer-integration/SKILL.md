---
name: dialyzer-integration
description: Use when integrating Dialyzer into development workflows and CI/CD pipelines for Erlang/Elixir projects.
allowed-tools: []
---

# Dialyzer Integration

Integrating Dialyzer into development workflow and CI/CD pipelines.

## Local Development

### Initial Setup

```bash
# Install dialyxir
mix deps.get

# Build initial PLT (takes time first run)
mix dialyzer --plt

# Run analysis
mix dialyzer
```

### Incremental Analysis

```bash
# Only analyze changed files
mix dialyzer --incremental

# Force rebuild PLT
mix dialyzer --clean
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Dialyzer

on: [push, pull_request]

jobs:
  dialyzer:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Set up Elixir
        uses: erlef/setup-beam@v1
        with:
          elixir-version: '1.15'
          otp-version: '26'

      - name: Restore dependencies cache
        uses: actions/cache@v3
        with:
          path: deps
          key: ${{ runner.os }}-mix-${{ hashFiles('**/mix.lock') }}

      - name: Restore PLT cache
        uses: actions/cache@v3
        id: plt-cache
        with:
          path: priv/plts
          key: ${{ runner.os }}-plt-${{ hashFiles('**/mix.lock') }}

      - name: Install dependencies
        run: mix deps.get

      - name: Create PLTs
        if: steps.plt-cache.outputs.cache-hit != 'true'
        run: mix dialyzer --plt

      - name: Run Dialyzer
        run: mix dialyzer --format github
```

### GitLab CI

```yaml
dialyzer:
  stage: test
  script:
    - mix local.hex --force
    - mix local.rebar --force
    - mix deps.get
    - mix dialyzer
  cache:
    paths:
      - _build/
      - deps/
      - priv/plts/
```

## IDE Integration

### VS Code (ElixirLS)

```json
{
  "elixirLS.dialyzerEnabled": true,
  "elixirLS.dialyzerFormat": "dialyxir_long",
  "elixirLS.dialyzerWarnOpts": [
    "error_handling",
    "underspecs",
    "unmatched_returns"
  ]
}
```

### Vim/Neovim (coc-elixir)

```json
{
  "elixir.dialyzer.enabled": true
}
```

## Pre-commit Hooks

### Using Husky/Lefthook

```yaml
# lefthook.yml
pre-commit:
  commands:
    dialyzer:
      glob: "*.ex"
      run: mix dialyzer --incremental
```

### Git Hook Script

```bash
#!/bin/sh
# .git/hooks/pre-commit

echo "Running Dialyzer..."
mix dialyzer --incremental --quiet

if [ $? -ne 0 ]; then
  echo "Dialyzer found issues. Commit aborted."
  exit 1
fi
```

## Team Workflow

### Shared PLT Strategy

```elixir
# mix.exs
def project do
  [
    dialyzer: [
      plt_core_path: "priv/plts",
      plt_local_path: "priv/plts",
      plt_add_apps: [:mix, :ex_unit],
      # Shared across team via git
      plt_file: {:no_warn, "priv/plts/project.plt"}
    ]
  ]
end
```

### Baseline Approach

```bash
# Generate baseline
mix dialyzer > dialyzer_baseline.txt

# Check for new warnings
mix dialyzer | diff - dialyzer_baseline.txt
```

## Performance Optimization

### Parallel Analysis

```elixir
def project do
  [
    dialyzer: [
      flags: [:error_handling],
      # Use multiple cores
      plt_add_deps: :app_tree
    ]
  ]
end
```

### Selective Analysis

```bash
# Only check specific paths
mix dialyzer lib/critical/ test/important_test.exs
```

### Incremental Mode

```bash
# Much faster after initial run
mix dialyzer --incremental
```

## Monitoring and Reporting

### Custom Formatter

```elixir
# lib/custom_dialyzer_formatter.ex
defmodule CustomDialyzerFormatter do
  def format(warnings) do
    warnings
    |> Enum.map(&format_warning/1)
    |> Enum.join("\n")
  end

  defp format_warning(warning) do
    # Custom formatting logic
  end
end
```

### Metrics Collection

```bash
# Count warnings over time
mix dialyzer | grep -c "warning:" >> dialyzer_metrics.log
```

## Troubleshooting

### PLT Issues

```bash
# Remove and rebuild
rm -rf _build/dev/*.plt priv/plts/*.plt
mix dialyzer --plt
```

### Memory Issues

```bash
# Increase VM memory
elixir --erl "+hms 4096" -S mix dialyzer
```

### Slow Analysis

```bash
# Use incremental mode
mix dialyzer --incremental

# Or analyze subset
mix dialyzer lib/core/
```
