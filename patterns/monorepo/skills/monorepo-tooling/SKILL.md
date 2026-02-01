---
name: monorepo-tooling
description: Use when setting up monorepo tooling, optimizing builds, or migrating between tools with Turborepo, Nx, Bazel, Lerna for efficient task running, caching, and code generation.
allowed-tools: Read,Write,Edit,Bash,Glob,Grep
---

# Monorepo Tooling Skill

## Overview

This skill provides comprehensive guidance on monorepo build systems, task
runners, package managers, and development tools that enable efficient
development, building, and testing across multiple packages in a monorepo.

## Build Systems

### Turborepo

High-performance build system with intelligent caching and task orchestration.

#### Pipeline Configuration

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [
    ".env",
    "tsconfig.json"
  ],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [
        "dist/**",
        ".next/**",
        "build/**"
      ],
      "cache": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "cache": true
    },
    "lint": {
      "outputs": [],
      "cache": true
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "deploy": {
      "dependsOn": ["build", "test", "lint"],
      "cache": false
    }
  },
  "globalEnv": [
    "NODE_ENV",
    "CI"
  ]
}
```

#### Remote Cache Configuration

```json
{
  "remoteCache": {
    "enabled": true
  }
}
```

With Vercel:

```bash
# Link to Vercel for remote caching
turbo login
turbo link
```

With custom cache:

```json
{
  "remoteCache": {
    "enabled": true,
    "signature": true,
    "preflight": true
  }
}
```

#### Key Features

- **Incremental builds**: Only rebuild changed packages
- **Remote caching**: Share cache across team and CI
- **Parallel execution**: Run tasks in parallel when safe
- **Pipeline dependencies**: Automatic task ordering
- **Pruning**: Extract subset of monorepo
- **Filtering**: Run tasks on specific packages

**Usage**:

```bash
# Run build across all packages
turbo run build

# Run with filter
turbo run build --filter=@myorg/web

# Run with dependencies
turbo run build --filter=@myorg/web...

# Force rebuild (skip cache)
turbo run build --force

# Dry run
turbo run build --dry-run

# Prune for deployment
turbo prune --scope=@myorg/web
```

### Nx

Extensible build system with powerful code generation and analysis.

#### Workspace Configuration

```json
{
  "extends": "nx/presets/npm.json",
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": [
          "build",
          "test",
          "lint"
        ],
        "parallel": 3,
        "cacheDirectory": "node_modules/.cache/nx"
      }
    }
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["{projectRoot}/dist"],
      "cache": true
    },
    "test": {
      "inputs": [
        "default",
        "^production"
      ],
      "cache": true
    }
  },
  "namedInputs": {
    "default": [
      "{projectRoot}/**/*"
    ],
    "production": [
      "default",
      "!{projectRoot}/**/*.spec.ts"
    ]
  }
}
```

#### Project Configuration

```json
{
  "name": "web",
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/apps/web",
        "main": "apps/web/src/main.ts",
        "tsConfig": "apps/web/tsconfig.app.json"
      }
    },
    "serve": {
      "executor": "@nx/webpack:dev-server",
      "options": {
        "buildTarget": "web:build"
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/apps/web"],
      "options": {
        "jestConfig": "apps/web/jest.config.ts"
      }
    }
  }
}
```

#### Nx Cloud Configuration

```json
{
  "nxCloudAccessToken": "YOUR_ACCESS_TOKEN",
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx-cloud",
      "options": {
        "cacheableOperations": ["build", "test", "lint"],
        "accessToken": "YOUR_ACCESS_TOKEN"
      }
    }
  }
}
```

#### Nx Key Features

- **Computation caching**: Local and remote cache
- **Affected commands**: Run tasks on changed projects only
- **Code generators**: Scaffolding for new projects
- **Dependency graph**: Visualize project relationships
- **Module boundaries**: Enforce architectural rules
- **Distributed execution**: Parallel task execution

**Usage**:

```bash
# Run target on all projects
nx run-many --target=build --all

# Run on affected projects only
nx affected --target=test --base=main

# View dependency graph
nx graph

# Generate new library
nx generate @nx/js:library my-lib

# Run task on specific project
nx build web

# Clear cache
nx reset
```

### Bazel

Google's scalable build system for very large monorepos.

#### WORKSPACE File

```python
workspace(name = "my_workspace")

load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")

# Load Node.js rules
http_archive(
    name = "build_bazel_rules_nodejs",
    sha256 = "...",
    urls = ["https://github.com/bazelbuild/rules_nodejs/..."],
)

load("@build_bazel_rules_nodejs//:index.bzl", "node_repositories")

node_repositories(
    node_version = "18.16.0",
    package_manager = "pnpm",
)
```

#### BUILD File

```python
# packages/ui/BUILD.bazel
load("@build_bazel_rules_nodejs//:index.bzl", "pkg_npm")
load("@npm//@bazel/typescript:index.bzl", "ts_library")

ts_library(
    name = "ui",
    srcs = glob(["src/**/*.ts", "src/**/*.tsx"]),
    deps = [
        "@npm//react",
        "@npm//react-dom",
        "@npm//@types/react",
    ],
    visibility = ["//visibility:public"],
)

pkg_npm(
    name = "ui_pkg",
    deps = [":ui"],
    package_name = "@myorg/ui",
    substitutions = {
        "0.0.0-PLACEHOLDER": "{STABLE_VERSION}",
    },
)
```

#### Bazel Key Features

- **Hermetic builds**: Reproducible builds
- **Remote execution**: Distribute builds across machines
- **Fine-grained caching**: Cache at file level
- **Language agnostic**: Support many languages
- **Scalability**: Handle massive codebases
- **Build correctness**: Reliable dependency tracking

**Usage**:

```bash
# Build target
bazel build //packages/ui:ui

# Build all targets in package
bazel build //packages/ui/...

# Test target
bazel test //packages/ui:ui_test

# Run target
bazel run //apps/web:serve

# Clean builds
bazel clean

# Query dependency graph
bazel query 'deps(//packages/ui:ui)'
```

### Lerna

Multi-package repository management and publishing tool.

#### Lerna Configuration

```json
{
  "version": "independent",
  "npmClient": "pnpm",
  "useWorkspaces": true,
  "packages": [
    "packages/*",
    "apps/*"
  ],
  "command": {
    "publish": {
      "conventionalCommits": true,
      "message": "chore(release): publish",
      "ignoreChanges": [
        "**/__tests__/**",
        "**/*.md"
      ]
    },
    "version": {
      "allowBranch": ["main", "next"],
      "message": "chore(release): version packages"
    },
    "bootstrap": {
      "npmClientArgs": ["--no-package-lock"]
    }
  }
}
```

#### Lerna Key Features

- **Version management**: Fixed or independent versioning
- **Publishing**: Automated package publishing
- **Bootstrap**: Link local packages
- **Changed detection**: Identify modified packages
- **Conventional commits**: Automated changelogs
- **Workspace integration**: Works with NPM/Yarn/PNPM

**Usage**:

```bash
# Bootstrap packages
lerna bootstrap

# Run command in all packages
lerna run build

# Run command in changed packages
lerna run test --since origin/main

# Publish packages
lerna publish

# Publish from git tags
lerna publish from-git

# Version packages
lerna version

# List packages
lerna list
```

### Rush

Scalable monorepo manager with strict dependency management.

#### Rush Configuration

```json
{
  "rushVersion": "5.108.0",
  "pnpmVersion": "8.10.0",
  "nodeSupportedVersionRange": ">=18.0.0",
  "projectFolderMinDepth": 1,
  "projectFolderMaxDepth": 2,
  "projects": [
    {
      "packageName": "@myorg/web",
      "projectFolder": "apps/web",
      "reviewCategory": "production"
    },
    {
      "packageName": "@myorg/ui",
      "projectFolder": "packages/ui",
      "reviewCategory": "production"
    }
  ]
}
```

Rush build configuration:

```json
{
  "operationSettings": [
    {
      "operationName": "build",
      "outputFolderNames": ["dist", "lib"]
    }
  ]
}
```

#### Rush Key Features

- **Phantom dependencies prevention**: Strict dependency checking
- **Subset installs**: Install only needed packages
- **Change tracking**: Detect which projects changed
- **Build cache**: Share builds across team
- **Policy enforcement**: Package management rules
- **Incremental builds**: Only rebuild changed packages

**Usage**:

```bash
# Install dependencies
rush install

# Update dependencies
rush update

# Build all projects
rush build

# Build changed projects
rush rebuild

# Custom commands
rush my-command

# Publish packages
rush publish
```

## Task Running

### Parallel Execution

Execute tasks across packages in parallel for speed.

**Turborepo parallel execution**:

```bash
# Auto-detects parallelism
turbo run build

# Limit concurrency
turbo run build --concurrency=4

# No limit
turbo run build --concurrency=100
```

**Nx parallel execution**:

```bash
# Default parallel (3)
nx run-many --target=build --all

# Custom parallel
nx run-many --target=build --all --parallel=5

# Max parallel
nx run-many --target=build --all --parallel=false
```

**PNPM parallel execution**:

```bash
# Run in all packages (parallel)
pnpm -r run build

# Sequential execution
pnpm -r --workspace-concurrency=1 run build

# Custom concurrency
pnpm -r --workspace-concurrency=4 run build
```

### Task Dependencies

Define which tasks must complete before others.

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "deploy": {
      "dependsOn": ["build", "test", "lint"]
    }
  }
}
```

**Dependency types**:

- `^build` - Build dependencies first (topological)
- `build` - Current package build first
- `["^build", "lint"]` - Multiple dependencies

### Selective Task Execution

Run tasks on specific packages or changed packages only.

**Turborepo filtering**:

```bash
# Single package
turbo run build --filter=@myorg/web

# Package and dependencies
turbo run build --filter=@myorg/web...

# Package and dependents
turbo run build --filter=...@myorg/web

# Multiple packages
turbo run build --filter=@myorg/web --filter=@myorg/api

# Changed packages
turbo run build --filter=[HEAD^1]
```

**Nx affected**:

```bash
# Affected by current changes
nx affected --target=build

# Affected between commits
nx affected --target=test --base=main --head=HEAD

# Affected files
nx affected:apps
nx affected:libs
```

**PNPM filtering**:

```bash
# Single package
pnpm --filter @myorg/web run build

# Package and dependencies
pnpm --filter @myorg/web... run build

# Package and dependents
pnpm --filter ...@myorg/web run build

# Changed packages
pnpm --filter "[main]" run test
```

### Watch Mode Across Packages

Automatically rebuild on file changes.

```json
{
  "scripts": {
    "dev": "turbo run dev --parallel",
    "dev:web": "turbo run dev --filter=@myorg/web..."
  }
}
```

With concurrently:

```json
{
  "scripts": {
    "dev": "concurrently \"pnpm:dev:*\"",
    "dev:web": "pnpm --filter @myorg/web run dev",
    "dev:api": "pnpm --filter @myorg/api run dev"
  }
}
```

With Turborepo watch:

```bash
# Watch mode for development
turbo run dev --parallel --no-cache
```

## Caching Strategies

### Local Computation Cache

Cache task outputs locally for faster rebuilds.

**Turborepo local cache**:

```json
{
  "pipeline": {
    "build": {
      "outputs": ["dist/**", ".next/**"],
      "cache": true
    }
  }
}
```

Cache location: `node_modules/.cache/turbo`

**Nx local cache**:

```json
{
  "tasksRunnerOptions": {
    "default": {
      "options": {
        "cacheableOperations": ["build", "test", "lint"],
        "cacheDirectory": "node_modules/.cache/nx"
      }
    }
  }
}
```

Cache location: `node_modules/.cache/nx`

### Remote Cache

Share cache across team members and CI environments.

**Turborepo Remote Cache with Vercel**:

```bash
# Login to Vercel
turbo login

# Link repository
turbo link

# Enable remote caching (automatic)
turbo run build
```

**Nx Cloud**:

```bash
# Connect to Nx Cloud
nx connect-to-nx-cloud
```

```json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx-cloud",
      "options": {
        "cacheableOperations": ["build", "test", "lint"],
        "accessToken": "YOUR_TOKEN"
      }
    }
  }
}
```

**Custom Remote Cache**:

```typescript
// turbo-remote-cache.ts
import { createServer } from 'turbo-remote-cache';

createServer({
  storage: {
    type: 's3',
    bucket: 'my-turbo-cache',
    region: 'us-east-1'
  },
  port: 3000
});
```

### Cache Keys and Invalidation

Control what invalidates the cache.

**Turborepo cache keys**:

```json
{
  "globalDependencies": [
    ".env",
    "tsconfig.json",
    ".eslintrc.js"
  ],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**/*.ts",
        "src/**/*.tsx",
        "package.json"
      ],
      "outputs": ["dist/**"]
    }
  }
}
```

**Nx cache inputs**:

```json
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*"],
    "production": [
      "default",
      "!{projectRoot}/**/*.spec.ts",
      "!{projectRoot}/**/*.test.ts"
    ],
    "sharedGlobals": [
      "{workspaceRoot}/tsconfig.base.json",
      "{workspaceRoot}/.eslintrc.json"
    ]
  },
  "targetDefaults": {
    "build": {
      "inputs": ["production", "^production", "sharedGlobals"]
    }
  }
}
```

**Cache invalidation**:

```bash
# Clear all caches
turbo run build --force

# Clear Nx cache
nx reset

# Skip cache for single run
nx build web --skip-nx-cache
```

### Docker Layer Caching

Optimize Docker builds in monorepo context.

```dockerfile
# Dockerfile for web app
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy root package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY .npmrc ./

# Copy package files for dependencies
COPY packages/ui/package.json ./packages/ui/
COPY packages/utils/package.json ./packages/utils/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build with Turbo
RUN pnpm turbo run build --filter=@myorg/web...

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["node", "apps/web/.next/server.js"]
```

## Code Generation

### Nx Generators

Create custom code generators for consistency.

```typescript
// tools/generators/library/index.ts
import {
  Tree,
  formatFiles,
  generateFiles,
  joinPathFragments
} from '@nx/devkit';

export interface LibraryGeneratorSchema {
  name: string;
  directory: string;
}

export default async function (tree: Tree, schema: LibraryGeneratorSchema) {
  const projectRoot = joinPathFragments('packages', schema.directory);

  generateFiles(
    tree,
    joinPathFragments(__dirname, 'files'),
    projectRoot,
    {
      ...schema,
      tmpl: ''
    }
  );

  await formatFiles(tree);
}
```

Template files:

```typescript
// tools/generators/library/files/src/index.ts__tmpl__
export function <%= name %>() {
  return '<%= name %>';
}
```

```json
// tools/generators/library/files/package.json__tmpl__
{
  "name": "@myorg/<%= name %>",
  "version": "0.0.1"
}
```

Usage:

```bash
nx generate @myorg/tools:library --name=my-lib --directory=shared
```

### Plop Templates

Use Plop for simpler code generation.

```javascript
// plopfile.js
export default function (plop) {
  plop.setGenerator('package', {
    description: 'Create a new package',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Package name:'
      },
      {
        type: 'list',
        name: 'type',
        message: 'Package type:',
        choices: ['library', 'app', 'service']
      }
    ],
    actions: [
      {
        type: 'addMany',
        destination: 'packages/{{name}}',
        templateFiles: 'templates/package/**/*',
        base: 'templates/package'
      }
    ]
  });
}
```

Templates:

```json
// templates/package/package.json
{
  "name": "@myorg/{{name}}",
  "version": "0.0.1",
  "type": "{{type}}"
}
```

Usage:

```bash
pnpm plop package
```

### Package Scaffolding

Automate new package creation.

```bash
#!/bin/bash
# scripts/create-package.sh

NAME=$1
TYPE=$2

if [ -z "$NAME" ]; then
  echo "Usage: create-package.sh <name> <type>"
  exit 1
fi

DIR="packages/$NAME"

# Create directory structure
mkdir -p "$DIR/src"
mkdir -p "$DIR/__tests__"

# Create package.json
cat > "$DIR/package.json" << EOF
{
  "name": "@myorg/$NAME",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  }
}
EOF

# Create initial files
echo "export const $NAME = '$NAME';" > "$DIR/src/index.ts"

# Create README
cat > "$DIR/README.md" << EOF
# @myorg/$NAME

Description of $NAME package.
EOF

echo "Created package: @myorg/$NAME"
```

### Consistent Boilerplate

Maintain consistency with shared templates.

```typescript
// scripts/new-component.ts
import fs from 'fs';
import path from 'path';

interface ComponentOptions {
  name: string;
  package: string;
}

function createComponent({ name, package: pkg }: ComponentOptions) {
  const dir = path.join('packages', pkg, 'src', 'components', name);

  fs.mkdirSync(dir, { recursive: true });

  // Component file
  fs.writeFileSync(
    path.join(dir, `${name}.tsx`),
    `import React from 'react';

export interface ${name}Props {
  children?: React.ReactNode;
}

export function ${name}({ children }: ${name}Props) {
  return <div>{children}</div>;
}
`
  );

  // Test file
  fs.writeFileSync(
    path.join(dir, `${name}.test.tsx`),
    `import { render } from '@testing-library/react';
import { ${name} } from './${name}';

describe('${name}', () => {
  it('renders children', () => {
    const { getByText } = render(<${name}>Hello</${name}>);
    expect(getByText('Hello')).toBeInTheDocument();
  });
});
`
  );

  // Index file
  fs.writeFileSync(
    path.join(dir, 'index.ts'),
    `export { ${name} } from './${name}';
export type { ${name}Props } from './${name}';
`
  );
}
```

## Affected Analysis

### Git-Based Change Detection

Identify which packages changed based on Git history.

**Turborepo**:

```bash
# Changed since last commit
turbo run build --filter=[HEAD^1]

# Changed in last 3 commits
turbo run build --filter=[HEAD^3]

# Changed between branches
turbo run build --filter=[origin/main...HEAD]
```

**Nx**:

```bash
# Affected since main branch
nx affected --target=build --base=main

# Affected between specific commits
nx affected --target=test --base=abc123 --head=def456

# Show affected projects
nx affected:apps
nx affected:libs
```

### Dependency Graph Analysis

Understand project relationships for smarter builds.

**Visualize with Nx**:

```bash
# Full dependency graph
nx graph

# Affected dependency graph
nx affected:graph

# Specific project graph
nx graph --focus=web
```

**Query with Nx**:

```bash
# Show dependencies of project
nx show project web --web

# List all projects
nx show projects
```

**Turborepo graph**:

```bash
# Generate task graph
turbo run build --graph

# Output to file
turbo run build --graph=graph.html
```

### Smart Rebuild Strategies

Only rebuild what's necessary based on changes.

**Nx affected strategy**:

```json
{
  "affected": {
    "defaultBase": "main"
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"]
    }
  }
}
```

**Turborepo affected strategy**:

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

CI configuration:

```yaml
# .github/workflows/ci.yml
- name: Build affected
  run: |
    turbo run build --filter=[origin/main...HEAD]
```

### Incremental Builds

Build only changed files within packages.

**TypeScript incremental builds**:

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": "./dist/.tsbuildinfo"
  }
}
```

**Webpack incremental builds**:

```javascript
module.exports = {
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename]
    }
  }
};
```

**Next.js incremental builds**:

```javascript
// next.config.js
module.exports = {
  experimental: {
    incrementalCacheHandlerPath: './cache-handler.js'
  }
};
```

## Package Management

### PNPM Workspaces

Fast, disk-efficient package manager with strict dependency model.

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'services/*'
```

```ini
# .npmrc
shared-workspace-lockfile=true
link-workspace-packages=true
prefer-workspace-packages=true
strict-peer-dependencies=false
auto-install-peers=true
save-workspace-protocol=rolling
```

**Key advantages**:

- Content-addressable storage (saves disk space)
- Strict node_modules structure (no phantom dependencies)
- Fastest installation speed
- Built-in monorepo support
- Workspace protocol support

**Commands**:

```bash
# Install all workspace dependencies
pnpm install

# Add dependency to package
pnpm --filter @myorg/web add react

# Add workspace dependency
pnpm --filter @myorg/web add @myorg/ui

# Update dependencies
pnpm --filter @myorg/web update react

# Run script in all packages
pnpm -r run build

# Run in changed packages
pnpm --filter "[main]" run test
```

### Yarn Workspaces

Yarn's workspace implementation with plugin ecosystem.

**Yarn Classic**:

```json
{
  "workspaces": [
    "packages/*",
    "apps/*"
  ]
}
```

**Yarn Berry** (v2+):

```yaml
# .yarnrc.yml
nodeLinker: node-modules

yarnPath: .yarn/releases/yarn-3.6.4.cjs

plugins:
  - path: .yarn/plugins/@yarnpkg/plugin-workspace-tools.cjs
    spec: "@yarnpkg/plugin-workspace-tools"
```

**Key advantages**:

- Plugin architecture (Berry)
- Zero-installs option (Berry)
- Advanced workspace commands
- Wide ecosystem support
- Good TypeScript support

**Commands**:

```bash
# Install dependencies
yarn install

# Add dependency
yarn workspace @myorg/web add react

# Run script in workspace
yarn workspace @myorg/web run build

# Run in all workspaces
yarn workspaces foreach run build

# Run in changed workspaces (Berry)
yarn workspaces foreach --since=main run test
```

### NPM Workspaces

Native NPM workspace support (v7+).

```json
{
  "workspaces": [
    "packages/*",
    "apps/*"
  ]
}
```

**Key advantages**:

- Native NPM support
- No additional tools needed
- Simple configuration
- Widespread compatibility
- Well-documented

**Commands**:

```bash
# Install dependencies
npm install

# Add dependency to workspace
npm install react --workspace=@myorg/web

# Run script in workspace
npm run build --workspace=@myorg/web

# Run in all workspaces
npm run build --workspaces

# Run in specific workspaces
npm run test --workspaces --if-present
```

### Tool Comparison and Migration

**Performance comparison** (1000 packages, cold install):

- PNPM: ~30 seconds
- Yarn Berry: ~45 seconds
- NPM: ~90 seconds
- Yarn Classic: ~120 seconds

**Migration from NPM to PNPM**:

```bash
# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Install PNPM
corepack enable pnpm

# Create workspace file
cat > pnpm-workspace.yaml << EOF
packages:
  - 'packages/*'
  - 'apps/*'
EOF

# Install with PNPM
pnpm install

# Update package.json scripts
# Replace "npm" with "pnpm"
```

**Migration from Yarn to PNPM**:

```bash
# Remove node_modules and yarn.lock
rm -rf node_modules yarn.lock

# Create workspace file (convert from package.json)
cat > pnpm-workspace.yaml << EOF
packages:
  - 'packages/*'
  - 'apps/*'
EOF

# Install with PNPM
pnpm install --lockfile-only
pnpm install
```

## Best Practices

### 1. Use Caching Extensively

Leverage local and remote caching for maximum speed.

**Implementation**:

- Enable caching for all deterministic tasks
- Configure remote cache for CI/CD
- Set up proper cache keys
- Monitor cache hit rates
- Document cache configuration

### 2. Configure Remote Cache for CI

Share build artifacts across CI runs and developers.

**Implementation**:

- Set up remote cache service (Vercel, Nx Cloud, S3)
- Configure authentication
- Enable in CI environment
- Monitor cache usage
- Implement cache warming

### 3. Leverage Affected Commands

Only run tasks on changed packages.

**Implementation**:

- Use affected analysis in CI
- Configure base branch correctly
- Test affected strategy locally
- Document affected commands
- Combine with caching

### 4. Optimize Task Pipelines

Design efficient task dependency graphs.

**Implementation**:

- Minimize task dependencies
- Enable parallel execution
- Configure appropriate concurrency
- Use pipeline visualization
- Profile pipeline performance

### 5. Use Code Generation for Consistency

Automate package and component creation.

**Implementation**:

- Create generators for common patterns
- Document generator usage
- Maintain generator templates
- Use generators in CI for validation
- Regular template updates

### 6. Version Lock Files in Monorepo

Commit lock files for reproducible builds.

**Implementation**:

- Commit root lock file
- Don't commit package lock files
- Use `--frozen-lockfile` in CI
- Regular lock file updates
- Document lock file policy

### 7. Document Tool Usage

Maintain clear documentation for all tools.

**Implementation**:

- README with tool overview
- Command reference
- Configuration explanations
- Troubleshooting guide
- Migration guides

### 8. Monitor Build Performance

Track and optimize build times.

**Implementation**:

- Measure build times in CI
- Track cache hit rates
- Profile slow tasks
- Set performance budgets
- Regular performance reviews

### 9. Keep Tools Updated

Stay current with monorepo tool versions.

**Implementation**:

- Regular update schedule
- Test updates in CI
- Review changelogs
- Gradual rollout
- Rollback plan

### 10. Validate Workspace Integrity

Ensure workspace is correctly configured.

**Implementation**:

- Automated validation in CI
- Check for phantom dependencies
- Verify package relationships
- Validate versions
- Audit security

## Common Pitfalls

### 1. Not Using Build Caching

Missing significant performance gains.

**Solution**: Enable local and remote caching, configure outputs correctly.

### 2. Poor Pipeline Configuration

Inefficient task dependencies and ordering.

**Solution**: Minimize dependencies, enable parallelism, visualize pipeline.

### 3. Running All Tasks Always

Not using affected analysis.

**Solution**: Implement affected commands, configure base branch, test locally.

### 4. Ignoring Affected Analysis

Wasting CI time on unchanged packages.

**Solution**: Use affected in CI, configure correctly, monitor savings.

### 5. Manual Package Creation

Inconsistent package structure.

**Solution**: Create generators, document usage, enforce in reviews.

### 6. Inconsistent Tool Usage

Different team members using different commands.

**Solution**: Document standard commands, use package.json scripts, code review.

### 7. Cache Invalidation Issues

Stale builds from incorrect cache configuration.

**Solution**: Configure inputs/outputs correctly, test cache behavior, monitor.

### 8. Over-Complicated Pipelines

Complex task graphs that are hard to maintain.

**Solution**: Simplify dependencies, regular reviews, documentation.

### 9. Mixing Tools Unnecessarily

Using multiple tools that overlap.

**Solution**: Choose one primary tool, justify additions, regular audits.

### 10. No Performance Monitoring

Not tracking build performance over time.

**Solution**: Implement metrics, regular reviews, set budgets, optimize.

## When to Use This Skill

Apply monorepo tooling practices when:

- **Setting up new monorepo** - Choosing and configuring tools
- **Optimizing build performance** - Improving speed and efficiency
- **Migrating between tools** - Moving from one tool to another
- **Configuring CI/CD** - Setting up automated builds and tests
- **Implementing caching** - Local and remote cache setup
- **Creating generators** - Automating code scaffolding
- **Troubleshooting builds** - Solving build and dependency issues
- **Scaling monorepo** - Handling growth and complexity
- **Team onboarding** - Teaching developers monorepo workflows
- **Evaluating tools** - Comparing and selecting monorepo tools

## Resources

- [Turborepo Documentation](https://turbo.build/repo/docs) - Comprehensive
  guide to Turborepo features and configuration
- [Nx Documentation](https://nx.dev/getting-started/intro) - Complete Nx
  workspace guide with examples
- [PNPM Workspaces](https://pnpm.io/workspaces) - PNPM workspace features
  and configuration
- [Yarn Workspaces](https://yarnpkg.com/features/workspaces) - Yarn
  workspace implementation guide
- [Bazel Documentation](https://bazel.build/start) - Getting started with
  Bazel build system
- [Lerna Documentation](https://lerna.js.org/docs/introduction) - Managing
  JavaScript monorepos with Lerna
- [Rush Documentation](https://rushjs.io/pages/intro/welcome/) - Scalable
  monorepo solution for Node.js
- [Monorepo.tools](https://monorepo.tools/) - Comprehensive comparison of
  monorepo tools and features
