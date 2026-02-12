---
name: build-deployment
summary: CI/CD with auto-versioning, cross-platform builds from Linux, npm OIDC publishing, and Railway deployment
---

# Build & Deployment System

Complete CI/CD automation for building, testing, releasing, and deploying Han marketplace components.

## Overview

The build and deployment system orchestrates GitHub Actions workflows that handle:

- **Automated versioning** - Semantic version bumps based on commit messages
- **Cross-platform builds** - Native modules and binaries for 5 platforms from Linux runners
- **npm publishing** - OIDC-authenticated releases without tokens
- **Website deployment** - Static site to GitHub Pages
- **Quality assurance** - Testing, linting, coverage tracking

## Core Principles

### Cross-Compilation Strategy

**CRITICAL RULE: All builds run on Linux runners only**

- **NEVER use macOS runners** (macos-*) - they are paid and unnecessary
- **NEVER use Windows runners** (windows-*) - cross-compile instead
- **Linux runners are free** and can cross-compile to all platforms

### Build Tools

- **Zig** (`mlugg/setup-zig@v2`) - Cross-compilation toolchain (not pip3 install)
- **cargo-zigbuild** (`taiki-e/install-action@v2`) - Rust cross-compilation for Linux/Darwin
- **cargo-xwin** (`taiki-e/install-action@v2`) - Rust cross-compilation for Windows

### Platform-Specific Build Methods

| Platform | Runner | Build Tool | Notes |
|----------|--------|------------|-------|
| Linux x64 | ubuntu-latest | cargo-zigbuild | Direct build |
| Linux ARM64 | ubuntu-24.04-arm | cargo-zigbuild | Native ARM runner |
| Darwin x64 | ubuntu-latest | cargo-zigbuild (Docker) | Needs macOS SDK via Docker |
| Darwin ARM64 | ubuntu-latest | cargo-zigbuild (Docker) | Needs macOS SDK via Docker |
| Windows x64 | ubuntu-latest | cargo-xwin | Requires llvm/clang/nasm |

**Darwin builds require Docker** because crates like `ort` link against objc, IOKit, and CoreFoundation:

```yaml
- name: Build native module (zigbuild for Darwin via Docker)
  if: contains(matrix.target, 'apple')
  run: |
    docker run --rm \
      -v ${{ github.workspace }}:/io \
      -w /io/packages/han-native \
      ghcr.io/rust-cross/cargo-zigbuild:latest \
      bash -c "rustup update stable && rustup default stable && rustup target add ${{ matrix.target }} && cargo zigbuild --release --target ${{ matrix.target }}"
```

## Versioning Strategy

### Semantic Versioning

**Automatic version bumps** based on conventional commits:

| Commit Type | Bump Type | Example |
|-------------|-----------|---------|
| `feat:` or `feat(scope):` | **MINOR** | 1.2.0 → 1.3.0 |
| `fix:`, `refactor:`, `docs:`, `chore:` | **PATCH** | 1.2.0 → 1.2.1 |
| `!:` suffix or `BREAKING CHANGE:` | **MAJOR** | 1.2.0 → 2.0.0 |

**Example Commits**:

```
feat: add new plugin category       → MINOR bump
fix: resolve caching bug             → PATCH bump
feat!: change settings format        → MAJOR bump
refactor: simplify hook dispatch     → PATCH bump
```

### Version Detection Logic

```bash
# From auto-tag-release.yml
if echo "$COMMIT_MSG" | grep -qE '^[a-z]+(\(.+\))?!:|BREAKING CHANGE:'; then
  type=major
elif echo "$COMMIT_MSG" | grep -qE '^feat(\(.+\))?:'; then
  type=minor
else
  type=patch
fi
```

## Workflows

### 1. auto-tag-release.yml

**Purpose**: Automatically version, tag, and trigger releases

**Trigger**:

```yaml
on:
  push:
    branches: [main]
    paths:
      - 'packages/han/**'
      - 'packages/han-native/**'
      - 'plugins/**'
      - 'website/**'
```

**Exclusions**:

- Skip if actor is `github-actions[bot]` (prevents infinite loops)
- Skip if commit message contains `[skip ci]`

**Jobs**:

#### Job 1: generate-changelogs

Generates changelogs for changed components:

1. Detects changed paths (packages, plugins, website)
2. Generates plugin changelogs for each changed plugin
3. Generates website changelog if website changed
4. Commits changelog updates with `[skip ci]` to avoid loops

#### Job 2: bump-and-tag

Bumps version and creates release tag:

1. **Pulls latest changes** (includes changelog commits)
2. **Builds native module**:
   ```bash
   cd packages/han-native
   npm ci
   npm run build
   cp target/release/libhan_native.so ../han/native/han-native.node
   ```
3. **Determines version bump type** from commit message
4. **Bumps version** in package.json (manual bash script, not npm version)
5. **Installs dependencies** with frozen lockfile
6. **Generates build-info** (version, prompt for AI plugin detection)
7. **Runs tests** with `--max-concurrency=1` (prevents race conditions)
8. **Checks if tag exists** (prevents duplicate releases)
9. **Generates CLI changelog**
10. **Commits version bump** with `[skip ci]`
11. **Creates and pushes tag** (e.g., `v3.12.7`)
12. **Triggers release-binaries workflow** via `gh workflow run`

**Critical Details**:

- Uses **PAT token** (`HOMEBREW_TAP_TOKEN`) for pushing to trigger workflows
- GITHUB_TOKEN pushes don't trigger workflows (security feature)
- Manually calculates version bump (not `npm version`)
- Runs tests before tagging to ensure quality

### 2. release-binaries.yml

**Purpose**: Build platform-specific native modules and Bun binaries

**Trigger**:

```yaml
on:
  push:
    tags: ["v*"]
  workflow_dispatch:
  repository_dispatch:
    types: [manual-release]
```

**Strategy Matrix** (5 platforms):

```yaml
matrix:
  include:
    - target: x86_64-unknown-linux-gnu
      bun_target: bun-linux-x64
      binary_name: han-linux-x64
    - target: aarch64-unknown-linux-gnu
      bun_target: bun-linux-arm64
      binary_name: han-linux-arm64
    - target: x86_64-apple-darwin
      bun_target: bun-darwin-x64
      binary_name: han-darwin-x64
    - target: aarch64-apple-darwin
      bun_target: bun-darwin-arm64
      binary_name: han-darwin-arm64
    - target: x86_64-pc-windows-msvc
      bun_target: bun-windows-x64
      binary_name: han-windows-x64
```

**Jobs**:

#### Job 1: build (matrix)

Runs in parallel for each platform:

1. **Setup toolchains** (Node 24, Bun latest, Rust stable, Zig 0.13.0)
2. **Install cargo-zigbuild** (Linux/Darwin) or **cargo-xwin** (Windows)
3. **Install cross-compilation deps** (gcc-aarch64-linux-gnu, protobuf-compiler)
4. **Install LLVM/clang/nasm** (Windows only)
5. **Install han-native deps** (`npm ci`)
6. **Build native module**:
   - **Linux**: Direct `cargo zigbuild`
   - **Darwin**: Docker with `ghcr.io/rust-cross/cargo-zigbuild:latest`
   - **Windows**: `cargo xwin build`
7. **Build Bun binary**:
   ```bash
   bun install
   mkdir -p native
   cp ../han-native/$native_file native/han-native.node
   bun scripts/build-bundle.js $bun_target
   ```
8. **Create checksum** (SHA256)
9. **Upload artifact**

**Key Details**:

- **ARM64 Linux** uses `ubuntu-24.04-arm` runner (native, not cross-compiled)
- **Darwin builds** require Docker for macOS SDK
- **Windows builds** need LLVM/clang/nasm for linking
- **Bun binaries** embed the native module for distribution

#### Job 2: release

Creates GitHub release with all binaries:

1. Downloads all artifacts
2. Prepares release files
3. Creates GitHub release with:
   - Auto-generated release notes
   - All platform binaries + checksums
   - Prerelease flag if version contains `-` (e.g., `v3.12.7-beta`)

#### Job 3: update-homebrew

Updates Homebrew tap formula:

1. Checks out `TheBushidoCollective/homebrew-tap` repo
2. Generates formula with version and checksums
3. Commits and pushes to tap repo
4. **Only runs for non-prerelease** (no `-` in version)

#### Job 4: publish-npm (matrix)

Publishes platform-specific npm packages:

1. **Runs for each platform** (5 parallel jobs)
2. Downloads platform-specific artifact
3. Creates npm package with `.github/scripts/create-npm-platform-package.sh`
4. Publishes to npm with `--provenance --access public`

**Platform packages**:

- `@thebushidocollective/han-linux-x64`
- `@thebushidocollective/han-linux-arm64`
- `@thebushidocollective/han-darwin-x64`
- `@thebushidocollective/han-darwin-arm64`
- `@thebushidocollective/han-win32-x64`

#### Job 5: publish-wrapper

Publishes wrapper package (after platform packages):

1. Creates wrapper package with `.github/scripts/create-npm-wrapper-package.sh`
2. Wrapper includes:
   - Thin `bin/han.js` entry point
   - Platform detection logic
   - `optionalDependencies` to all platform packages
3. Publishes `@thebushidocollective/han` to npm

**Critical Details**:

- Uses **npm provenance** (cryptographic proof of build origin)
- **OIDC authentication** (no npm token needed, uses GitHub id-token)
- **Wrapper publishes AFTER platforms** (ensures deps are available)

### 3. coverage.yml

**Purpose**: Run tests across all packages and upload coverage to Codecov

**Trigger**:

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
```

**Coverage Targets**:

1. **han-native (Rust)** - cargo llvm-cov → lcov
2. **han CLI (TypeScript/Bun)** - bun test --coverage → lcov
3. **website (TypeScript/Bun)** - bun test --coverage → lcov
4. **browse-client (E2E/Playwright)** - playwright test → junit

**Process**:

1. **Build native module** for downstream tests
2. **Run han-native tests** with coverage:
   ```bash
   cargo llvm-cov test --lcov --output-path ../../coverage/han-native-lcov.info
   ```
3. **Generate build-info stub** (needed for tests)
4. **Run han tests** with coverage:
   ```bash
   bun test --coverage --coverage-reporter=lcov
   ```
5. **Run website tests** with coverage (if unit tests exist)
6. **Build browse-client** and run E2E tests
7. **Upload coverage** to Codecov (separate flags per package)
8. **Upload test results** (JUnit XML for all packages)

**Codecov Flags**:

- `han-native` - Rust coverage
- `han-cli` - CLI coverage
- `website` - Website coverage

### 4. validate-han.yml

**Purpose**: Lint, typecheck, and test the CLI package

**Trigger**:

```yaml
on:
  pull_request:
    paths: ["packages/han/**", "packages/han-native/**"]
  push:
    branches: [main]
    paths: ["packages/han/**", "packages/han-native/**"]
```

**Process**:

1. **Build native module** (Rust)
2. **Install dependencies** with frozen lockfile
3. **Run Biome lint**:
   ```bash
   biome lint --files-ignore-unknown=true .
   ```
4. **Generate build-info stub**
5. **TypeScript type check**:
   ```bash
   bun run tsc --noEmit
   ```
6. **Run tests with coverage**
7. **Extract coverage percentage** from lcov
8. **Update coverage badge** (on main branch only)

**Badge Update**:

Uses `schneegans/dynamic-badges-action` to update Gist-based badge with coverage percentage.

### 5. deploy-website.yml

**Purpose**: Build and deploy static website to GitHub Pages

**Trigger**:

```yaml
on:
  push:
    branches: [main]
    paths:
      - "website/**"
      - ".claude-plugin/marketplace.json"
      - "jutsu/**"  # Plugin content changes
      - "do/**"
      - "hashi/**"
      - "bushido/**"
```

**Process**:

1. **Checkout with full history** (needed for paper revision generation)
2. **Setup Bun** and **configure Pages**
3. **Install dependencies** with frozen lockfile
4. **Build with Next.js**:
   ```bash
   bun run build
   ```
   - Runs prebuild scripts (generate marketplace, search index)
   - Builds Next.js static export to `out/`
5. **Add .nojekyll file** (prevents Jekyll processing)
6. **Upload Pages artifact**
7. **Deploy to GitHub Pages**

**Deployment URL**: https://han.guru

### 6. claudelint.yml

**Purpose**: Validate plugin structure and metadata

**Trigger**:

```yaml
on:
  pull_request:
    paths:
      - "**/.claude-plugin/**"
      - "**/hooks/**"
      - "**/skills/**"
      - "**/agents/**"
      - "**/commands/**"
```

**Process**:

```bash
uvx claudelint . --strict
```

**Validates**:

- plugin.json schema
- hooks.json structure
- Skill/command/agent file format
- Frontmatter presence and validity
- Marketplace.json consistency

### 7. validate-browse-client.yml

**Purpose**: Validate browse client build and tests

**Trigger**: PRs and pushes affecting `packages/browse-client/**`

**Process**:

1. Install dependencies
2. Generate Relay types
3. Build client
4. Run Playwright E2E tests

### 8. validate-website.yml

**Purpose**: Validate website build and tests

**Trigger**: PRs and pushes affecting `website/**`

**Process**:

1. Install dependencies
2. Build website (includes prebuild scripts)
3. Run Playwright E2E tests

### 9. bump-plugin-versions.yml

**Purpose**: Update platform package versions in optionalDependencies

**Trigger**: Manual (workflow_dispatch)

**Process**:

1. Read current han version from package.json
2. Update optionalDependencies in package.json:
   ```json
   {
     "@thebushidocollective/han-darwin-arm64": "1.46.0",
     "@thebushidocollective/han-darwin-x64": "1.46.0",
     ...
   }
   ```
3. Commit and create pull request

### 10. auto-fix-ci.yml

**Purpose**: Automatically fix formatting/linting issues

**Trigger**:

```yaml
on:
  push:
    branches: [main]
```

**Process**:

1. Run Biome format/lint with --write
2. If changes detected, commit and push
3. Re-trigger CI

### 11. claude-code-review.yml

**Purpose**: AI-powered code review on pull requests

**Trigger**:

```yaml
on:
  pull_request:
    types: [opened, synchronize]
```

**Process**:

1. Fetch PR diff
2. Send to Claude for review
3. Post review comments on PR

### 12. issue-triage.yml, issue-deduplication.yml

**Purpose**: Automated issue management

**Triage**:

- Label issues based on content
- Assign to appropriate team members
- Set priority

**Deduplication**:

- Detect duplicate issues
- Link related issues
- Suggest closing duplicates

## Release Flow

```
Code Push to main (packages/han/**)
         ↓
auto-tag-release.yml
  1. Generate changelogs
  2. Detect version bump type (feat/fix/breaking)
  3. Build native module
  4. Bump version in package.json
  5. Run tests
  6. Create tag (e.g., v3.12.7)
  7. Push tag
         ↓
release-binaries.yml (triggered by tag)
  1. build job (matrix):
     - Build native module for 5 platforms (cross-compile)
     - Build Bun binary with embedded native module
     - Upload artifacts
  2. release job:
     - Download all artifacts
     - Create GitHub release with binaries
  3. update-homebrew job:
     - Update homebrew-tap formula
  4. publish-npm job (matrix):
     - Publish 5 platform packages to npm
  5. publish-wrapper job:
     - Publish wrapper package to npm
```

## Website Deployment Flow

```
Code Push to main (website/** or plugins/**)
         ↓
deploy-website.yml
  1. Checkout with full history
  2. Setup Bun and configure Pages
  3. Install dependencies
  4. Build Next.js (prebuild → build → static export)
  5. Add .nojekyll
  6. Upload artifact
  7. Deploy to GitHub Pages
         ↓
    https://han.guru
```

## Quality Checks Flow

```
Pull Request Created/Updated
         ↓
    ┌────┴─────┬───────────┬──────────────┐
    ↓          ↓           ↓              ↓
validate-han  claudelint  coverage  code-review
  - Lint       - Validate  - Run tests  - AI review
  - Typecheck  - Plugins   - Upload     - Comment PR
  - Test       - Metadata  - Coverage
```

## Permissions

### GitHub Actions Token

**Workflow-level permissions** (auto-tag-release.yml):

```yaml
permissions:
  contents: write        # Push commits and tags
  id-token: write       # npm provenance
  actions: write        # Trigger workflows
```

**Pages deployment permissions** (deploy-website.yml):

```yaml
permissions:
  contents: read
  pages: write          # Deploy to GitHub Pages
  id-token: write       # Pages deployment token
```

### npm Publishing

**Method**: Trusted Publishers (OIDC)

**Setup**:

1. Configure on npm: https://www.npmjs.com/package/@thebushidocollective/han/access
2. Add GitHub Actions as trusted publisher
3. No npm token in secrets (uses OIDC id-token)

**Benefits**:

- No long-lived credentials
- Cryptographic proof of build origin
- Automatic provenance attestation

### GitHub Pages

**Setup**:

1. Settings → Pages → Source: GitHub Actions
2. Workflow has `pages: write` permission
3. Automatic deployment on push to main

## Distribution Architecture

### npm Wrapper Pattern

**Main package** (`@thebushidocollective/han`):

- Thin wrapper with platform detection
- `bin/han.js` entry point
- `optionalDependencies` to platform packages

**Platform packages**:

- Single Bun binary per package
- Published separately with matching version
- Auto-installed by npm based on platform

**Usage via npx**:

```bash
npx -y @thebushidocollective/han plugin install
```

**MCP servers**:

```json
{
  "mcpServers": {
    "han": {
      "command": "npx",
      "args": ["-y", "@thebushidocollective/han", "mcp"]
    }
  }
}
```

### Alternative Distribution Methods

1. **Homebrew**:
   ```bash
   brew install thebushidocollective/tap/han
   ```

2. **Curl installer**:
   ```bash
   curl -fsSL https://han.guru/install.sh | bash
   ```

Both install the same Bun binary but provide faster execution for frequent CLI usage.

## Files

### Workflows

| File | Purpose |
|------|---------|
| `.github/workflows/auto-tag-release.yml` | Version and tag automation |
| `.github/workflows/release-binaries.yml` | Cross-platform builds and npm publishing |
| `.github/workflows/coverage.yml` | Test coverage across all packages |
| `.github/workflows/validate-han.yml` | CLI lint, typecheck, test |
| `.github/workflows/validate-han-native.yml` | Rust native module validation |
| `.github/workflows/validate-browse-client.yml` | Browse client validation |
| `.github/workflows/validate-website.yml` | Website validation |
| `.github/workflows/deploy-website.yml` | Website deployment to Pages |
| `.github/workflows/test-website.yml` | E2E tests for website |
| `.github/workflows/claudelint.yml` | Plugin validation |
| `.github/workflows/auto-fix-ci.yml` | Automatic formatting fixes |
| `.github/workflows/claude-code-review.yml` | AI code review |
| `.github/workflows/bump-plugin-versions.yml` | Version updates |
| `.github/workflows/issue-triage.yml` | Issue labeling |
| `.github/workflows/issue-deduplication.yml` | Duplicate detection |

### Scripts

| File | Purpose |
|------|---------|
| `.github/scripts/generate-changelog.sh` | Generate changelogs for components |
| `.github/scripts/generate-homebrew-formula.sh` | Create Homebrew formula |
| `.github/scripts/create-npm-platform-package.sh` | Create platform npm packages |
| `.github/scripts/create-npm-wrapper-package.sh` | Create wrapper npm package |
| `packages/han/scripts/build-bundle.js` | Build Bun binary with embedded native module |

## Related Systems

- [CLI Architecture](./cli-architecture.md) - Builds CLI package
- [Native Module](./native-module.md) - Compiles Rust bindings
- [Website](./website.md) - Deploys static site
- [Marketplace](./marketplace.md) - Validates marketplace structure
- [Distribution Architecture](./distribution-architecture.md) - npm wrapper pattern