# CI Release Builds

- ALWAYS cross-compile for all platforms from Linux runners
- NEVER use macOS runners (macos-*) - they are paid and unnecessary
- Use `cross` or cargo with appropriate targets for cross-compilation
- Darwin builds should cross-compile from ubuntu-latest
