# CI Release Builds

- ALWAYS cross-compile for all platforms from Linux runners
- NEVER use macOS runners (macos-*) - they are paid and unnecessary
- NEVER use Windows runners (windows-*) - cross-compile instead
- Use `cargo-zigbuild` for cross-compilation to Darwin and Windows targets
- All builds should run on ubuntu-latest (except Linux ARM64 which needs ubuntu-24.04-arm)
