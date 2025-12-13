---
name: native-module
summary: High-performance Rust bindings for hook operations
---

# Native Module System

High-performance Rust bindings for hook operations via NAPI-rs.

## Overview

The native module provides performance-critical operations for the hook system, particularly glob pattern matching and SHA256 hashing for cache change detection. Written in Rust and compiled to Node.js native addons for maximum performance.

## Architecture

### Technology Stack

- **Language**: Rust
- **Binding Framework**: NAPI-rs (Node API bindings)
- **Package Manager**: Cargo (Rust)
- **Build Target**: Platform-specific `.node` files

### Package Structure

```
packages/han-native/
├── Cargo.toml              # Rust package manifest
├── src/                    # Rust source code
│   └── lib.rs             # NAPI bindings
├── index.js               # JavaScript wrapper
├── index.d.ts             # TypeScript definitions
└── *.node                 # Compiled binaries (platform-specific)
```

### Supported Platforms

1. **macOS**
   - darwin-arm64 (Apple Silicon)
   - darwin-x64 (Intel)

2. **Linux**
   - linux-arm64-gnu
   - linux-x64-gnu

3. **Windows**
   - win32-x64-msvc

## API

### Glob Pattern Matching

Fast file discovery using Rust's glob implementation.

```typescript
function glob(pattern: string, cwd?: string): string[];
```

### SHA256 Hashing

High-performance file hashing for cache change detection.

```typescript
function sha256(filePath: string): string;
```

## Loading Strategy

The native module implements a multi-step fallback loading strategy to work in multiple environments:

```typescript
// From lib/hook-cache.ts
function loadNativeModule() {
  // 1. Try npm package (production)
  try {
    return require('@thebushidocollective/han-native');
  } catch {}

  // 2. Try monorepo path (development)
  try {
    return require('../../han-native');
  } catch {}

  // 3. Bun compiled binaries - extract and load
  // Bun embeds files in /$bunfs/ virtual filesystem
  // dlopen() can't read from bunfs, so we extract to temp
  if (isBunBinary) {
    const embeddedPath = import.meta.resolveSync('../native/han-native.node');
    const bytes = readFileSync(embeddedPath);
    const tempPath = join(tmpdir(), `han-native-${pid}.node`);
    writeFileSync(tempPath, bytes, { mode: 0o755 });
    const module = require(tempPath);
    unlinkSync(tempPath); // dlopen keeps handle open
    return module;
  }

  // 4. Direct embedded require (non-Bun bundles)
  try {
    return require('../native/han-native.node');
  } catch {}

  // 5. Legacy fallback (next to executable)
  try {
    return require(join(dirname(process.execPath), 'han-native.node'));
  } catch {}

  throw new Error('Failed to load native module');
}
```

### Loading Contexts

1. **npm Installation**: Loads from `@thebushidocollective/han-native` package
2. **Monorepo Development**: Loads from relative `../../han-native` path
3. **Bun Compiled Binary**: Extracts embedded `.node` from bunfs to temp, then loads
4. **Direct Embedded**: For non-Bun bundlers that support native modules directly
5. **Standalone Binary**: Loads from executable directory

### Bun Bundle Extraction (Critical)

Bun compiles binaries embed files in a virtual filesystem (`/$bunfs/`). Native `.node` modules require `dlopen()` which cannot read from the virtual filesystem. The solution:

1. Detect if running in a Bun binary (execPath is not bun/node)
2. Use `import.meta.resolveSync()` to get the embedded path
3. Read bytes with `readFileSync()` (works with bunfs)
4. Write to temp file with executable permissions
5. Load via `require()` from real filesystem
6. Clean up temp file (dlopen keeps handle, so safe to delete)

## Behavior

### Performance Impact

Native module significantly improves hook execution performance:

- **Glob matching**: ~10x faster than JavaScript glob libraries
- **SHA256 hashing**: ~5x faster than JavaScript crypto
- **Memory usage**: Lower memory footprint for large file sets

### Error Handling

The loader now throws errors with detailed diagnostics instead of silent fallback:

```
Failed to load han-native module. Tried:
@thebushidocollective/han-native: Cannot find module...
../../han-native: Cannot find module...
embedded-extract: <extraction error if any>
embedded: <direct load error>

This is a required dependency. Please ensure han is installed correctly.
```

## Build Process

### Development

```bash
cd packages/han-native
cargo build --release
```

### CI/CD

Built in `.github/workflows/release-binaries.yml` using cross-compilation:

- Uses `cargo-zigbuild` for Linux/macOS cross-compilation
- Uses `cargo-xwin` for Windows cross-compilation
- All builds run on ubuntu-latest for consistency

### Build Steps

1. Checkout code
2. Setup Rust toolchain with target platform
3. Build native module with cargo zigbuild/xwin
4. Copy to `native/han-native.node` for embedding
5. Build Bun binary with `bun build --compile`
6. Upload artifacts to GitHub release

## Files

### Implementation

- `packages/han-native/src/lib.rs` - Rust implementation with NAPI bindings
- `packages/han-native/Cargo.toml` - Rust package configuration
- `packages/han-native/index.js` - JavaScript wrapper
- `packages/han-native/index.d.ts` - TypeScript type definitions

### Build Configuration

- `.github/workflows/release-binaries.yml` - Multi-platform build workflow
- `packages/han/scripts/build-bundle.js` - Bun compilation script

### Usage

- `packages/han/lib/hook-cache.ts` - Primary consumer (caching system)

## Related Systems

- [Hook System](./hook-system.md) - Uses native module for caching operations
- [Build & Deployment](./build-deployment.md) - Compiles and releases native binaries
