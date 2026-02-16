---
status: in_progress
depends_on: ["unit-04-han-coordinator", "unit-05-cli-grpc", "unit-06-han-server"]
branch: ai-dlc/backend-rearchitecture/07-cleanup
discipline: devops
ticket: ""
---

# unit-07: cleanup (Delete old code, update CI/CD, update distribution)

## Description
Remove all deprecated code that has been replaced by the new Rust crates and pure Bun CLI. Update CI/CD pipelines to build the new Rust binaries. Update npm distribution packages to bundle `han-coordinator` alongside the Bun CLI binary.

## Discipline
devops - CI/CD pipeline updates, npm package restructuring, code deletion.

## Domain Entities
- **han-native** - NAPI Rust module to delete entirely
- **han-team-server** - TypeScript team server to delete entirely
- **TypeScript GraphQL layer** - Pothos schema files to delete
- **CLI DB layer** - Direct database imports to delete
- **CI pipelines** - GitHub Actions workflows to update
- **npm packages** - Platform-specific packages to update with coordinator binary

## Data Sources
- **Input**: `packages/han-native/` - Entire directory to delete
- **Input**: `packages/han-team-server/` - Entire directory to delete
- **Input**: `packages/han/lib/graphql/` - TypeScript GraphQL types to delete
- **Input**: `packages/han/lib/db/` - Direct DB access layer to delete
- **Input**: `packages/han/lib/native.ts` - NAPI loader to delete
- **Input**: `.github/workflows/` - CI workflows to update
- **Input**: `packages/han-*/` - npm platform packages to update

## Technical Specification

### Code Deletion

**Delete entirely:**
```
packages/han-native/           # NAPI Rust module (replaced by han-db, han-indexer, han-api, han-coordinator)
packages/han-team-server/      # TypeScript team server (replaced by han-server)
packages/han/lib/graphql/      # TypeScript Pothos GraphQL types (replaced by han-api)
packages/han/lib/db/           # Direct DB access (replaced by gRPC to coordinator)
packages/han/lib/native.ts     # NAPI loader with retry hack (no more NAPI)
```

**Verify no remaining references:**
```bash
# No NAPI imports
grep -r "from.*native" packages/han/lib/ --include="*.ts" | grep -v node_modules | grep -v grpc/generated
# No direct DB imports
grep -r "from.*db/index" packages/han/lib/ --include="*.ts" | grep -v node_modules
# No Pothos imports
grep -r "from.*graphql" packages/han/lib/ --include="*.ts" | grep -v node_modules | grep -v grpc
# No han-team-server references
grep -r "han-team-server" . --include="*.ts" --include="*.json" --include="*.yml" | grep -v node_modules
```

### CI/CD Updates

**Update `.github/workflows/` to add Rust binary builds:**

1. **han-coordinator build** (all 5 platforms):
   - `x86_64-unknown-linux-gnu` (Linux x64)
   - `aarch64-unknown-linux-gnu` (Linux ARM64)
   - `x86_64-apple-darwin` (macOS x64) - via Docker cargo-zigbuild
   - `aarch64-apple-darwin` (macOS ARM64) - via Docker cargo-zigbuild
   - `x86_64-pc-windows-msvc` (Windows) - via cargo-xwin

   Follow existing CI rules from `.claude/rules/ci/release-builds.md`:
   - ALWAYS cross-compile from Linux runners
   - NEVER use macOS or Windows runners
   - Use Docker `ghcr.io/rust-cross/cargo-zigbuild:latest` for Darwin targets
   - Use `cargo-xwin` for Windows MSVC target

2. **han-server build** (Linux only, for Railway):
   - `x86_64-unknown-linux-gnu` only
   - Dockerfile in `crates/han-server/` for Railway deployment

3. **Remove han-native build steps** from existing workflows:
   - Remove NAPI-RS build matrix
   - Remove platform-specific NAPI binary upload
   - Remove `@thebushidocollective/han-native-*` npm package publishing

### npm Package Updates

**Update `@thebushidocollective/han-{platform}` packages:**

Each platform package currently contains only the Bun binary. Add `han-coordinator` binary:

```
@thebushidocollective/han-darwin-arm64/
  bin/
    han           # Bun binary (existing)
    han-coordinator  # Rust coordinator binary (NEW)
  package.json

@thebushidocollective/han-linux-x64/
  bin/
    han
    han-coordinator
  package.json

# ... same for all 5 platforms
```

**Update `@thebushidocollective/han` wrapper:**
- Remove `han-native` optional dependency
- Keep platform package resolution logic
- Add coordinator binary path resolution

**Remove npm packages:**
- `@thebushidocollective/han-native-*` - No longer needed (NAPI binaries)

### package.json Updates

**`packages/han/package.json`:**
- Remove `han-native` from dependencies
- Remove `@napi-rs/*` from devDependencies
- Remove any `postinstall` scripts related to NAPI
- Update build scripts if they reference native module

**Root `package.json`:**
- Remove `han-native` from workspace references
- Remove `han-team-server` from workspace references
- Add `han-rs` workspace reference (if needed for tooling)

### Workspace Cleanup

**Update TypeScript configs:**
- Remove `han-native` paths from `tsconfig.json` references
- Remove `han-team-server` paths
- Remove `graphql/` paths from CLI tsconfig

**Update `.gitignore`:**
- Remove `han-native` build output patterns
- Add `packages/han-rs/target/` (Rust build output)

**Update README/docs:**
- Update architecture documentation
- Update development setup instructions
- Remove references to NAPI module
- Add Rust toolchain requirements for coordinator development

### Railway Updates

**Update Railway deployment:**
- `han-server` service: New Dockerfile from `crates/han-server/`
- `han-dashboard` service: No changes (browse-client stays the same)
- Remove or update any `han-team-server` service configuration

## Success Criteria
- [ ] `packages/han-native/` directory does not exist
- [ ] `packages/han-team-server/` directory does not exist
- [ ] `packages/han/lib/graphql/` directory does not exist
- [ ] `packages/han/lib/db/` directory does not exist
- [ ] `packages/han/lib/native.ts` does not exist
- [ ] `grep -r "han-native" . --include="*.json" --include="*.ts"` returns zero results (excluding node_modules and han-rs)
- [ ] CI builds `han-coordinator` for all 5 platform targets
- [ ] CI builds `han-server` for Linux
- [ ] npm platform packages include both `han` (Bun) and `han-coordinator` (Rust) binaries
- [ ] `npx @thebushidocollective/han coordinator status` works after fresh npm install
- [ ] All existing tests pass (browse-client, CLI, plugins)
- [ ] Railway deployment of `han-server` succeeds
- [ ] No TypeScript compilation errors after deletions

## Boundaries
This unit does NOT handle:
- Building the Rust crates (units 01-04, 06 handle that)
- Implementing the gRPC client in the CLI (unit-05)
- Adding new features - this unit only REMOVES old code and updates infrastructure

This unit PROVIDES: a clean codebase with no deprecated code, updated CI/CD, and correct distribution packaging.

## Notes
- Run all existing tests BEFORE and AFTER deletions to ensure nothing breaks.
- The browse-client should be completely unaffected - it talks to GraphQL regardless of whether the server is TypeScript or Rust.
- Keep the Relay compiler configuration pointing to the new Rust-served schema endpoint.
- The `han-coordinator` binary name should not conflict with the `han` CLI binary in PATH.
- Consider a migration guide for contributors who have local development setups referencing the old code structure.
- Railway environment variables for `han-server` should be configured before deploying.
