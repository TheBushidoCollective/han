# Monorepo Project Structure

This is a **monorepo** with multiple packages/projects. When implementing changes:

## Key Principles

1. **Respect package boundaries** - Each package should have a clear, single responsibility
2. **Use workspace dependencies** - Reference sibling packages through the workspace protocol, not relative paths
3. **Share code intentionally** - Common code belongs in shared packages, not duplicated across packages
4. **Run commands from root** - Use workspace-aware commands (turbo, nx, pnpm -r, etc.) from the repository root
5. **Consider downstream impact** - Changes to shared packages affect all dependents

## Before Making Changes

- Identify which package(s) need modification
- Check if the change affects shared dependencies
- Consider if new functionality belongs in an existing package or warrants a new one
- Verify changes work across the entire workspace, not just one package

## Testing in Monorepos

- Run tests for affected packages and their dependents
- Use incremental/cached builds when available
- Verify the full build works from root before finishing
