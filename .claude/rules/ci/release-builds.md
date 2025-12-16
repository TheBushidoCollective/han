# CI Release Builds

## Core Rules

- ALWAYS cross-compile for all platforms from Linux runners
- NEVER use macOS runners (macos-*) - they are paid and unnecessary
- NEVER use Windows runners (windows-*) - cross-compile instead

## Build Tools

- `mlugg/setup-zig@v2` for Zig setup (not pip3 install)
- `taiki-e/install-action@v2` for cargo-zigbuild and cargo-xwin

## Platform-Specific Build Methods

### Linux (x64, ARM64)

- Use `cargo-zigbuild` directly on the runner
- ARM64 builds need `ubuntu-24.04-arm` runner (native)
- x64 builds run on `ubuntu-latest`

### Darwin (x64, ARM64)

- Use Docker: `ghcr.io/rust-cross/cargo-zigbuild:latest`
- Docker image includes macOS SDK for linking system libraries
- Update Rust inside container: `rustup update stable && rustup default stable`
- Required because crates like `ort` link against objc, IOKit, CoreFoundation

### Windows (MSVC)

- Use `cargo-xwin` (NOT cargo-zigbuild)
- Target: `x86_64-pc-windows-msvc`
- Requires: `llvm clang nasm` packages
