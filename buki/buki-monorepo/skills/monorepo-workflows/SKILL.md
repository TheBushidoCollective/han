---
name: monorepo-workflows
description: Use when setting up CI/CD, implementing versioning, optimizing workflows, or managing releases with monorepo development workflows including version management, publishing, and team collaboration practices.
allowed-tools: Read,Write,Edit,Bash,Glob,Grep
---

# Monorepo Workflows Skill

## Overview

This skill provides comprehensive guidance on development workflows, CI/CD
patterns, version management, publishing strategies, and collaboration
practices for monorepo environments.

## Development Workflows

### Local Development Setup

Configure efficient local development environment.

**Package.json scripts**:

```json
{
  "scripts": {
    "dev": "turbo run dev --parallel",
    "dev:web": "turbo run dev --filter=@myorg/web...",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "clean": "turbo run clean && rm -rf node_modules",
    "reset": "pnpm clean && pnpm install"
  }
}
```

**Environment setup script**:

```bash
#!/bin/bash
# scripts/setup-dev.sh

echo "Setting up development environment..."

# Check Node version
required_node_version="18.0.0"
current_node_version=$(node -v | cut -d'v' -f2)

if [ "$(printf '%s\n' "$required_node_version" \
  "$current_node_version" | sort -V | head -n1)" != \
  "$required_node_version" ]; then
  echo "Error: Node.js $required_node_version or higher required"
  exit 1
fi

# Enable pnpm
corepack enable pnpm

# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Setup git hooks
pnpm husky install

echo "Development environment ready!"
```

### Cross-Package Development

Work across multiple packages simultaneously.

**Using workspace linking**:

```bash
# All workspace packages automatically linked
pnpm install

# Verify links
pnpm list --depth 1
```

**Development with watch mode**:

```json
{
  "scripts": {
    "dev:packages": "turbo run dev --filter='./packages/*'",
    "dev:apps": "turbo run dev --filter='./apps/*'"
  }
}
```

**Concurrent development**:

```json
{
  "scripts": {
    "dev:all": "concurrently \"pnpm:dev:*\"",
    "dev:ui": "pnpm --filter @myorg/ui run dev",
    "dev:web": "pnpm --filter @myorg/web run dev",
    "dev:api": "pnpm --filter @myorg/api run dev"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

### Hot Module Reloading

Enable fast refresh across package boundaries.

**Vite configuration**:

```typescript
// apps/web/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // Watch workspace packages
      ignored: ['!**/node_modules/@myorg/**']
    }
  },
  optimizeDeps: {
    // Force optimize workspace packages
    include: ['@myorg/ui', '@myorg/utils']
  }
});
```

**Next.js configuration**:

```javascript
// apps/web/next.config.js
const withTM = require('next-transpile-modules')([
  '@myorg/ui',
  '@myorg/utils'
]);

module.exports = withTM({
  reactStrictMode: true,
  experimental: {
    esmExternals: 'loose'
  }
});
```

### Debugging Across Packages

Set up debugging for monorepo projects.

**VS Code launch configuration**:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Web App",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "@myorg/web", "run", "dev"],
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal"
    },
    {
      "name": "Debug API",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/apps/api/src/index.ts",
      "preLaunchTask": "build-dependencies",
      "outFiles": ["${workspaceFolder}/apps/api/dist/**/*.js"],
      "sourceMaps": true
    },
    {
      "name": "Debug Tests",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["test", "--", "--inspect-brk"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

**Chrome DevTools debugging**:

```json
{
  "scripts": {
    "debug:web": "NODE_OPTIONS='--inspect' pnpm --filter @myorg/web run dev",
    "debug:api": "NODE_OPTIONS='--inspect-brk' pnpm --filter @myorg/api run dev"
  }
}
```

### Testing Strategies

Comprehensive testing across monorepo packages.

**Test organization**:

```text
packages/ui/
├── src/
│   ├── components/
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   └── Button.test.tsx
│   │   └── Input/
│   │       ├── Input.tsx
│   │       └── Input.test.tsx
└── __tests__/
    └── integration/
        └── form.test.tsx
```

**Shared test configuration**:

```typescript
// packages/test-config/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@myorg/(.*)$': '<rootDir>/../../packages/$1/src'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx'
  ]
};
```

**Package test scripts**:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

**Integration testing**:

```typescript
// __tests__/integration/package-interaction.test.ts
import { Button } from '@myorg/ui';
import { formatDate } from '@myorg/utils';

describe('Package Integration', () => {
  it('uses utility in component', () => {
    const date = new Date('2024-01-01');
    const formatted = formatDate(date);
    expect(formatted).toBe('2024-01-01');
  });
});
```

## CI/CD Patterns

### Matrix Builds Per Package

Run builds in parallel across packages.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  setup:
    runs-on: ubuntu-latest
    outputs:
      packages: ${{ steps.packages.outputs.packages }}
    steps:
      - uses: actions/checkout@v4
      - name: Get changed packages
        id: packages
        run: |
          packages=$(pnpm -r list --json | jq -r '.[].name' | jq -R -s -c 'split("\n")[:-1]')
          echo "packages=$packages" >> $GITHUB_OUTPUT

  build:
    needs: setup
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: ${{ fromJson(needs.setup.outputs.packages) }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter ${{ matrix.package }} run build
      - run: pnpm --filter ${{ matrix.package }} run test
```

### Affected-Only CI

Build and test only changed packages.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  affected:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build affected
        run: pnpm turbo run build --filter=[origin/main...HEAD]

      - name: Test affected
        run: pnpm turbo run test --filter=[origin/main...HEAD]

      - name: Lint affected
        run: pnpm turbo run lint --filter=[origin/main...HEAD]
```

**With Nx affected**:

```yaml
- name: Build affected
  run: npx nx affected --target=build --base=origin/main --head=HEAD

- name: Test affected
  run: npx nx affected --target=test --base=origin/main --head=HEAD --parallel=3
```

### Distributed Task Execution

Spread tasks across multiple CI agents.

```yaml
# .github/workflows/ci.yml
name: CI with Distribution

on: [pull_request, push]

jobs:
  setup:
    runs-on: ubuntu-latest
    outputs:
      tasks: ${{ steps.tasks.outputs.tasks }}
    steps:
      - uses: actions/checkout@v4
      - name: Generate task list
        id: tasks
        run: |
          tasks=$(pnpm turbo run build test --dry-run=json | jq -c '.tasks')
          echo "tasks=$tasks" >> $GITHUB_OUTPUT

  execute:
    needs: setup
    runs-on: ubuntu-latest
    strategy:
      matrix:
        task: ${{ fromJson(needs.setup.outputs.tasks) }}
      max-parallel: 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: ${{ matrix.task.command }}
```

### Parallel Pipeline Jobs

Execute independent jobs concurrently.

```yaml
# .github/workflows/ci.yml
name: Parallel CI

on: [pull_request, push]

jobs:
  install:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - uses: actions/cache@v3
        with:
          path: node_modules
          key: ${{ runner.os }}-node-modules-${{ hashFiles('pnpm-lock.yaml') }}

  lint:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/cache@v3
        with:
          path: node_modules
          key: ${{ runner.os }}-node-modules-${{ hashFiles('pnpm-lock.yaml') }}
      - run: pnpm turbo run lint

  test:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/cache@v3
        with:
          path: node_modules
          key: ${{ runner.os }}-node-modules-${{ hashFiles('pnpm-lock.yaml') }}
      - run: pnpm turbo run test --coverage

  build:
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/cache@v3
        with:
          path: node_modules
          key: ${{ runner.os }}-node-modules-${{ hashFiles('pnpm-lock.yaml') }}
      - run: pnpm turbo run build
```

### Selective Deployments

Deploy only changed applications.

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check if web changed
        id: changed
        run: |
          if git diff --name-only HEAD^ HEAD | grep -q "^apps/web/"; then
            echo "changed=true" >> $GITHUB_OUTPUT
          fi

      - name: Deploy web
        if: steps.changed.outputs.changed == 'true'
        run: |
          pnpm turbo run build --filter=@myorg/web
          # Deploy commands here

  deploy-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check if API changed
        id: changed
        run: |
          if git diff --name-only HEAD^ HEAD | grep -q "^apps/api/"; then
            echo "changed=true" >> $GITHUB_OUTPUT
          fi

      - name: Deploy API
        if: steps.changed.outputs.changed == 'true'
        run: |
          pnpm turbo run build --filter=@myorg/api
          # Deploy commands here
```

## Version Management

### Changesets Workflow

Automated versioning and changelog generation.

**Installation and setup**:

```bash
pnpm add -DW @changesets/cli
pnpm changeset init
```

**Configuration**:

```json
{
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": [
    "@myorg/private-package"
  ]
}
```

**Creating changesets**:

```bash
# Interactive changeset creation
pnpm changeset

# Example changeset file generated:
# .changeset/cool-feature.md
```

```markdown
---
"@myorg/ui": minor
"@myorg/web": patch
---

Add new Button variant and update documentation
```

**Version bumping**:

```bash
# Consume changesets and update versions
pnpm changeset version

# Updates package.json versions
# Updates CHANGELOG.md files
# Removes consumed changeset files
```

**Publishing**:

```bash
# Build and publish changed packages
pnpm changeset publish

# Push tags
git push --follow-tags
```

**GitHub Action integration**:

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run build

      - name: Create Release Pull Request or Publish
        uses: changesets/action@v1
        with:
          publish: pnpm changeset publish
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Conventional Commits

Standardized commit message format for automated versioning.

**Commit message format**:

```text
<type>(<scope>): <subject>

<body>

<footer>
```

**Examples**:

```bash
git commit -m "feat(ui): add Button component variant"
git commit -m "fix(api): resolve authentication bug"
git commit -m "docs(readme): update installation instructions"
git commit -m "chore(deps): update dependencies"
```

**Commitlint configuration**:

```javascript
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['ui', 'api', 'web', 'mobile', 'utils', 'config', 'ci']
    ],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'chore',
        'revert'
      ]
    ]
  }
};
```

**Husky pre-commit hook**:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

pnpm commitlint --edit $1
```

### Automated Changelogs

Generate changelogs from commit history.

**Using conventional-changelog**:

```bash
pnpm add -DW conventional-changelog-cli
```

```json
{
  "scripts": {
    "changelog": "conventional-changelog -p angular -i CHANGELOG.md -s",
    "version": "pnpm run changelog && git add CHANGELOG.md"
  }
}
```

**Using semantic-release**:

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    "@semantic-release/github",
    "@semantic-release/git"
  ]
}
```

### Version Bumping Strategies

Different approaches to version management.

**Independent versioning**:

```json
{
  "version": "independent",
  "packages": [
    "packages/*"
  ]
}
```

Each package has its own version:

- `@myorg/ui@2.1.0`
- `@myorg/utils@1.5.3`
- `@myorg/api@3.0.1`

**Fixed versioning**:

```json
{
  "version": "1.2.3",
  "packages": [
    "packages/*"
  ]
}
```

All packages share same version:

- `@myorg/ui@1.2.3`
- `@myorg/utils@1.2.3`
- `@myorg/api@1.2.3`

### Pre-Release Versions

Manage alpha, beta, and release candidate versions.

**With changesets**:

```bash
# Enter pre-release mode
pnpm changeset pre enter next

# Create changeset
pnpm changeset

# Version packages (creates -next.0 versions)
pnpm changeset version

# Publish pre-release
pnpm changeset publish --tag next

# Exit pre-release mode
pnpm changeset pre exit
```

**Result**:

```text
@myorg/ui@2.1.0-next.0
@myorg/ui@2.1.0-next.1
@myorg/ui@2.1.0
```

**With NPM dist-tags**:

```bash
# Publish to specific tag
pnpm publish --tag beta

# Install from tag
pnpm add @myorg/ui@beta

# List tags
pnpm view @myorg/ui dist-tags
```

## Publishing Workflows

### NPM Publishing

Publish packages to NPM registry.

**Configuration**:

```json
{
  "name": "@myorg/ui",
  "version": "1.0.0",
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ]
}
```

**Publishing script**:

```bash
#!/bin/bash
# scripts/publish.sh

# Build all packages
pnpm turbo run build

# Run tests
pnpm turbo run test

# Version packages
pnpm changeset version

# Publish
pnpm changeset publish

# Push tags
git push --follow-tags
```

**NPM automation token**:

```bash
# Generate automation token on npmjs.com
# Add to GitHub secrets as NPM_TOKEN

# Use in CI
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
pnpm publish --no-git-checks
```

### GitHub Packages

Publish to GitHub Package Registry.

**Configuration**:

```json
{
  "name": "@myorg/ui",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com/"
  }
}
```

**.npmrc for publishing**:

```ini
@myorg:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

**GitHub Action**:

```yaml
- name: Publish to GitHub Packages
  run: pnpm changeset publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Canary Releases

Publish test versions from PRs or branches.

**Canary script**:

```bash
#!/bin/bash
# scripts/canary-release.sh

# Get short commit hash
COMMIT_HASH=$(git rev-parse --short HEAD)

# Update versions with canary identifier
pnpm changeset version --snapshot canary-$COMMIT_HASH

# Publish with canary tag
pnpm changeset publish --tag canary

echo "Published canary release: canary-$COMMIT_HASH"
```

**GitHub Action for canary**:

```yaml
name: Canary Release

on:
  pull_request:
    types: [labeled]

jobs:
  canary:
    if: contains(github.event.pull_request.labels.*.name, 'canary')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run build
      - run: bash scripts/canary-release.sh
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Package Provenance

Enable package provenance for supply chain security.

**NPM provenance**:

```yaml
- name: Publish with provenance
  run: pnpm publish --provenance --access public
  env:
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**Package.json metadata**:

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/myorg/monorepo.git",
    "directory": "packages/ui"
  }
}
```

### Registry Authentication

Manage authentication for multiple registries.

**.npmrc configuration**:

```ini
# Public packages
@myorg:registry=https://registry.npmjs.org/
//registry.npmjs.org/:_authToken=${NPM_TOKEN}

# Private packages
@private:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}

# Corporate registry
@corp:registry=https://npm.corp.example.com/
//npm.corp.example.com/:_authToken=${CORP_TOKEN}
```

**Environment-specific auth**:

```bash
# Development
cp .npmrc.dev .npmrc

# CI
cp .npmrc.ci .npmrc
```

## Code Sharing

### Shared ESLint Configs

Maintain consistent linting across packages.

**Create config package**:

```javascript
// packages/eslint-config/index.js
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended'
  ],
  rules: {
    'no-console': 'warn',
    '@typescript-eslint/no-unused-vars': 'error',
    'react/react-in-jsx-scope': 'off'
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
};
```

**Package.json**:

```json
{
  "name": "@myorg/eslint-config",
  "version": "1.0.0",
  "main": "index.js",
  "peerDependencies": {
    "eslint": "^8.0.0",
    "typescript": "^5.0.0"
  }
}
```

**Usage in packages**:

```json
{
  "extends": "@myorg/eslint-config"
}
```

### Shared TypeScript Configs

Share TypeScript configuration across packages.

**Base configuration**:

```json
// packages/tsconfig/base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**React configuration**:

```json
// packages/tsconfig/react.json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

**Node configuration**:

```json
// packages/tsconfig/node.json
{
  "extends": "./base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"]
  }
}
```

**Package usage**:

```json
// apps/web/tsconfig.json
{
  "extends": "@myorg/tsconfig/react.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

### Shared Testing Setup

Common test configuration and utilities.

**Jest preset**:

```javascript
// packages/test-config/jest-preset.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@myorg/(.*)$': '<rootDir>/../../packages/$1/src',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.tsx',
    '!src/**/index.ts'
  ],
  coverageThresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

**Test utilities**:

```typescript
// packages/test-utils/src/index.ts
import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';

export function customRender(
  ui: ReactElement,
  options?: RenderOptions
) {
  return render(ui, {
    wrapper: ({ children }) => children,
    ...options
  });
}

export * from '@testing-library/react';
export { customRender as render };
```

**Package usage**:

```json
// packages/ui/jest.config.js
{
  "preset": "@myorg/test-config"
}
```

```typescript
// packages/ui/src/Button.test.tsx
import { render, screen } from '@myorg/test-utils';
import { Button } from './Button';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
```

### Shared Build Configs

Common build tool configurations.

**Vite config**:

```typescript
// packages/build-config/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

export function createConfig() {
  return defineConfig({
    plugins: [
      react(),
      dts({
        insertTypesEntry: true
      })
    ],
    build: {
      lib: {
        entry: 'src/index.ts',
        formats: ['es', 'cjs'],
        fileName: (format) => `index.${format}.js`
      },
      rollupOptions: {
        external: ['react', 'react-dom'],
        output: {
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM'
          }
        }
      }
    }
  });
}
```

**Package usage**:

```typescript
// packages/ui/vite.config.ts
import { createConfig } from '@myorg/build-config';

export default createConfig();
```

### Package Templates

Standardized templates for new packages.

**Template structure**:

```text
templates/package/
├── package.json.template
├── tsconfig.json
├── README.md.template
├── src/
│   └── index.ts
└── __tests__/
    └── index.test.ts
```

**Generator script**:

```typescript
// scripts/create-package.ts
import fs from 'fs';
import path from 'path';

interface PackageOptions {
  name: string;
  type: 'library' | 'app';
  description: string;
}

function createPackage({ name, type, description }: PackageOptions) {
  const dir = path.join('packages', name);
  const template = path.join('templates', type);

  // Copy template
  fs.cpSync(template, dir, { recursive: true });

  // Update package.json
  const pkgPath = path.join(dir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  pkg.name = `@myorg/${name}`;
  pkg.description = description;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

  console.log(`Created package: @myorg/${name}`);
}
```

## Migration Strategies

### Polyrepo to Monorepo

Migrate multiple repositories into monorepo.

**Migration steps**:

```bash
#!/bin/bash
# scripts/migrate-to-monorepo.sh

# 1. Create monorepo structure
mkdir my-monorepo
cd my-monorepo

# 2. Initialize git with clean history
git init
git commit --allow-empty -m "Initial commit"

# 3. Add first repo preserving history
git remote add -f repo1 ../old-repo1
git merge repo1/main --allow-unrelated-histories
mkdir -p packages/package1
git mv * packages/package1/
git commit -m "Move repo1 to packages/package1"

# 4. Add second repo preserving history
git remote add -f repo2 ../old-repo2
git merge repo2/main --allow-unrelated-histories
mkdir -p packages/package2
git mv * packages/package2/
git commit -m "Move repo2 to packages/package2"

# 5. Set up workspace
cat > package.json << EOF
{
  "name": "my-monorepo",
  "private": true,
  "workspaces": ["packages/*"]
}
EOF

git add package.json
git commit -m "Add workspace configuration"
```

### Monorepo Splitting

Extract packages from monorepo to separate repos.

**Split script**:

```bash
#!/bin/bash
# scripts/split-package.sh

PACKAGE=$1
TARGET_REPO=$2

# Filter git history for package
git filter-branch --prune-empty --subdirectory-filter packages/$PACKAGE -- --all

# Push to new repo
git remote add origin $TARGET_REPO
git push -u origin main

# Cleanup original monorepo
cd ../monorepo
rm -rf packages/$PACKAGE
git add .
git commit -m "Remove $PACKAGE (moved to separate repo)"
```

### Incremental Adoption

Gradually adopt monorepo practices.

**Phase approach**:

1. **Move packages**: Migrate repositories one at a time
2. **Add tooling**: Implement Turborepo/Nx incrementally
3. **Optimize builds**: Enable caching and affected analysis
4. **Automate workflows**: Set up CI/CD and publishing

**Gradual migration**:

```json
{
  "workspaces": [
    "packages/migrated/*",
    "legacy/*"
  ]
}
```

### Tooling Migration

Switch between monorepo tools.

**Lerna to Turborepo**:

```bash
# 1. Install Turborepo
pnpm add -DW turbo

# 2. Create turbo.json
cat > turbo.json << EOF
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
EOF

# 3. Remove Lerna
pnpm remove -DW lerna
rm lerna.json

# 4. Update scripts
# Replace "lerna run build" with "turbo run build"
```

**NPM to PNPM**:

```bash
# 1. Install PNPM
corepack enable pnpm

# 2. Create workspace file
cat > pnpm-workspace.yaml << EOF
packages:
  - 'packages/*'
  - 'apps/*'
EOF

# 3. Remove old files
rm -rf node_modules package-lock.json

# 4. Install with PNPM
pnpm install
```

## Git Workflows

### Branch Strategies

Effective branching for monorepo development.

**Feature branches**:

```bash
# Create feature branch
git checkout -b feature/add-button-component

# Work on specific package
cd packages/ui
# Make changes

# Commit with conventional format
git commit -m "feat(ui): add Button component"

# Push and create PR
git push -u origin feature/add-button-component
```

**Release branches**:

```bash
# Create release branch
git checkout -b release/v2.0.0

# Version packages
pnpm changeset version

# Commit and tag
git commit -m "chore: version packages for v2.0.0"
git tag v2.0.0

# Merge to main
git checkout main
git merge release/v2.0.0
```

### Pull Request Structure

Organize PRs for efficient reviews.

**PR template**:

```markdown
## Description
Brief description of changes

## Packages Changed
- @myorg/ui
- @myorg/web

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Changeset added
- [ ] No breaking changes (or documented)
- [ ] All CI checks passing
```

**CODEOWNERS**:

```text
# Global owners
* @myorg/core-team

# Package-specific owners
/packages/ui/ @myorg/frontend-team
/packages/api/ @myorg/backend-team
/apps/web/ @myorg/web-team
/apps/mobile/ @myorg/mobile-team
```

### Code Review Practices

Effective code review in monorepo context.

**Review checklist**:

- [ ] Changes limited to necessary packages
- [ ] No unnecessary dependency additions
- [ ] Tests cover new/changed code
- [ ] Documentation updated
- [ ] Breaking changes documented
- [ ] Changesets added
- [ ] No circular dependencies introduced

**Automated checks**:

```yaml
# .github/workflows/pr-checks.yml
- name: Check for circular dependencies
  run: pnpm check:circular

- name: Check for missing changesets
  run: pnpm changeset status

- name: Verify package boundaries
  run: pnpm lint:boundaries
```

### Merge Strategies

Effective merging for monorepo.

**Squash and merge** (recommended):

```bash
# PR merged as single commit
git merge --squash feature/add-button

# Commit with conventional format
git commit -m "feat(ui): add Button component (#123)"
```

**Rebase and merge**:

```bash
# Rebase feature branch
git rebase main

# Fast-forward merge
git merge --ff-only feature/add-button
```

### Protected Packages

Restrict changes to critical packages.

**GitHub branch protection**:

```yaml
# .github/settings.yml
branches:
  - name: main
    protection:
      required_pull_request_reviews:
        required_approving_review_count: 2
        dismiss_stale_reviews: true
      required_status_checks:
        strict: true
        contexts:
          - build
          - test
          - lint
```

**Package-specific protection**:

```text
# CODEOWNERS
/packages/core/ @myorg/core-maintainers
/packages/security/ @myorg/security-team
```

## Documentation Practices

### Package READMEs

Comprehensive documentation for each package.

**README template**:

```markdown
# @myorg/ui

React component library for MyOrg applications.

## Installation

pnpm add @myorg/ui

## Usage

import { Button } from '@myorg/ui';

function App() {
  return <Button onClick={() => alert('Clicked!')}>Click me</Button>;
}

## Components

- Button
- Input
- Modal

## API Reference

See [API.md](./API.md) for detailed documentation.

## Development

pnpm run dev
pnpm run build
pnpm run test

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md).

## License

MIT
```

### Architecture Decision Records

Document significant architectural decisions.

**ADR template**:

```markdown
# ADR-001: Use Turborepo for Build Orchestration

## Status
Accepted

## Context
Need efficient build system for monorepo with 20+ packages.

## Decision
Use Turborepo for task orchestration and caching.

## Consequences
Positive:
- Fast builds with intelligent caching
- Simple configuration
- Remote cache support

Negative:
- Additional dependency
- Learning curve for team

## Alternatives Considered
- Nx: More features but steeper learning curve
- Lerna: Simpler but lacks caching

## Date
2024-01-15
```

### API Documentation

Generate and maintain API documentation.

**TypeDoc configuration**:

```json
{
  "entryPoints": ["packages/*/src/index.ts"],
  "out": "docs/api",
  "excludePrivate": true,
  "excludeProtected": true,
  "categorizeByGroup": true,
  "categoryOrder": ["Components", "Hooks", "Utilities", "*"]
}
```

**Generate docs**:

```bash
pnpm typedoc --options typedoc.json
```

### Onboarding Guides

Help new developers get started.

**ONBOARDING.md**:

```markdown
# Developer Onboarding

## Prerequisites
- Node.js 18+
- PNPM 8+

## Setup

# Clone repository
git clone https://github.com/myorg/monorepo.git

# Install dependencies
pnpm install

# Build all packages
pnpm run build

## Development

# Start development servers
pnpm run dev

# Run tests
pnpm run test

## Project Structure

/apps          - Applications
/packages      - Shared packages
/docs          - Documentation

## Common Tasks

See [COMMON_TASKS.md](./COMMON_TASKS.md).
```

### Runbooks

Operational procedures and troubleshooting.

**RUNBOOK.md**:

```markdown
# Operations Runbook

## Build Failures

### Symptom
Build fails with "Cannot find module '@myorg/ui'"

### Solution
pnpm install
pnpm run build --filter=@myorg/ui...

## Cache Issues

### Symptom
Stale builds despite changes

### Solution
turbo run build --force

## Version Conflicts

### Symptom
Peer dependency warnings

### Solution
pnpm syncpack fix-mismatches
pnpm install
```

## Best Practices

### 1. Use Changesets for Versioning

Automate version management with changesets.

### 2. Implement Affected-Based CI

Only build and test changed packages in CI.

### 3. Automate Package Publishing

Use CI/CD for consistent, reliable publishing.

### 4. Document Workflows Clearly

Maintain comprehensive workflow documentation.

### 5. Use Consistent Git Practices

Enforce conventional commits and branch naming.

### 6. Implement Code Owners

Assign package ownership for better reviews.

### 7. Set Up Pre-Commit Hooks

Catch issues before they reach CI.

### 8. Use Semantic Versioning

Follow semver for all package versions.

### 9. Test in CI Before Publish

Never publish untested packages.

### 10. Monitor Deployment Health

Track deployment success and rollback capability.

## Common Pitfalls

### 1. Manual Version Management

Leads to errors and inconsistencies.

### 2. Running Full CI for All Changes

Wastes time and resources.

### 3. Inconsistent Publishing Process

Causes confusion and potential errors.

### 4. Poor Documentation

Makes onboarding and collaboration difficult.

### 5. Complex Git Workflows

Slows development and causes confusion.

### 6. No Deployment Automation

Manual deployments are error-prone.

### 7. Breaking Changes Without Warning

Breaks dependent packages and applications.

### 8. Missing Changelogs

Users don't know what changed.

### 9. Untested Packages Published

Breaks production for consumers.

### 10. No Rollback Strategy

Can't recover from bad deployments.

## When to Use This Skill

Apply monorepo workflow practices when:

- **Setting up CI/CD** - Configuring automated builds and deployments
- **Implementing versioning** - Establishing version management
- **Optimizing workflows** - Improving development efficiency
- **Managing releases** - Publishing and deploying packages
- **Team collaboration** - Establishing team practices
- **Automating processes** - Creating automated workflows
- **Troubleshooting issues** - Solving workflow problems
- **Onboarding developers** - Teaching monorepo workflows
- **Migrating workflows** - Updating or changing processes
- **Scaling operations** - Growing team and processes

## Resources

- [Changesets Documentation](https://github.com/changesets/changesets) -
  Version management and changelog generation
- [Conventional Commits](https://www.conventionalcommits.org/) - Commit
  message specification
- [Semantic Versioning](https://semver.org/) - Version numbering scheme
- [GitHub Actions](https://docs.github.com/actions) - CI/CD automation
- [Turborepo CI/CD](https://turbo.build/repo/docs/ci) - Turborepo in CI/CD
  environments
- [Nx CI/CD](https://nx.dev/ci/intro/ci-with-nx) - Nx continuous
  integration patterns
- [PNPM Publishing](https://pnpm.io/cli/publish) - Publishing with PNPM
- [NPM Provenance](https://docs.npmjs.com/generating-provenance-statements)
  - Package supply chain security
