---
name: monorepo-architecture
description: Use when designing monorepo structure, organizing packages, or migrating to monorepo architecture with architectural patterns for managing dependencies and scalable workspace configurations.
allowed-tools: Read,Write,Edit,Bash,Glob,Grep
---

# Monorepo Architecture Skill

## Overview

This skill provides comprehensive guidance on designing and structuring
monorepos, including workspace organization, dependency management, versioning
strategies, and architectural patterns that scale from small projects to
enterprise applications.

## Monorepo vs Polyrepo

### When to Choose Monorepo

A monorepo is beneficial when:

- **Code sharing is frequent**: Multiple projects share common libraries,
  utilities, or components
- **Atomic changes needed**: Changes span multiple packages and need to be
  deployed together
- **Unified tooling**: All projects benefit from consistent linting, testing,
  and build processes
- **Team collaboration**: Teams work across project boundaries and need
  visibility into related code
- **Version synchronization**: Related packages should maintain version
  alignment
- **Refactoring at scale**: Large-scale refactoring across projects is common
- **Single source of truth**: All code, documentation, and tooling in one place

### When to Choose Polyrepo

A polyrepo is beneficial when:

- **Independent release cycles**: Projects deploy on completely different
  schedules
- **Different tech stacks**: Projects use incompatible tooling or languages
- **Access control**: Different teams need isolated access to separate codebases
- **Repository size concerns**: Combined codebase would be too large to manage
  efficiently
- **External dependencies**: Projects are maintained by different organizations
- **Simple project structure**: Overhead of monorepo tooling outweighs benefits

### Tradeoffs

**Monorepo Advantages**:

- Simplified dependency management
- Easier refactoring across boundaries
- Consistent tooling and standards
- Better code discoverability
- Atomic commits across projects
- Single CI/CD pipeline

**Monorepo Challenges**:

- Repository size growth
- CI/CD complexity
- Build time management
- Git performance at scale
- Tooling requirements
- Learning curve for developers

## Repository Structure Patterns

### Package-Based Structure

Organize by technical layer or package type.

```text
my-monorepo/
├── apps/
│   ├── web/                 # Next.js web application
│   ├── mobile/              # React Native app
│   └── api/                 # Node.js API server
├── packages/
│   ├── ui/                  # Shared UI components
│   ├── utils/               # Shared utilities
│   ├── config/              # Shared configurations
│   └── types/               # Shared TypeScript types
├── services/
│   ├── auth/                # Authentication service
│   ├── payments/            # Payment processing
│   └── notifications/       # Notification service
└── tooling/
    ├── eslint-config/       # ESLint configuration
    └── tsconfig/            # TypeScript configuration
```

**Best for**: Technical separation, shared library focus, platform diversity.

### Domain-Based Structure

Organize by business domain or feature.

```text
my-monorepo/
├── domains/
│   ├── user/
│   │   ├── api/            # User API
│   │   ├── web/            # User web UI
│   │   ├── mobile/         # User mobile UI
│   │   └── shared/         # User shared code
│   ├── billing/
│   │   ├── api/
│   │   ├── web/
│   │   └── shared/
│   └── analytics/
│       ├── api/
│       ├── web/
│       └── shared/
└── shared/
    ├── ui/                 # Cross-domain UI components
    ├── utils/              # Cross-domain utilities
    └── config/             # Cross-domain config
```

**Best for**: Domain-driven design, team ownership by feature, microservices
architecture.

### Hybrid Structure

Combine package-based and domain-based approaches.

```text
my-monorepo/
├── apps/
│   ├── customer-portal/    # Customer-facing app
│   └── admin-dashboard/    # Admin app
├── features/
│   ├── auth/               # Authentication feature
│   ├── checkout/           # Checkout feature
│   └── inventory/          # Inventory feature
├── packages/
│   ├── ui/                 # Shared UI library
│   ├── api-client/         # API client library
│   └── analytics/          # Analytics library
└── infrastructure/
    ├── database/           # Database utilities
    ├── messaging/          # Message queue
    └── deployment/         # Deployment configs
```

**Best for**: Complex organizations, balancing technical and domain concerns.

## Workspace Configuration

### NPM Workspaces

Basic workspace setup using native NPM workspaces.

```json
{
  "name": "my-monorepo",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev --workspaces",
    "build": "npm run build --workspaces",
    "test": "npm run test --workspaces"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "eslint": "^8.54.0"
  }
}
```

**Key Features**:

- Native NPM support (v7+)
- Simple configuration
- Automatic workspace linking
- Shared dependency hoisting
- Workspace-specific commands

### Yarn Workspaces

Yarn's workspace implementation with additional features.

```json
{
  "name": "my-monorepo",
  "private": true,
  "workspaces": {
    "packages": [
      "apps/*",
      "packages/*"
    ],
    "nohoist": [
      "**/react-native",
      "**/react-native/**"
    ]
  },
  "packageManager": "yarn@3.6.4"
}
```

With `.yarnrc.yml` for Yarn Berry:

```yaml
nodeLinker: node-modules

plugins:
  - path: .yarn/plugins/@yarnpkg/plugin-workspace-tools.cjs
    spec: "@yarnpkg/plugin-workspace-tools"

enableGlobalCache: true

compressionLevel: mixed
```

**Key Features**:

- Fast installation
- Plugin system (Yarn Berry)
- Advanced workspace commands
- No-hoist for specific dependencies
- Zero-installs capability

### PNPM Workspaces

PNPM's efficient workspace implementation.

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'services/*'
  - '!**/test/**'
```

With workspace-specific `.npmrc`:

```ini
# .npmrc
shared-workspace-lockfile=true
link-workspace-packages=true
prefer-workspace-packages=true
strict-peer-dependencies=false
auto-install-peers=true
```

**Key Features**:

- Content-addressable storage
- Strict node_modules structure
- Faster than NPM/Yarn
- Efficient disk space usage
- Built-in monorepo support

### Cargo Workspaces (Rust)

Rust monorepo workspace configuration.

```toml
# Cargo.toml (root)
[workspace]
members = [
    "crates/core",
    "crates/api",
    "crates/cli",
]
exclude = ["archived/*"]

[workspace.package]
version = "1.0.0"
edition = "2021"
license = "MIT"

[workspace.dependencies]
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1.35", features = ["full"] }
```

Individual crate:

```toml
# crates/core/Cargo.toml
[package]
name = "my-core"
version.workspace = true
edition.workspace = true
license.workspace = true

[dependencies]
serde.workspace = true
tokio.workspace = true
my-api = { path = "../api" }
```

## Dependency Management

### Internal Package Dependencies

Specify dependencies on other workspace packages.

```json
{
  "name": "@myorg/web-app",
  "version": "1.0.0",
  "dependencies": {
    "@myorg/ui": "workspace:*",
    "@myorg/utils": "workspace:^",
    "@myorg/api-client": "1.2.3",
    "react": "^18.2.0"
  }
}
```

**Workspace Protocol Variants**:

- `workspace:*` - Any version in workspace
- `workspace:^` - Compatible version (semver caret)
- `workspace:~` - Patch-level version (semver tilde)
- Specific version - Exact workspace version

### Shared Dependencies Hoisting

Configure how dependencies are hoisted to root.

```json
{
  "name": "my-monorepo",
  "workspaces": {
    "packages": ["packages/*"],
    "nohoist": [
      "**/react-native",
      "**/react-native/**",
      "**/@babel/**"
    ]
  }
}
```

**Hoisting Strategies**:

- **Full hoisting**: All common dependencies at root (default)
- **Selective hoisting**: Specific packages hoisted, others isolated
- **No hoisting**: Each package has isolated dependencies
- **Public hoisting**: Only public dependencies hoisted

### Version Synchronization

Keep related dependencies in sync across packages.

```json
{
  "name": "my-monorepo",
  "private": true,
  "syncpack": {
    "semverGroups": [
      {
        "range": "",
        "dependencies": ["react", "react-dom"],
        "packages": ["**"]
      }
    ],
    "versionGroups": [
      {
        "label": "React ecosystem must match",
        "dependencies": ["react", "react-dom"],
        "dependencyTypes": ["prod", "dev"],
        "pinVersion": "18.2.0"
      }
    ]
  }
}
```

Use tools like `syncpack` to enforce consistency:

```bash
# Check for version inconsistencies
pnpm syncpack list-mismatches

# Fix version inconsistencies
pnpm syncpack fix-mismatches

# Update all versions
pnpm syncpack update
```

### Peer Dependencies in Monorepos

Handle peer dependencies correctly across workspace packages.

```json
{
  "name": "@myorg/ui",
  "version": "1.0.0",
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "peerDependenciesMeta": {
    "react-dom": {
      "optional": true
    }
  },
  "devDependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
```

**Best Practices**:

- Declare peer dependencies in shared libraries
- Include peer deps as dev dependencies for testing
- Use `peerDependenciesMeta` for optional peers
- Document peer dependency requirements
- Test with minimum and maximum peer versions

## Code Organization

### Shared Code Patterns

Organize shared code for maximum reusability.

```text
packages/
├── ui/
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── styles/          # Shared styles
│   │   └── index.ts         # Public API
│   └── package.json
├── utils/
│   ├── src/
│   │   ├── string/          # String utilities
│   │   ├── date/            # Date utilities
│   │   ├── validation/      # Validation functions
│   │   └── index.ts         # Public API
│   └── package.json
└── config/
    ├── eslint-config/
    ├── tsconfig/
    └── prettier-config/
```

**Shared Library Design**:

- Clear public API via barrel exports
- Minimal external dependencies
- Well-documented interfaces
- Comprehensive unit tests
- Semantic versioning
- Changelog maintenance

### Type Sharing Across Packages

Share TypeScript types efficiently.

```typescript
// packages/types/src/user.ts
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export enum UserRole {
  Admin = 'admin',
  User = 'user',
  Guest = 'guest',
}

export type CreateUserInput = Omit<User, 'id'>;
export type UpdateUserInput = Partial<CreateUserInput>;
```

```json
// packages/types/package.json
{
  "name": "@myorg/types",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./user": {
      "types": "./dist/user.d.ts",
      "default": "./dist/user.js"
    }
  }
}
```

### Configuration Sharing

Share build and tooling configuration across packages.

```javascript
// packages/tsconfig/base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
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

```json
// apps/web/tsconfig.json
{
  "extends": "@myorg/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "references": [
    { "path": "../../packages/ui" },
    { "path": "../../packages/utils" }
  ]
}
```

## Build Dependencies

### Dependency Graphs

Understand and visualize package dependencies.

```json
{
  "name": "@myorg/web",
  "dependencies": {
    "@myorg/ui": "workspace:*",
    "@myorg/api-client": "workspace:*"
  }
}
```

Generate dependency graph:

```bash
# Using pnpm
pnpm list --depth 10 --json > deps.json

# Using Nx
nx graph

# Using custom script
node scripts/generate-dep-graph.js
```

### Build Order Optimization

Ensure packages build in correct dependency order.

```json
{
  "name": "my-monorepo",
  "scripts": {
    "build": "turbo run build",
    "build:order": "pnpm -r --workspace-concurrency=1 run build"
  }
}
```

Turbo pipeline configuration:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"]
    }
  }
}
```

**Dependency Resolution**:

- `^build` - Build dependencies first
- `dependsOn` - Explicit task dependencies
- Topological sorting for correct order
- Parallel execution when safe

### Circular Dependency Detection

Prevent and detect circular dependencies.

```javascript
// scripts/check-circular-deps.js
import madge from 'madge';

async function checkCircularDeps() {
  const result = await madge('src', {
    fileExtensions: ['ts', 'tsx'],
    detectiveOptions: {
      ts: { skipTypeImports: true }
    }
  });

  const circular = result.circular();
  if (circular.length > 0) {
    console.error('Circular dependencies detected:');
    circular.forEach(cycle => {
      console.error(cycle.join(' -> '));
    });
    process.exit(1);
  }
}

checkCircularDeps();
```

Add to CI pipeline:

```yaml
# .github/workflows/ci.yml
- name: Check circular dependencies
  run: pnpm check:circular
```

## Versioning Strategies

### Independent Versioning

Each package has its own version, released independently.

```json
{
  "name": "@myorg/ui",
  "version": "2.1.0"
}
```

```json
{
  "name": "@myorg/utils",
  "version": "1.5.3"
}
```

**Advantages**:

- Fine-grained version control
- Independent release cycles
- Clear package maturity
- Semantic versioning per package

**Use when**:

- Packages have different stability levels
- Release frequency varies significantly
- Packages serve different purposes

### Fixed/Locked Versioning

All packages share the same version number.

```json
{
  "name": "@myorg/ui",
  "version": "3.2.0"
}
```

```json
{
  "name": "@myorg/utils",
  "version": "3.2.0"
}
```

**Advantages**:

- Simplified version management
- Clear release coordination
- Easier to track compatibility
- Unified changelog

**Use when**:

- Packages are tightly coupled
- All packages release together
- Single product with multiple packages
- Version sync is critical

### Semantic Versioning in Monorepos

Apply semver principles to workspace packages.

**Breaking Changes** (Major):

- Change public API signatures
- Remove exported functions
- Change function behavior significantly
- Update peer dependencies with breaking changes

**New Features** (Minor):

- Add new exports
- Add optional parameters
- Enhance existing functionality
- Add new optional features

**Bug Fixes** (Patch):

- Fix bugs without API changes
- Update documentation
- Refactor internal implementation
- Update dependencies (non-breaking)

## Best Practices

### 1. Clear Package Boundaries

Define explicit boundaries and responsibilities for each package.

**Implementation**:

- Document package purpose and scope
- Define public API explicitly
- Use barrel exports (`index.ts`)
- Minimize cross-package coupling
- Review package boundaries regularly

**Example**:

```typescript
// packages/ui/src/index.ts - Clear public API
export { Button } from './components/Button';
export { Input } from './components/Input';
export type { ButtonProps, InputProps } from './types';

// Internal implementation details NOT exported
// ./components/Button/ButtonStyles.ts
// ./utils/internal-helper.ts
```

### 2. Minimal Coupling Between Packages

Reduce dependencies between packages to maintain flexibility.

**Implementation**:

- Use dependency injection
- Prefer composition over inheritance
- Define clear interfaces
- Avoid deep dependency chains
- Use events/messaging for loose coupling

**Example**:

```typescript
// Loose coupling via interfaces
interface Logger {
  log(message: string): void;
}

class PaymentService {
  constructor(private logger: Logger) {}

  processPayment(amount: number) {
    this.logger.log(`Processing payment: ${amount}`);
    // Implementation
  }
}
```

### 3. Shared Tooling Configuration

Maintain consistent tooling across all packages.

**Implementation**:

- Create shared config packages
- Extend base configurations
- Use workspace inheritance
- Document configuration decisions
- Automate configuration validation

**Example**:

```json
// packages/eslint-config/index.json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "no-console": "warn",
    "@typescript-eslint/no-unused-vars": "error"
  }
}
```

### 4. Consistent Naming Conventions

Use predictable naming patterns across packages.

**Implementation**:

- Scope all packages (`@org/package-name`)
- Use kebab-case for package names
- Prefix related packages consistently
- Follow language/ecosystem conventions
- Document naming standards

**Example**:

```text
@myorg/web-app
@myorg/mobile-app
@myorg/ui-components
@myorg/api-client
@myorg/utils-date
@myorg/utils-string
@myorg/config-eslint
@myorg/config-typescript
```

### 5. Documentation Standards

Maintain comprehensive documentation for all packages.

**Implementation**:

- README in every package
- API documentation
- Usage examples
- Migration guides
- Contribution guidelines

**Example**:

```markdown
# @myorg/ui

React component library for MyOrg applications.

## Installation

`pnpm add @myorg/ui`

## Usage

import { Button } from '@myorg/ui';

<Button onClick={handleClick}>Click me</Button>

## API Reference

See [API.md](./API.md) for detailed documentation.
```

### 6. Package Ownership

Assign clear ownership and responsibility for packages.

**Implementation**:

- CODEOWNERS file
- Package maintainer documentation
- Review process for changes
- Communication channels
- Ownership rotation plan

**Example**:

```text
# CODEOWNERS
/packages/ui/ @frontend-team
/packages/api-client/ @api-team
/packages/auth/ @security-team
/services/ @backend-team
```

### 7. API Contracts

Define and maintain clear API contracts between packages.

**Implementation**:

- TypeScript interfaces
- OpenAPI specifications
- JSON Schema
- Contract testing
- Version compatibility matrix

**Example**:

```typescript
// packages/api-client/src/contracts.ts
/**
 * User API contract
 * @version 1.0.0
 */
export interface UserAPI {
  getUser(id: string): Promise<User>;
  createUser(data: CreateUserInput): Promise<User>;
  updateUser(id: string, data: UpdateUserInput): Promise<User>;
  deleteUser(id: string): Promise<void>;
}
```

### 8. Migration Strategies

Plan for package updates and breaking changes.

**Implementation**:

- Deprecation warnings
- Migration guides
- Compatibility layers
- Automated migrations (codemods)
- Version upgrade paths

**Example**:

```typescript
// Deprecation with migration path
/**
 * @deprecated Use `getUser` instead
 * This function will be removed in v3.0.0
 */
export function fetchUser(id: string): Promise<User> {
  console.warn('fetchUser is deprecated, use getUser instead');
  return getUser(id);
}
```

### 9. Security Boundaries

Maintain security isolation between packages.

**Implementation**:

- Separate sensitive packages
- Access control policies
- Security scanning per package
- Dependency audit
- Secret management

**Example**:

```json
{
  "scripts": {
    "security:audit": "pnpm audit --audit-level=high",
    "security:check": "pnpm dlx audit-ci --high"
  }
}
```

### 10. Testing Isolation

Ensure tests don't have unintended dependencies.

**Implementation**:

- Package-level test configuration
- Mock workspace dependencies
- Integration test suites
- CI test isolation
- Test data management

**Example**:

```typescript
// packages/ui/src/__tests__/Button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from '../Button';

// Test isolated from other packages
describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
```

## Common Pitfalls

### 1. Tight Coupling Between Packages

Creating excessive dependencies between packages.

**Symptoms**:

- Changes require updates across many packages
- Difficult to extract or move packages
- Long dependency chains
- Circular dependencies

**Solution**:

- Use dependency injection
- Define clear interfaces
- Implement event-driven communication
- Regular refactoring to reduce coupling

### 2. Unclear Package Responsibilities

Packages with overlapping or undefined purposes.

**Symptoms**:

- Duplicate functionality
- Uncertain where to add features
- Inconsistent implementations
- Code duplication

**Solution**:

- Document package purpose clearly
- Single Responsibility Principle
- Regular architecture reviews
- Refactor to clarify boundaries

### 3. Inconsistent Dependency Versions

Different versions of same dependency across packages.

**Symptoms**:

- Build errors
- Runtime conflicts
- Peer dependency warnings
- Bundle size bloat

**Solution**:

- Use workspace protocol
- Implement syncpack or similar
- Centralize version management
- CI checks for consistency

### 4. Poor Build Optimization

Not leveraging caching and incremental builds.

**Symptoms**:

- Slow build times
- Rebuilding unchanged packages
- Long CI pipeline runs
- Developer frustration

**Solution**:

- Implement build caching (Turborepo, Nx)
- Use affected analysis
- Configure incremental builds
- Optimize build pipelines

### 5. Missing Documentation

Inadequate documentation for packages and APIs.

**Symptoms**:

- Frequent questions about usage
- Incorrect usage patterns
- Difficult onboarding
- Knowledge silos

**Solution**:

- README in every package
- API documentation generation
- Usage examples
- Onboarding guides

### 6. Monolithic Thinking in Monorepo

Treating monorepo as single large application.

**Symptoms**:

- Shared global state
- Tightly coupled code
- Difficult to extract packages
- No clear package boundaries

**Solution**:

- Design packages as independent units
- Minimize shared global state
- Clear separation of concerns
- Regular boundary reviews

### 7. Over-Sharing Code

Sharing code that should remain private.

**Symptoms**:

- Implementation details exposed
- Brittle dependencies
- Difficult to refactor
- Version management complexity

**Solution**:

- Use barrel exports for public API
- Keep internals private
- Document public vs private
- Review exports regularly

### 8. Ignoring Package Boundaries

Importing from package internals instead of public API.

**Symptoms**:

- Brittle imports
- Breaking changes on refactor
- Unclear dependencies
- Type errors

**Solution**:

- Only import from package root
- Configure linting rules
- Use TypeScript project references
- Code review enforcement

### 9. No Versioning Strategy

Lack of clear versioning approach.

**Symptoms**:

- Unclear compatibility
- Breaking changes without warning
- Difficult rollbacks
- Consumer confusion

**Solution**:

- Choose fixed or independent versioning
- Use changesets or conventional commits
- Semantic versioning discipline
- Automated version management

### 10. Complex Dependency Chains

Deep or circular dependency relationships.

**Symptoms**:

- Difficult to understand flow
- Build order issues
- Circular dependency errors
- Maintenance difficulty

**Solution**:

- Visualize dependency graph
- Refactor to reduce depth
- Break circular dependencies
- Use dependency injection

## When to Use This Skill

Apply monorepo architecture principles when:

- **Designing new monorepos** - Setting up structure and organization
- **Refactoring existing repos** - Improving architecture and organization
- **Migrating to monorepo** - Moving from polyrepo to monorepo
- **Scaling monorepo** - Growing from small to large monorepo
- **Organizing packages** - Deciding package boundaries and structure
- **Managing dependencies** - Handling internal and external dependencies
- **Establishing patterns** - Creating architectural standards
- **Reviewing architecture** - Evaluating existing monorepo structure
- **Troubleshooting issues** - Solving dependency or organization problems
- **Planning refactors** - Restructuring packages or dependencies

## Resources

- [Monorepo.tools](https://monorepo.tools/) - Comprehensive comparison of
  monorepo tools and patterns
- [Turborepo Handbook](https://turbo.build/repo/docs/handbook) - Best
  practices for Turborepo architecture
- [Nx Monorepo Guide](https://nx.dev/concepts/more-concepts/why-monorepos) -
  Architectural concepts and patterns
- [PNPM Workspaces](https://pnpm.io/workspaces) - Documentation for PNPM
  workspace features
- [Yarn Workspaces](https://yarnpkg.com/features/workspaces) - Yarn workspace
  implementation guide
- [Lerna Documentation](https://lerna.js.org/) - Multi-package repository
  management
- [Bazel Documentation](https://bazel.build/) - Build and test system for
  large monorepos
- [Rush Documentation](https://rushjs.io/) - Scalable monorepo manager for
  JavaScript
