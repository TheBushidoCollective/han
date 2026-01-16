---
name: distribution-architecture
summary: NPM wrapper + platform-specific Bun binaries distribution model
---

# Distribution Architecture

## Overview

The `@thebushidocollective/han` package uses a **wrapper + platform-specific binaries** distribution model to deliver compiled Bun executables via npm.

## How It Works

### 1. NPM Package Structure

The main package (`@thebushidocollective/han`) is a **wrapper** that:

- Contains the built TypeScript → JavaScript in `dist/`
- Declares platform-specific binaries as `optionalDependencies`
- Has a thin wrapper script in `bin/han.js`

### 2. Platform-Specific Binaries

Separate npm packages for each platform:

- `@thebushidocollective/han-darwin-arm64` (macOS Apple Silicon)
- `@thebushidocollective/han-darwin-x64` (macOS Intel)
- `@thebushidocollective/han-linux-arm64` (Linux ARM)
- `@thebushidocollective/han-linux-x64` (Linux x64)
- `@thebushidocollective/han-win32-x64` (Windows x64)

Each contains a single compiled Bun binary for that platform.

### 3. Installation Flow

When a user runs:

```bash
han metrics
```

npm/npx:

1. Downloads `@thebushidocollective/han`
2. Detects the current platform (OS + architecture)
3. Downloads the matching optional dependency (e.g., `han-darwin-arm64`)
4. Executes `bin/han.js`

### 4. Execution Flow

`bin/han.js` (the wrapper):

1. Detects current platform
2. Looks for the platform-specific binary in `node_modules/@thebushidocollective/han-{platform}/`
3. Executes the **compiled Bun binary** (NOT Node.js!)
4. Passes all arguments to the binary

## Key Implications

### ✅ Bun-Specific Features Work

Since the binary is compiled with Bun:

- `bun:sqlite` works ✅
- `bun:ffi` works ✅
- `bun:test` works ✅
- All Bun built-ins are available ✅

### ✅ MCP Servers Work

When Claude Code runs:

```json
{
  "command": "npx",
  "args": ["--yes", "@thebushidocollective/han", "mcp", "metrics"]
}
```

It actually runs the **Bun binary**, so:

- `bun:sqlite` imports work
- Native Bun performance applies
- No Node.js compatibility needed

### ✅ No Runtime Detection Needed

We don't need to detect Bun vs Node.js because:

- The wrapper always executes the Bun binary
- Even `npx` usage runs Bun (via the platform binary)
- We can use Bun-specific APIs unconditionally

## Build Process

### Compiling Binaries

See `scripts/build-bundle.js`:

1. Uses `bun build --compile` to create standalone executable
2. Bundles all dependencies (except native modules like `bun:sqlite`)
3. Creates platform-specific binary in `dist/han`
4. Published separately to platform-specific npm packages

### Publishing

1. Main package: `@thebushidocollective/han`
   - Contains wrapper + TypeScript build
   - References platform packages in optionalDependencies

2. Platform packages: `@thebushidocollective/han-{platform}`
   - Each contains single binary for that platform
   - Published separately with matching version

## Comparison to Other Distribution Models

### vs. Pure npm Package (Node.js)

- ❌ Slower (Node.js vs Bun runtime)
- ❌ Can't use Bun built-ins
- ✅ Smaller install size
- ✅ Universal compatibility

### vs. Direct Binary Downloads (Homebrew, curl)

- ✅ Works with `npx` (no installation needed)
- ✅ Automatic version management
- ✅ Works in CI/CD without setup
- ❌ Larger install size (downloads wrapper + binary)

### vs. Single Universal Binary

- ✅ Smaller per-platform size
- ✅ Faster downloads (only downloads needed platform)
- ❌ More complex build/publish process
- ❌ Requires wrapper logic

## Developer Notes

### When to Use This Knowledge

**Use Bun APIs freely:**

```typescript
import { Database } from "bun:sqlite";  // ✅ Works everywhere
import { serve } from "bun";            // ✅ Works everywhere
```

**Don't detect runtime:**

```typescript
// ❌ WRONG - unnecessary
if (typeof Bun !== "undefined") {
  // Bun-specific code
}

// ✅ RIGHT - just use it
import { Database } from "bun:sqlite";
```

**Trust the binary:**

- No need for Node.js fallbacks
- No need for cross-runtime compatibility
- Can optimize for Bun exclusively

## Troubleshooting

### "Cannot find module 'bun:sqlite'"

This means:

1. Running the built JavaScript directly with Node.js (wrong)
2. Should use the binary instead

Solution: Ensure you're executing via the wrapper or binary, not `node dist/lib/main.js`

### Binary not found

Check:

1. Platform-specific package installed: `ls node_modules/@thebushidocollective/han-*/`
2. Platform matches: `uname -sm`
3. Wrapper can locate binary: `bin/han.js` logic

## References

- Build script: `scripts/build-bundle.js`
- Wrapper: `bin/han.js`
- Package manifest: `package.json` (optionalDependencies)
