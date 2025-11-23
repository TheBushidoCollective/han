---
name: markdownlint-integration
description: Integrate markdownlint into development workflows including CLI usage, programmatic API, CI/CD pipelines, and editor integration.
allowed-tools: [Bash, Read]
---

# Markdownlint Integration

Master integrating markdownlint into development workflows including CLI usage, programmatic API (sync/async/promise), CI/CD pipelines, pre-commit hooks, and editor integration.

## Overview

Markdownlint can be integrated into various parts of your development workflow to ensure consistent markdown quality. This includes command-line tools, programmatic usage in Node.js, continuous integration pipelines, Git hooks, and editor plugins.

## Command-Line Interface

### markdownlint-cli Installation

```bash
npm install -g markdownlint-cli
# or as dev dependency
npm install --save-dev markdownlint-cli
```

### Basic CLI Usage

```bash
# Lint all markdown files in current directory
markdownlint '**/*.md'

# Lint specific files
markdownlint README.md CONTRIBUTING.md

# Lint with configuration file
markdownlint -c .markdownlint.json '**/*.md'

# Ignore specific files
markdownlint '**/*.md' --ignore node_modules

# Fix violations automatically
markdownlint -f '**/*.md'

# Output to file
markdownlint '**/*.md' -o linting-results.txt
```

### Advanced CLI Options

```bash
# Use custom config
markdownlint --config config/markdown-lint.json docs/

# Ignore patterns from file
markdownlint --ignore-path .gitignore '**/*.md'

# Use multiple ignore patterns
markdownlint --ignore node_modules --ignore dist '**/*.md'

# Enable specific rules only
markdownlint --rules MD001,MD003,MD013 '**/*.md'

# Disable specific rules
markdownlint --disable MD013 '**/*.md'

# Show output in JSON format
markdownlint --json '**/*.md'

# Quiet mode (exit code only)
markdownlint -q '**/*.md'

# Verbose output
markdownlint --verbose '**/*.md'
```

### CLI Configuration File

`.markdownlint-cli.json`:

```json
{
  "config": {
    "default": true,
    "MD013": {
      "line_length": 100
    }
  },
  "files": ["**/*.md"],
  "ignores": [
    "node_modules/**",
    "dist/**",
    "build/**"
  ]
}
```

Use with:

```bash
markdownlint --config .markdownlint-cli.json
```

## Programmatic API

### Callback-Based API

```javascript
const markdownlint = require('markdownlint');

const options = {
  files: ['good.md', 'bad.md'],
  config: {
    default: true,
    'line-length': {
      line_length: 100
    }
  }
};

markdownlint(options, (err, result) => {
  if (!err) {
    console.log(result.toString());
  } else {
    console.error(err);
  }
});
```

### Promise-Based API

```javascript
import { lint as lintPromise } from 'markdownlint/promise';

const options = {
  files: ['README.md', 'docs/**/*.md'],
  config: {
    default: true,
    'no-inline-html': {
      allowed_elements: ['br', 'img']
    }
  }
};

try {
  const results = await lintPromise(options);
  console.dir(results, { colors: true, depth: null });
} catch (err) {
  console.error(err);
}
```

### Synchronous API

```javascript
import { lint as lintSync } from 'markdownlint/sync';

const options = {
  files: ['README.md'],
  strings: {
    'inline-content': '# Test\n\nContent here.'
  },
  config: {
    default: true
  }
};

const results = lintSync(options);
console.log(results.toString());
```

### Linting Strings

```javascript
const markdownlint = require('markdownlint');

const options = {
  strings: {
    'content-1': '# Heading\n\nParagraph text.',
    'content-2': '## Another heading\n\nMore content.'
  },
  config: {
    default: true,
    'first-line-heading': {
      level: 1
    }
  }
};

markdownlint(options, (err, result) => {
  if (!err) {
    const resultString = result.toString();
    console.log(resultString);
  }
});
```

### Working with Results

```javascript
import { lint } from 'markdownlint/promise';

const results = await lint({
  files: ['docs/**/*.md'],
  config: { default: true }
});

// Results is an object keyed by filename
Object.keys(results).forEach(file => {
  const fileResults = results[file];

  fileResults.forEach(result => {
    console.log(`${file}:${result.lineNumber} ${result.ruleNames.join('/')} ${result.ruleDescription}`);

    if (result.errorDetail) {
      console.log(`  Detail: ${result.errorDetail}`);
    }

    if (result.errorContext) {
      console.log(`  Context: ${result.errorContext}`);
    }
  });
});
```

### Reading Configuration

```javascript
const markdownlint = require('markdownlint');
const { readConfigSync } = require('markdownlint/sync');

// Read configuration from file
const config = readConfigSync('.markdownlint.json');

const options = {
  files: ['**/*.md'],
  config: config
};

const results = markdownlint.sync(options);
console.log(results.toString());
```

### Using Custom Rules

```javascript
const markdownlint = require('markdownlint');
const customRule = require('./custom-rules/heading-capitalization');

const options = {
  files: ['README.md'],
  config: {
    default: true,
    'heading-capitalization': true
  },
  customRules: [customRule]
};

markdownlint(options, (err, result) => {
  if (!err) {
    console.log(result.toString());
  }
});
```

## Applying Fixes Programmatically

### applyFix Function

```javascript
const { applyFix } = require('markdownlint');

const line = '  Text with extra spaces  ';
const fixInfo = {
  editColumn: 1,
  deleteCount: 2,
  insertText: ''
};

const fixed = applyFix(line, fixInfo);
console.log(fixed); // 'Text with extra spaces  '
```

### applyFixes Function

```javascript
const { applyFixes } = require('markdownlint');

const input = '# Heading\n\n\nParagraph';
const errors = [
  {
    lineNumber: 3,
    ruleNames: ['MD012'],
    ruleDescription: 'Multiple blank lines',
    fixInfo: {
      lineNumber: 3,
      deleteCount: -1
    }
  }
];

const fixed = applyFixes(input, errors);
console.log(fixed); // '# Heading\n\nParagraph'
```

### Auto-Fix Workflow

```javascript
const fs = require('fs');
const markdownlint = require('markdownlint');
const { applyFixes } = require('markdownlint');

const file = 'README.md';
const content = fs.readFileSync(file, 'utf8');

const options = {
  strings: {
    [file]: content
  },
  config: {
    default: true
  }
};

markdownlint(options, (err, result) => {
  if (!err) {
    const errors = result[file] || [];

    if (errors.length > 0) {
      const fixed = applyFixes(content, errors);
      fs.writeFileSync(file, fixed, 'utf8');
      console.log(`Fixed ${errors.length} issues in ${file}`);
    }
  }
});
```

## CI/CD Integration

### GitHub Actions

`.github/workflows/markdownlint.yml`:

```yaml
name: Markdownlint

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run markdownlint
        run: npx markdownlint '**/*.md' --ignore node_modules

      - name: Annotate PR with results
        if: failure()
        run: |
          npx markdownlint '**/*.md' --ignore node_modules -o markdownlint-results.txt
          cat markdownlint-results.txt
```

### GitHub Actions with markdownlint-cli2

```yaml
name: Markdownlint

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Run markdownlint-cli2
        uses: DavidAnson/markdownlint-cli2-action@v9
        with:
          globs: '**/*.md'
```

### GitLab CI

`.gitlab-ci.yml`:

```yaml
markdownlint:
  image: node:18-alpine
  stage: test
  before_script:
    - npm install -g markdownlint-cli
  script:
    - markdownlint '**/*.md' --ignore node_modules
  only:
    - merge_requests
    - main
  artifacts:
    when: on_failure
    paths:
      - markdownlint-results.txt
```

### CircleCI

`.circleci/config.yml`:

```yaml
version: 2.1

jobs:
  markdownlint:
    docker:
      - image: cimg/node:18.0
    steps:
      - checkout
      - run:
          name: Install markdownlint
          command: npm install -g markdownlint-cli
      - run:
          name: Run linter
          command: markdownlint '**/*.md' --ignore node_modules

workflows:
  version: 2
  build_and_test:
    jobs:
      - markdownlint
```

### Jenkins Pipeline

`Jenkinsfile`:

```groovy
pipeline {
    agent any

    stages {
        stage('Lint Markdown') {
            steps {
                sh 'npm install -g markdownlint-cli'
                sh 'markdownlint "**/*.md" --ignore node_modules'
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        failure {
            echo 'Markdownlint found issues!'
        }
    }
}
```

### Azure Pipelines

`azure-pipelines.yml`:

```yaml
trigger:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '18.x'
    displayName: 'Install Node.js'

  - script: |
      npm install -g markdownlint-cli
    displayName: 'Install markdownlint'

  - script: |
      markdownlint '**/*.md' --ignore node_modules
    displayName: 'Run markdownlint'
```

## Pre-commit Hooks

### Using Husky

Install Husky:

```bash
npm install --save-dev husky
npx husky install
```

Create pre-commit hook:

```bash
npx husky add .husky/pre-commit "npm run lint:md"
```

Add script to `package.json`:

```json
{
  "scripts": {
    "lint:md": "markdownlint '**/*.md' --ignore node_modules",
    "lint:md:fix": "markdownlint -f '**/*.md' --ignore node_modules"
  }
}
```

### Using lint-staged

Install lint-staged:

```bash
npm install --save-dev lint-staged
```

Configure in `package.json`:

```json
{
  "lint-staged": {
    "*.md": [
      "markdownlint --fix",
      "git add"
    ]
  }
}
```

Update pre-commit hook:

```bash
npx husky add .husky/pre-commit "npx lint-staged"
```

### Using pre-commit Framework

`.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/igorshubovych/markdownlint-cli
    rev: v0.37.0
    hooks:
      - id: markdownlint
        args: ['--fix']

  - repo: https://github.com/DavidAnson/markdownlint-cli2
    rev: v0.10.0
    hooks:
      - id: markdownlint-cli2
        args: ['--fix']
```

Install and use:

```bash
pip install pre-commit
pre-commit install
pre-commit run --all-files
```

## Editor Integration

### Visual Studio Code

Install the markdownlint extension:

1. Open VS Code
2. Go to Extensions (Cmd+Shift+X)
3. Search for "markdownlint"
4. Install "markdownlint" by David Anson

Configure in `.vscode/settings.json`:

```json
{
  "markdownlint.config": {
    "default": true,
    "MD013": {
      "line_length": 100
    }
  },
  "markdownlint.ignore": [
    "node_modules/**",
    "dist/**"
  ],
  "editor.codeActionsOnSave": {
    "source.fixAll.markdownlint": true
  }
}
```

### Vim/Neovim

Using ALE (Asynchronous Lint Engine):

```vim
" In .vimrc or init.vim
let g:ale_linters = {
\   'markdown': ['markdownlint'],
\}

let g:ale_fixers = {
\   'markdown': ['markdownlint'],
\}

let g:ale_markdown_markdownlint_options = '-c .markdownlint.json'

" Enable fixing on save
let g:ale_fix_on_save = 1
```

### Sublime Text

Install via Package Control:

1. Install Package Control
2. Install "SublimeLinter"
3. Install "SublimeLinter-contrib-markdownlint"

Configure in preferences:

```json
{
  "linters": {
    "markdownlint": {
      "args": ["-c", ".markdownlint.json"]
    }
  }
}
```

### Atom

Install packages:

```bash
apm install linter-markdownlint
```

Configure in Atom settings or `.atom/config.cson`:

```cson
"linter-markdownlint":
  configPath: ".markdownlint.json"
```

## npm Scripts Integration

### package.json Scripts

```json
{
  "scripts": {
    "lint": "npm run lint:md",
    "lint:md": "markdownlint '**/*.md' --ignore node_modules",
    "lint:md:fix": "markdownlint -f '**/*.md' --ignore node_modules",
    "lint:md:ci": "markdownlint '**/*.md' --ignore node_modules -o markdownlint-report.txt",
    "test": "npm run lint && npm run test:unit",
    "precommit": "lint-staged"
  }
}
```

### Cross-Platform Compatibility

Using cross-env for environment variables:

```json
{
  "scripts": {
    "lint:md": "cross-env NODE_ENV=development markdownlint '**/*.md'"
  },
  "devDependencies": {
    "cross-env": "^7.0.3"
  }
}
```

## Docker Integration

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install markdownlint globally
RUN npm install -g markdownlint-cli

# Copy markdown files
COPY . .

# Run linter
CMD ["markdownlint", "**/*.md", "--ignore", "node_modules"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  markdownlint:
    image: node:18-alpine
    working_dir: /app
    volumes:
      - .:/app
    command: >
      sh -c "npm install -g markdownlint-cli &&
             markdownlint '**/*.md' --ignore node_modules"
```

Run with:

```bash
docker-compose run markdownlint
```

## Monorepo Integration

### Workspace Configuration

Root `.markdownlint.json`:

```json
{
  "default": true,
  "line-length": {
    "line_length": 100
  }
}
```

Root `package.json`:

```json
{
  "scripts": {
    "lint:md": "markdownlint '**/*.md' --ignore node_modules",
    "lint:md:packages": "lerna run lint:md",
    "lint:md:all": "npm run lint:md && npm run lint:md:packages"
  }
}
```

Package-level `packages/api/package.json`:

```json
{
  "scripts": {
    "lint:md": "markdownlint '**/*.md'"
  }
}
```

### Using Lerna

```json
{
  "scripts": {
    "lint:md": "lerna run lint:md --stream"
  }
}
```

### Using Turborepo

`turbo.json`:

```json
{
  "pipeline": {
    "lint:md": {
      "outputs": []
    }
  }
}
```

## Reporting and Metrics

### Generate HTML Report

Using a custom script:

```javascript
const fs = require('fs');
const markdownlint = require('markdownlint');

const options = {
  files: ['**/*.md'],
  config: { default: true }
};

markdownlint(options, (err, results) => {
  if (!err) {
    const html = generateHtmlReport(results);
    fs.writeFileSync('markdownlint-report.html', html);
  }
});

function generateHtmlReport(results) {
  let html = '<html><head><title>Markdownlint Report</title></head><body>';
  html += '<h1>Markdownlint Results</h1>';

  Object.keys(results).forEach(file => {
    html += `<h2>${file}</h2>`;
    html += '<ul>';

    results[file].forEach(result => {
      html += `<li>Line ${result.lineNumber}: ${result.ruleDescription}</li>`;
    });

    html += '</ul>';
  });

  html += '</body></html>';
  return html;
}
```

### JSON Output for Tooling

```bash
markdownlint '**/*.md' --json > results.json
```

Process with jq:

```bash
markdownlint '**/*.md' --json | jq '.[] | select(length > 0)'
```

## When to Use This Skill

- Setting up markdownlint in new projects
- Integrating linting into CI/CD pipelines
- Configuring pre-commit hooks
- Automating documentation quality checks
- Setting up editor integration
- Building custom linting workflows
- Creating automated fix scripts
- Implementing documentation standards

## Best Practices

1. **CI/CD Integration** - Always run linting in continuous integration
2. **Pre-commit Hooks** - Catch issues before they reach version control
3. **Editor Integration** - Get real-time feedback while writing
4. **Consistent Configuration** - Use same config across all environments
5. **Auto-fix When Possible** - Use -f flag to automatically fix violations
6. **Fail Fast** - Configure CI to fail on linting errors
7. **Ignore Generated Files** - Exclude build artifacts and dependencies
8. **Version Lock** - Pin markdownlint version in package.json
9. **Document Standards** - Keep documentation on linting rules
10. **Progressive Enhancement** - Start with relaxed rules, tighten over time
11. **Team Communication** - Discuss rule changes before applying
12. **Regular Updates** - Keep markdownlint updated for bug fixes
13. **Performance Optimization** - Use appropriate glob patterns
14. **Error Reporting** - Configure meaningful error output
15. **Backup Before Auto-fix** - Always commit before running fixes

## Common Pitfalls

1. **Missing Ignore Patterns** - Linting node_modules or build directories
2. **Wrong Glob Patterns** - Incorrect file matching in CLI
3. **Config Not Found** - Configuration file in wrong location
4. **Async/Sync Mismatch** - Using sync API with async rules
5. **CI Timeout** - Linting too many files without optimization
6. **No Exit Code Check** - Not failing CI on linting errors
7. **Overwriting Files** - Using auto-fix without version control
8. **Missing Dependencies** - Not installing markdownlint in CI
9. **Platform Differences** - Path separators differ between OS
10. **Large Binary Files** - Accidentally linting non-markdown files
11. **Outdated Cache** - Cached node_modules with old markdownlint
12. **Silent Failures** - Not capturing error output in CI
13. **Config Conflicts** - Multiple config files conflicting
14. **Missing Editor Config** - Local linting differs from CI
15. **No Pre-commit Hook** - Issues not caught before commit

## Resources

- [markdownlint GitHub Repository](https://github.com/DavidAnson/markdownlint)
- [markdownlint-cli](https://github.com/igorshubovych/markdownlint-cli)
- [markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2)
- [markdownlint VS Code Extension](https://marketplace.visualstudio.com/items?itemName=DavidAnson.vscode-markdownlint)
- [GitHub Actions Integration](https://github.com/marketplace/actions/markdownlint-cli2-action)
- [API Documentation](https://github.com/DavidAnson/markdownlint#api)
