---
name: jutsu-bun:bun-package-manager
description: Use when managing dependencies with Bun's package manager. Covers installing packages, workspaces, lockfiles, and migrating from npm/yarn/pnpm to Bun.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Bun Package Manager

Use this skill when managing dependencies with Bun's package manager, which is significantly faster than npm, yarn, and pnpm while maintaining compatibility.

## Key Concepts

### Installing Dependencies

Bun's package manager is drop-in compatible with npm:

```bash
# Install all dependencies
bun install

# Add a dependency
bun add express
bun add -d typescript  # Dev dependency
bun add -g cowsay      # Global install

# Add specific version
bun add react@18.2.0

# Install from different sources
bun add git@github.com:user/repo.git
bun add ./local-package
```

### Removing Dependencies

```bash
# Remove a dependency
bun remove express

# Remove dev dependency
bun remove -d typescript
```

### Updating Dependencies

```bash
# Update all dependencies
bun update

# Update specific package
bun update react

# Update to latest (ignoring semver)
bun update react --latest
```

### Running Scripts

Execute package.json scripts:

```bash
# Run a script
bun run dev
bun run build
bun run test

# Short form (if no file conflict)
bun dev
bun build
bun test
```

## Best Practices

### Use bun.lockb

Bun's binary lockfile is faster and more reliable:

```bash
# Generate lockfile
bun install

# Commit bun.lockb to version control
git add bun.lockb
```

### Workspaces

Manage monorepos with workspaces:

```json
// package.json
{
  "name": "my-monorepo",
  "workspaces": ["packages/*", "apps/*"]
}
```

```bash
# Install all workspace dependencies
bun install

# Run script in specific workspace
bun --filter my-package run build

# Run script in all workspaces
bun --filter '*' run test
```

### Package.json Configuration

Configure Bun-specific options:

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "bun run --hot src/index.ts",
    "build": "bun build src/index.ts --outdir dist",
    "start": "bun run dist/index.js",
    "test": "bun test"
  },
  "dependencies": {
    "express": "^4.18.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "bun-types": "latest"
  },
  "peerDependencies": {
    "typescript": "^5.0.0"
  }
}
```

### TypeScript Configuration

Set up proper TypeScript support:

```json
// tsconfig.json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "ESNext",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "allowJs": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noPropertyAccessFromIndexSignature": false,
    "types": ["bun-types"]
  }
}
```

### Using Trusted Dependencies

Configure trusted dependencies for faster installs:

```bash
# Add trusted dependency
bun pm trust @prisma/client

# Install without lifecycle scripts (faster)
bun install --production --frozen-lockfile
```

## Common Patterns

### Migration from npm/yarn/pnpm

```bash
# Remove old lockfiles
rm package-lock.json yarn.lock pnpm-lock.yaml

# Install with Bun
bun install

# Update scripts (optional)
# Change "npm run" to "bun run"
# Change "npx" to "bunx"
```

### Private Package Registry

Configure private registry:

```bash
# Set registry
bun config set registry https://registry.example.com

# Set scoped registry
bun config set @myorg:registry https://registry.example.com

# Set auth token
bun config set //registry.example.com/:_authToken YOUR_TOKEN
```

### CI/CD Installation

Optimize for CI environments:

```bash
# Fast, frozen lockfile install
bun install --frozen-lockfile --production

# No save (don't update lockfile)
bun install --no-save
```

### Development Workflow

```bash
# Install dependencies
bun install

# Run dev server with hot reload
bun --hot run src/index.ts

# Run tests in watch mode
bun test --watch

# Build for production
bun run build
```

### Monorepo Scripts

```json
// Root package.json
{
  "scripts": {
    "dev": "bun --filter '*' run dev",
    "build": "bun --filter '*' run build",
    "test": "bun --filter '*' run test",
    "lint": "bun --filter '*' run lint"
  }
}

// Package in workspace
{
  "name": "@myorg/shared",
  "scripts": {
    "dev": "bun run --hot src/index.ts",
    "build": "bun build src/index.ts --outdir dist",
    "test": "bun test"
  }
}
```

### Link Local Packages

```bash
# In the package you want to link
bun link

# In the project using the package
bun link @myorg/my-package

# Unlink
bun unlink @myorg/my-package
```

## Anti-Patterns

### Don't Mix Package Managers

```bash
# Bad - Mixing package managers
npm install react
bun add express
yarn add vue

# Good - Use one package manager
bun add react express vue
```

### Don't Commit node_modules

```bash
# Bad - Committing dependencies
git add node_modules

# Good - Use lockfile
git add bun.lockb
echo "node_modules" >> .gitignore
```

### Don't Install Packages Globally Unnecessarily

```bash
# Bad - Global install for project dependency
bun add -g typescript

# Good - Install as dev dependency
bun add -d typescript

# Use bunx for one-off commands
bunx tsc --version
```

### Don't Skip Lockfile in CI

```bash
# Bad - Updating dependencies in CI
bun install

# Good - Use frozen lockfile
bun install --frozen-lockfile
```

### Don't Ignore Peer Dependencies

```bash
# Bad - Ignoring peer dependency warnings
bun add react-dom
# Warning: react is a peer dependency of react-dom

# Good - Install peer dependencies
bun add react react-dom
```

## Performance Tips

### Faster Installs

```bash
# Use binary lockfile
bun install  # Automatically uses bun.lockb

# Skip optional dependencies
bun install --no-optional

# Production install (skip devDependencies)
bun install --production

# Frozen lockfile (don't update)
bun install --frozen-lockfile
```

### Cache Management

```bash
# Clear Bun cache
bun pm cache rm

# Check cache size
bun pm cache
```

### Parallel Installation

Bun installs packages in parallel automatically, making it significantly faster than npm/yarn/pnpm.

## Troubleshooting

### Check Package Info

```bash
# View package details
bun pm ls express

# View all dependencies
bun pm ls

# Check for updates
bun outdated
```

### Fixing Lockfile Issues

```bash
# Regenerate lockfile
rm bun.lockb
bun install

# Verify lockfile
bun install --frozen-lockfile
```

## Related Skills

- **bun-runtime**: Understanding Bun's runtime for dependency usage
- **bun-testing**: Testing with Bun and managing test dependencies
- **bun-bundler**: Building projects with installed dependencies
