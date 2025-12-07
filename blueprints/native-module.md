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

The native module implements a fallback loading strategy to work in multiple environments:

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

  // 3. Try embedded path (Bun compiled binaries)
  try {
    const embeddedPath = path.join(process.execPath, '..', 'han-native.node');
    return require(embeddedPath);
  } catch {}

  // 4. Try legacy fallback (next to executable)
  try {
    const legacyPath = path.join(path.dirname(process.execPath), 'han-native.node');
    return require(legacyPath);
  } catch {}

  // Fallback to JavaScript implementation
  return null;
}
```

### Loading Contexts

1. **npm Installation**: Loads from node_modules
2. **Monorepo Development**: Loads from relative path
3. **Bun Bundle**: Loads from embedded binary location
4. **Standalone Binary**: Loads from executable directory
5. **JavaScript Fallback**: Uses pure JS implementation when native unavailable

## Behavior

### Performance Impact

Native module significantly improves hook execution performance:

- **Glob matching**: ~10x faster than JavaScript glob libraries
- **SHA256 hashing**: ~5x faster than JavaScript crypto
- **Memory usage**: Lower memory footprint for large file sets

### Graceful Degradation

If native module loading fails:

- System automatically falls back to JavaScript implementations
- Functionality remains identical
- Performance degrades but system continues working
- No user-visible errors

## Build Process

### Development

```bash
cd packages/han-native
cargo build --release
```

### CI/CD

Built in `.github/workflows/release-binaries.yml`:

```yaml
strategy:
  matrix:
    settings:
      - host: macos-latest
        target: x86_64-apple-darwin
      - host: macos-latest
        target: aarch64-apple-darwin
      - host: ubuntu-latest
        target: x86_64-unknown-linux-gnu
      - host: ubuntu-latest
        target: aarch64-unknown-linux-gnu
      - host: windows-latest
        target: x86_64-pc-windows-msvc
```

### Build Steps

1. Checkout code
2. Setup Rust toolchain
3. Add target platform
4. Build release binary
5. Upload artifact to GitHub release

## Files

### Implementation

- `packages/han-native/src/lib.rs` - Rust implementation with NAPI bindings
- `packages/han-native/Cargo.toml` - Rust package configuration
- `packages/han-native/index.js` - JavaScript wrapper
- `packages/han-native/index.d.ts` - TypeScript type definitions

### Build Configuration

- `.github/workflows/release-binaries.yml` - Multi-platform build workflow
- `packages/han-native/build.rs` - Build script (if needed)

### Usage

- `packages/bushido-han/lib/hook-cache.ts` - Primary consumer (caching system)

## Related Systems

- [Hook System](./hook-system.md) - Uses native module for caching operations
- [Build & Deployment](./build-deployment.md) - Compiles and releases native binaries
