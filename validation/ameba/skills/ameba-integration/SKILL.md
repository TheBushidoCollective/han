---
name: ameba-integration
description: Use when integrating Ameba into development workflows including CI/CD pipelines, pre-commit hooks, GitHub Actions, and automated code review processes.
allowed-tools:
  - Bash
  - Read
---

# Ameba Integration

Integrate Ameba into your development workflow for automated Crystal code quality checks in CI/CD pipelines, pre-commit hooks, and code review processes.

## Integration Overview

Ameba can be integrated at multiple points in your development workflow:

- **Pre-commit hooks** - Catch issues before they're committed
- **CI/CD pipelines** - Enforce quality gates in automated builds
- **GitHub Actions** - Automated PR reviews and status checks
- **Editor integration** - Real-time feedback while coding
- **Code review** - Automated comments on pull requests
- **Pre-push hooks** - Final check before pushing to remote

## Command-Line Usage

### Basic Commands

```bash
# Run Ameba on entire project
ameba

# Run on specific files
ameba src/models/user.cr

# Run on specific directories
ameba src/services/

# Run with specific configuration
ameba --config .ameba.custom.yml

# Generate default configuration
ameba --gen-config

# Auto-fix correctable issues
ameba --fix

# Only check specific rules
ameba --only Style/RedundantReturn

# Exclude specific rules
ameba --except Style/LargeNumbers

# Format output
ameba --format json
ameba --format junit
ameba --format flycheck

# Explain issues at specific location
ameba --explain src/models/user.cr:10:5

# Run with all output
ameba --all

# Fail silently on no issues
ameba --silent
```

### Output Formats

```bash
# Default: Human-readable
ameba
# Output:
# src/user.cr:10:5: Style/RedundantReturn: Redundant return detected

# JSON format (for parsing)
ameba --format json
# Output: {"sources": [...], "summary": {...}}

# JUnit XML (for CI integration)
ameba --format junit > ameba-results.xml

# Flycheck format (for Emacs)
ameba --format flycheck
```

### Advanced Usage

```bash
# Check only changed files (git)
git diff --name-only --diff-filter=ACM | grep '\.cr$' | xargs ameba

# Check only staged files
git diff --cached --name-only --diff-filter=ACM | grep '\.cr$' | xargs ameba

# Run with parallel processing (if available)
ameba --parallel

# Set exit code based on severity
ameba --fail-level error    # Only fail on errors
ameba --fail-level warning  # Fail on warnings and errors
ameba --fail-level convention  # Fail on everything

# Generate formatted report
ameba --format json | jq '.summary'
```

## Pre-Commit Hooks

### Git Hook Setup

Create `.git/hooks/pre-commit`:

```bash
#!/bin/sh
# .git/hooks/pre-commit - Run Ameba on staged Crystal files

echo "Running Ameba on staged files..."

# Get staged Crystal files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.cr$')

if [ -z "$STAGED_FILES" ]; then
  echo "No Crystal files staged, skipping Ameba"
  exit 0
fi

# Run Ameba on staged files
echo "$STAGED_FILES" | xargs ameba

# Capture exit code
AMEBA_EXIT=$?

if [ $AMEBA_EXIT -ne 0 ]; then
  echo "❌ Ameba found issues. Please fix them before committing."
  echo "Run 'ameba --fix' to auto-correct some issues."
  exit 1
fi

echo "✅ Ameba checks passed"
exit 0
```

Make it executable:

```bash
chmod +x .git/hooks/pre-commit
```

### Advanced Pre-Commit Hook

```bash
#!/bin/sh
# Advanced pre-commit hook with auto-fix option

echo "Running Ameba on staged files..."

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep '\.cr$')

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

# Run Ameba
echo "$STAGED_FILES" | xargs ameba
AMEBA_EXIT=$?

if [ $AMEBA_EXIT -ne 0 ]; then
  echo ""
  echo "❌ Ameba found issues."
  echo ""
  read -p "Would you like to auto-fix correctable issues? (y/n) " -n 1 -r
  echo

  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Running ameba --fix..."
    echo "$STAGED_FILES" | xargs ameba --fix

    # Re-add fixed files
    echo "$STAGED_FILES" | xargs git add

    echo "✅ Auto-fixed issues and re-staged files"
    echo "⚠️  Please review the changes before committing again"
    exit 1  # Exit to allow review
  else
    echo "Please fix issues manually before committing"
    exit 1
  fi
fi

echo "✅ Ameba checks passed"
exit 0
```

### Pre-Commit Framework Integration

Using the [pre-commit](https://pre-commit.com/) framework:

Create `.pre-commit-config.yaml`:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: ameba
        name: Ameba (Crystal Linter)
        entry: ameba
        language: system
        files: \.cr$
        pass_filenames: true

  - repo: local
    hooks:
      - id: crystal-format
        name: Crystal Format
        entry: crystal tool format
        language: system
        files: \.cr$
        pass_filenames: true
```

Install and use:

```bash
# Install pre-commit
pip install pre-commit  # or brew install pre-commit

# Install hooks
pre-commit install

# Run manually
pre-commit run --all-files

# Run on specific files
pre-commit run --files src/user.cr
```

### Pre-Commit Configuration Options

```yaml
# .pre-commit-config.yaml with options
repos:
  - repo: local
    hooks:
      - id: ameba
        name: Ameba
        entry: ameba
        language: system
        files: \.cr$
        pass_filenames: true

      - id: ameba-strict
        name: Ameba (Strict)
        entry: ameba --fail-level convention
        language: system
        files: ^src/.*\.cr$  # Only src directory
        pass_filenames: true

      - id: ameba-autofix
        name: Ameba Auto-fix
        entry: ameba --fix
        language: system
        files: \.cr$
        pass_filenames: true
```

## GitHub Actions Integration

### Basic GitHub Actions Workflow

Create `.github/workflows/ameba.yml`:

```yaml
name: Ameba

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  lint:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Install Crystal
        uses: crystal-lang/install-crystal@v1
        with:
          crystal: latest

      - name: Install dependencies
        run: shards install

      - name: Run Ameba
        uses: crystal-ameba/github-action@v0.12.0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Advanced GitHub Actions Configuration

```yaml
name: Code Quality

on:
  push:
    branches: [ main ]
  pull_request:
    types: [ opened, synchronize, reopened ]

jobs:
  ameba:
    name: Ameba Linting
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Full history for better analysis

      - name: Install Crystal
        uses: crystal-lang/install-crystal@v1
        with:
          crystal: 1.11.0  # Pin version for consistency

      - name: Cache shards
        uses: actions/cache@v3
        with:
          path: lib
          key: ${{ runner.os }}-shards-${{ hashFiles('shard.lock') }}
          restore-keys: |
            ${{ runner.os }}-shards-

      - name: Install dependencies
        run: shards install

      - name: Run Ameba
        uses: crystal-ameba/github-action@v0.12.0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload Ameba results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: ameba-results
          path: ameba-results.json
```

### Matrix Testing Across Crystal Versions

```yaml
name: Quality Across Versions

on: [push, pull_request]

jobs:
  ameba:
    strategy:
      matrix:
        crystal: [1.10.0, 1.11.0, latest]
        os: [ubuntu-latest, macos-latest]

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Install Crystal ${{ matrix.crystal }}
        uses: crystal-lang/install-crystal@v1
        with:
          crystal: ${{ matrix.crystal }}

      - name: Install dependencies
        run: shards install

      - name: Run Ameba
        run: |
          crystal run bin/ameba.cr -- --format json > ameba-results.json

      - name: Check results
        run: |
          if [ $(jq '.summary.issues_count' ameba-results.json) -gt 0 ]; then
            echo "❌ Found issues"
            jq '.summary' ameba-results.json
            exit 1
          fi
```

### Pull Request Review Integration

```yaml
name: PR Code Review

on:
  pull_request:
    types: [ opened, synchronize ]

jobs:
  review:
    runs-on: ubuntu-latest

    permissions:
      contents: read
      pull-requests: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Install Crystal
        uses: crystal-lang/install-crystal@v1

      - name: Install dependencies
        run: shards install

      - name: Get changed files
        id: changed-files
        uses: tj-actions/changed-files@v40
        with:
          files: |
            **/*.cr

      - name: Run Ameba on changed files
        if: steps.changed-files.outputs.any_changed == 'true'
        run: |
          echo "${{ steps.changed-files.outputs.all_changed_files }}" | \
            xargs ameba --format json > ameba-results.json

      - name: Comment PR
        if: steps.changed-files.outputs.any_changed == 'true'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const results = JSON.parse(fs.readFileSync('ameba-results.json', 'utf8'));

            if (results.summary.issues_count > 0) {
              const body = `## Ameba Report

              Found ${results.summary.issues_count} issue(s):

              ${results.sources.flatMap(s =>
                s.issues.map(i =>
                  \`- \${s.path}:\${i.location.line}:\${i.location.column} - \${i.rule.name}: \${i.message}\`
                )
              ).join('\\n')}`;

              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body: body
              });
            }
```

## CI/CD Pipeline Integration

### GitLab CI/CD

```yaml
# .gitlab-ci.yml
stages:
  - quality
  - test
  - build

ameba:
  stage: quality
  image: crystallang/crystal:latest

  before_script:
    - shards install

  script:
    - crystal run bin/ameba.cr -- --format junit > ameba-results.xml

  artifacts:
    reports:
      junit: ameba-results.xml
    paths:
      - ameba-results.xml
    when: always
    expire_in: 1 week

  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
    - if: '$CI_COMMIT_BRANCH == "main"'

ameba-strict:
  extends: ameba
  script:
    - crystal run bin/ameba.cr -- --fail-level convention
  only:
    - main
```

### CircleCI

```yaml
# .circleci/config.yml
version: 2.1

orbs:
  crystal: manastech/crystal@1.0

jobs:
  ameba:
    executor:
      name: crystal/default
      tag: "1.11"

    steps:
      - checkout

      - restore_cache:
          keys:
            - shards-v1-{{ checksum "shard.lock" }}
            - shards-v1-

      - run:
          name: Install dependencies
          command: shards install

      - save_cache:
          key: shards-v1-{{ checksum "shard.lock" }}
          paths:
            - lib

      - run:
          name: Run Ameba
          command: |
            crystal run bin/ameba.cr -- --format junit > ameba-results.xml

      - store_test_results:
          path: ameba-results.xml

      - store_artifacts:
          path: ameba-results.xml

workflows:
  version: 2
  quality:
    jobs:
      - ameba
```

### Jenkins Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent {
        docker {
            image 'crystallang/crystal:latest'
        }
    }

    stages {
        stage('Setup') {
            steps {
                sh 'shards install'
            }
        }

        stage('Ameba') {
            steps {
                sh '''
                    crystal run bin/ameba.cr -- --format junit > ameba-results.xml || true
                '''
            }
            post {
                always {
                    junit 'ameba-results.xml'
                }
            }
        }

        stage('Ameba Strict') {
            when {
                branch 'main'
            }
            steps {
                sh 'crystal run bin/ameba.cr -- --fail-level error'
            }
        }
    }

    post {
        failure {
            emailext(
                subject: "Ameba Failures in ${env.JOB_NAME}",
                body: "Check console output at ${env.BUILD_URL}",
                to: "${env.CHANGE_AUTHOR_EMAIL}"
            )
        }
    }
}
```

### Travis CI

```yaml
# .travis.yml
language: crystal

crystal:
  - latest
  - 1.11.0

install:
  - shards install

script:
  - crystal spec
  - crystal run bin/ameba.cr -- --fail-level warning

cache:
  directories:
    - lib

notifications:
  email:
    on_success: never
    on_failure: change
```

## Editor Integration

### VS Code

Install the Crystal Language extension and configure:

```json
// .vscode/settings.json
{
  "crystal-lang.server": "crystalline",
  "crystal-lang.problems": "build",

  // Run Ameba on save
  "emeraldwalk.runonsave": {
    "commands": [
      {
        "match": "\\.cr$",
        "cmd": "ameba ${file}"
      }
    ]
  },

  // Format on save
  "editor.formatOnSave": true,
  "[crystal]": {
    "editor.defaultFormatter": "crystal-lang-tools.crystal-lang"
  }
}
```

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Ameba",
      "type": "shell",
      "command": "ameba",
      "problemMatcher": {
        "owner": "crystal",
        "fileLocation": ["relative", "${workspaceFolder}"],
        "pattern": {
          "regexp": "^(.+):(\\d+):(\\d+):\\s+(.+):\\s+(.+)$",
          "file": 1,
          "line": 2,
          "column": 3,
          "severity": 4,
          "message": 5
        }
      },
      "group": {
        "kind": "build",
        "isDefault": true
      }
    },
    {
      "label": "Ameba Fix",
      "type": "shell",
      "command": "ameba --fix",
      "group": "build"
    }
  ]
}
```

### Vim/Neovim

Using ALE (Asynchronous Lint Engine):

```vim
" .vimrc or init.vim
let g:ale_linters = {
\   'crystal': ['ameba', 'crystal'],
\}

let g:ale_fixers = {
\   'crystal': ['ameba'],
\}

" Enable auto-fixing on save
let g:ale_fix_on_save = 1

" Ameba options
let g:ale_crystal_ameba_executable = 'ameba'
```

### Emacs

```elisp
;; .emacs or init.el
(require 'flycheck)

(flycheck-define-checker crystal-ameba
  "Crystal linter using Ameba."
  :command ("ameba" "--format" "flycheck" source)
  :error-patterns
  ((error line-start (file-name) ":" line ":" column ": E: " (message) line-end)
   (warning line-start (file-name) ":" line ":" column ": W: " (message) line-end)
   (info line-start (file-name) ":" line ":" column ": I: " (message) line-end))
  :modes crystal-mode)

(add-to-list 'flycheck-checkers 'crystal-ameba)
```

## Quality Gates and Policies

### Fail-Fast Strategy

```bash
#!/bin/bash
# scripts/quality-gate.sh

echo "Running quality gates..."

# Gate 1: Critical errors only
echo "Gate 1: Critical errors"
ameba --only Lint/Syntax,Lint/UnreachableCode --fail-level error
if [ $? -ne 0 ]; then
  echo "❌ Critical errors found"
  exit 1
fi

# Gate 2: All errors
echo "Gate 2: All errors"
ameba --fail-level error
if [ $? -ne 0 ]; then
  echo "❌ Errors found"
  exit 1
fi

# Gate 3: Warnings (non-blocking for now)
echo "Gate 3: Warnings (informational)"
ameba --fail-level warning || echo "⚠️  Warnings found (not blocking)"

echo "✅ All quality gates passed"
```

### Progressive Strictness

```yaml
# .github/workflows/quality-gates.yml
name: Quality Gates

on: [push, pull_request]

jobs:
  critical:
    name: Critical Issues
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: crystal-lang/install-crystal@v1
      - run: shards install
      - name: Check critical
        run: ameba --only Lint/Syntax --fail-level error

  errors:
    name: All Errors
    needs: critical
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: crystal-lang/install-crystal@v1
      - run: shards install
      - name: Check errors
        run: ameba --fail-level error

  warnings:
    name: Warnings (Main Only)
    needs: errors
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: crystal-lang/install-crystal@v1
      - run: shards install
      - name: Check warnings
        run: ameba --fail-level warning
```

### Ratcheting (Prevent New Issues)

```bash
#!/bin/bash
# scripts/ameba-ratchet.sh
# Only fail on new issues, not existing ones

# Get baseline issue count (from main branch)
git fetch origin main
BASELINE=$(git show origin/main:.ameba-baseline.json 2>/dev/null || echo '{"count": 0}')
BASELINE_COUNT=$(echo "$BASELINE" | jq '.count')

# Run Ameba and count current issues
ameba --format json > current-results.json
CURRENT_COUNT=$(jq '.summary.issues_count' current-results.json)

echo "Baseline issues: $BASELINE_COUNT"
echo "Current issues: $CURRENT_COUNT"

if [ "$CURRENT_COUNT" -gt "$BASELINE_COUNT" ]; then
  echo "❌ New issues introduced ($((CURRENT_COUNT - BASELINE_COUNT)) new issues)"
  exit 1
fi

if [ "$CURRENT_COUNT" -lt "$BASELINE_COUNT" ]; then
  echo "✅ Issues reduced! ($((BASELINE_COUNT - CURRENT_COUNT)) fewer issues)"
fi

echo "✅ No new issues"
```

## Reporting and Monitoring

### Generate HTML Reports

```bash
#!/bin/bash
# scripts/generate-report.sh

ameba --format json > ameba-results.json

# Convert to HTML using jq and template
cat > ameba-report.html <<'EOF'
<!DOCTYPE html>
<html>
<head>
  <title>Ameba Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .summary { background: #f0f0f0; padding: 20px; margin-bottom: 20px; }
    .issue { border-left: 3px solid red; padding: 10px; margin: 10px 0; }
    .error { border-color: #d32f2f; }
    .warning { border-color: #f57c00; }
    .convention { border-color: #fbc02d; }
  </style>
</head>
<body>
  <h1>Ameba Code Quality Report</h1>
  <div class="summary">
EOF

jq -r '.summary | "
    <h2>Summary</h2>
    <p>Total Issues: \(.issues_count)</p>
    <p>Files Analyzed: \(.target_sources_count)</p>
"' ameba-results.json >> ameba-report.html

echo '<h2>Issues</h2>' >> ameba-report.html

jq -r '.sources[] | select(.issues | length > 0) | .path as $path | .issues[] | "
  <div class=\"issue \(.rule.severity | ascii_downcase)\">
    <strong>\($path):\(.location.line):\(.location.column)</strong><br>
    \(.rule.name): \(.message)
  </div>
"' ameba-results.json >> ameba-report.html

echo '</body></html>' >> ameba-report.html

echo "Report generated: ameba-report.html"
```

### Metrics Tracking

```bash
#!/bin/bash
# scripts/track-metrics.sh
# Track Ameba metrics over time

TIMESTAMP=$(date +%Y-%m-%d)
ameba --format json > "metrics/ameba-$TIMESTAMP.json"

# Extract key metrics
jq '{
  date: "'$TIMESTAMP'",
  issues: .summary.issues_count,
  files: .summary.target_sources_count,
  errors: [.sources[].issues[] | select(.rule.severity == "Error")] | length,
  warnings: [.sources[].issues[] | select(.rule.severity == "Warning")] | length
}' "metrics/ameba-$TIMESTAMP.json" >> metrics/history.jsonl

# Generate trend chart (requires gnuplot or similar)
echo "Metrics tracked for $TIMESTAMP"
```

## When to Use This Skill

Use the ameba-integration skill when:

- Setting up CI/CD pipelines for Crystal projects
- Implementing automated code review processes
- Establishing quality gates for deployments
- Configuring pre-commit hooks for team development
- Integrating static analysis into GitHub Actions
- Creating automated PR review workflows
- Setting up editor integrations for real-time feedback
- Implementing progressive quality improvements (ratcheting)
- Generating code quality reports for stakeholders
- Migrating from manual code review to automated checks
- Establishing coding standards enforcement
- Onboarding new team members with automated feedback

## Best Practices

1. **Start with CI/CD** - Implement in CI pipeline first before local hooks
2. **Use caching** - Cache dependencies and Ameba results for faster builds
3. **Fail appropriately** - Use `--fail-level` to match pipeline requirements
4. **Provide feedback** - Generate reports and comments on PRs
5. **Make it fast** - Only check changed files in pre-commit hooks
6. **Allow bypass** - Provide `--no-verify` option for emergencies
7. **Progressive enforcement** - Start permissive, increase strictness over time
8. **Monitor metrics** - Track issues over time to measure improvement
9. **Separate concerns** - Different rules/severity for different environments
10. **Document process** - Clear instructions for team on running locally
11. **Use artifacts** - Store results for later analysis and trending
12. **Auto-fix when possible** - Offer automatic fixes in interactive environments
13. **Pin versions** - Use specific Ameba versions in CI for consistency
14. **Handle failures gracefully** - Provide helpful error messages
15. **Keep it maintained** - Regularly update integrations and configurations

## Common Pitfalls

1. **Blocking all commits** - Too strict pre-commit hooks frustrate developers
2. **No caching** - Slow CI builds from re-downloading dependencies every time
3. **Analyzing generated files** - Wasting time on auto-generated code
4. **Not pinning versions** - Different Ameba versions produce different results
5. **Missing changed files detection** - Running on entire codebase in every PR
6. **No failure context** - Cryptic error messages without guidance
7. **Inconsistent configuration** - Different settings locally vs CI
8. **Long feedback loops** - Developers find out about issues too late
9. **No auto-fix option** - Manual fixes for correctable issues
10. **Silent failures** - CI passes but Ameba didn't actually run
11. **Excessive notifications** - Spamming team with every minor issue
12. **No bypass mechanism** - Can't commit urgent fixes when needed
13. **Ignoring performance** - CI timeout from slow analysis
14. **Not using parallel jobs** - Sequential execution slows down pipeline
15. **Missing test coverage** - Not verifying integration actually works

## Resources

- [Crystal Ameba GitHub Action](https://github.com/crystal-ameba/github-action)
- [Ameba GitHub Repository](https://github.com/crystal-ameba/ameba)
- [Pre-commit Framework](https://pre-commit.com/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitLab CI/CD Documentation](https://docs.gitlab.com/ee/ci/)
- [CircleCI Documentation](https://circleci.com/docs/)
- [Jenkins Pipeline Documentation](https://www.jenkins.io/doc/book/pipeline/)
