# CI Release Builds

- ALWAYS cross-compile for all platforms from Linux runners
- NEVER use macOS runners (macos-*) - they are paid and unnecessary
- NEVER use Windows runners (windows-*) - cross-compile instead
- Use `mlugg/setup-zig@v2` for Zig setup (not pip3 install)
- Use `taiki-e/install-action@v2` for cargo-zigbuild and cargo-xwin
- Use `cargo-zigbuild` for Darwin and Linux cross-compilation
- Use `cargo-xwin` for Windows MSVC cross-compilation (not zigbuild)
- All builds run on ubuntu-latest (except Linux ARM64 which needs ubuntu-24.04-arm)
