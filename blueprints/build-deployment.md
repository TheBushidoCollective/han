# Build & Deployment System

CI/CD automation for building, testing, releasing, and deploying Han marketplace components.

## Overview

The build and deployment system orchestrates 15+ GitHub Actions workflows that handle version bumping, native module compilation, npm publishing, website deployment, and automated quality checks.

## Architecture

### Workflow Categories

1. **Release Automation** - Version bumping, tagging, publishing
2. **Build Workflows** - Native modules, website, binaries
3. **Quality Assurance** - Testing, linting, validation
4. **Automation** - Issue management, code review, auto-fixes

### Versioning Strategy

**Semantic Versioning** based on commit messages:

- **MAJOR**: `!:` suffix or `BREAKING CHANGE:` in commit body
- **MINOR**: `feat:` prefix
- **PATCH**: `fix:`, `refactor:`, `docs:`, `chore:`, etc.

**Example Commits**:

```
feat: add new plugin category → 1.2.0 → 1.3.0
fix: resolve caching bug      → 1.2.0 → 1.2.1
feat!: change settings format → 1.2.0 → 2.0.0
```

## Workflows

### 1. auto-tag-release.yml

**Purpose**: Automatically version, tag, and prepare releases

**Trigger**:

```yaml
on:
  push:
    branches: [main]
    paths: ["packages/bushido-han/**"]
```

**Exclusions**:

- Skip if actor is `github-actions[bot]` (prevent loops)
- Skip if commit message contains `[skip ci]`

**Process**:

1. **Detect Version Bump Type**

   ```typescript
   const commits = await git.log();
   const bumpType = commits.some(msg => msg.includes('!:'))
     ? 'major'
     : commits.some(msg => msg.startsWith('feat:'))
     ? 'minor'
     : 'patch';
   ```

2. **Build Native Module**

   ```bash
   cd packages/han-native
   cargo build --release
   ```

3. **Update package.json Version**

   ```bash
   npm version ${bumpType} --no-git-tag-version
   ```

4. **Run Tests**

   ```bash
   npm test
   ```

5. **Create Git Tag**

   ```bash
   git tag v${NEW_VERSION}
   ```

6. **Commit and Push**

   ```bash
   git commit -am "chore(release): bump version to v${NEW_VERSION} [skip ci]"
   git push && git push --tags
   ```

**Outputs**:

- New version tag (e.g., `v1.46.0`)
- Updated package.json committed to main
- Triggers `release-binaries.yml` and `publish-npm.yml`

### 2. release-binaries.yml

**Purpose**: Build platform-specific native modules

**Trigger**:

```yaml
on:
  push:
    tags: ["v*"]
```

**Strategy Matrix**:

```yaml
matrix:
  settings:
    - host: macos-latest
      target: x86_64-apple-darwin
      name: darwin-x64
    - host: macos-latest
      target: aarch64-apple-darwin
      name: darwin-arm64
    - host: ubuntu-latest
      target: x86_64-unknown-linux-gnu
      name: linux-x64
    - host: ubuntu-latest
      target: aarch64-unknown-linux-gnu
      name: linux-arm64
    - host: windows-latest
      target: x86_64-pc-windows-msvc
      name: win32-x64
```

**Build Steps** (per platform):

1. Checkout tagged ref
2. Setup Rust toolchain
3. Add cross-compilation target

   ```bash
   rustup target add ${{ matrix.settings.target }}
   ```

4. Build native module

   ```bash
   cargo build --release --target ${{ matrix.settings.target }}
   ```

5. Upload artifact to GitHub release

**Outputs**:

- 5 platform-specific `.node` files
- Attached to GitHub release as assets

### 3. publish-npm.yml

**Purpose**: Publish package to npm registry

**Trigger**:

```yaml
on:
  push:
    tags: ["v*"]
  workflow_dispatch:
    inputs:
      dry_run:
        type: boolean
        default: true
```

**Process**:

1. Checkout tagged ref
2. Install dependencies

   ```bash
   npm ci
   ```

3. Build TypeScript

   ```bash
   npm run build
   ```

4. Build Bun bundle

   ```bash
   npm run build:bundle
   ```

5. Run tests

   ```bash
   npm test
   ```

6. Publish to npm

   ```bash
   npm publish --access public --provenance
   ```

**Features**:

- **Provenance**: Cryptographic proof of build origin
- **Dry-run Mode**: Test publish without actual release
- **Trusted Publishers**: Uses GitHub OIDC (no npm token needed)

**Outputs**:

- Package published to `@thebushidocollective/han`
- Provenance attestation linked to GitHub Actions

### 4. deploy-website.yml

**Purpose**: Build and deploy static website to GitHub Pages

**Trigger**:

```yaml
on:
  push:
    branches: [main]
    paths:
      - "website/**"
      - "jutsu/**"
      - "do/**"
      - "hashi/**"
      - "bushido/**"
```

**Build Process**:

1. Checkout repository
2. Setup Node.js 20
3. Install dependencies

   ```bash
   cd website && npm ci
   ```

4. Copy marketplace to public

   ```bash
   cp .claude-plugin/marketplace.json website/public/
   ```

5. Build Next.js (static export)

   ```bash
   npm run build  # Runs prebuild + next build
   ```

6. Add `.nojekyll` file

   ```bash
   touch out/.nojekyll
   ```

7. Upload artifact
8. Deploy to GitHub Pages

**Pre-build Scripts**:

- `generate-marketplace.ts` - Transform marketplace.json
- `generate-search-index.ts` - Build search index

**Output**:

- Static site deployed to https://han.guru
- Marketplace and search index available at `/marketplace.json` and `/search-index.json`

### 5. test-website.yml

**Purpose**: Run Playwright E2E tests on website

**Trigger**:

```yaml
on:
  pull_request:
    paths: ["website/**"]
  push:
    branches: [main]
    paths: ["website/**"]
```

**Process**:

1. Checkout code
2. Install dependencies
3. Install Playwright browsers

   ```bash
   npx playwright install --with-deps
   ```

4. Build website

   ```bash
   npm run build
   ```

5. Start server

   ```bash
   npm start &
   ```

6. Run tests

   ```bash
   npx playwright test
   ```

7. Upload test report

**Tests**:

- Plugin search functionality
- Navigation between pages
- Installation instructions rendering
- Responsive layout

### 6. claudelint.yml

**Purpose**: Validate Claude Code plugin structure

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

**Validation**:

```bash
uvx claudelint . --strict
```

**Checks**:

- plugin.json schema validity
- hooks.json structure
- Skill/command/agent file format
- Frontmatter presence and validity
- Marketplace.json consistency

### 7. bump-plugin-versions.yml

**Purpose**: Update plugin versions in CLI dependencies

**Trigger**: Manual (workflow_dispatch)

**Process**:

1. Read current han version from package.json
2. Update optionalDependencies versions

   ```json
   {
     "@thebushidocollective/han-darwin-arm64": "1.46.0",
     "@thebushidocollective/han-darwin-x64": "1.46.0",
     ...
   }
   ```

3. Commit changes
4. Create pull request

### 8. auto-fix-ci.yml

**Purpose**: Automatically fix CI failures

**Trigger**:

```yaml
on:
  push:
    branches: [main]
```

**Fixes**:

- Formatting issues (Biome)
- Linting errors (Biome)
- Type errors (TypeScript)

**Process**:

1. Run formatters/linters
2. If changes detected, commit and push
3. Re-trigger CI

### 9. claude-code-review.yml

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

### 10. issue-triage.yml, issue-deduplication.yml

**Purpose**: Automated issue management

**Triage**:

- Label issues based on content
- Assign to appropriate team members
- Set priority

**Deduplication**:

- Detect duplicate issues
- Link related issues
- Suggest closing duplicates

## Behavior

### Release Flow

```
Code Push to main (packages/bushido-han/**)
         ↓
auto-tag-release.yml
  - Detect version bump type
  - Build native module
  - Run tests
  - Create tag (e.g., v1.46.0)
  - Push tag
         ↓
    ┌────┴────┐
    ↓         ↓
release-binaries.yml    publish-npm.yml
  - Build 5 platforms    - Checkout tag
  - Upload to release    - Build + test
                        - Publish to npm
```

### Website Deployment Flow

```
Code Push to main (website/** or plugins/**)
         ↓
test-website.yml (if PR)
  - Run Playwright tests
         ↓
deploy-website.yml
  - Generate marketplace.json
  - Generate search-index.json
  - Build Next.js (static)
  - Deploy to GitHub Pages
         ↓
    https://han.guru
```

### Quality Checks

```
Pull Request Created/Updated
         ↓
    ┌────┴────┬─────────┬────────────┐
    ↓         ↓         ↓            ↓
claudelint  test-website  auto-fix  code-review
  - Validate   - E2E tests  - Fix issues  - AI review
  - Plugins    - Playwright  - Auto-commit - Comment PR
```

## Permissions

### GitHub Actions Token

**Permissions**:

```yaml
permissions:
  contents: write        # Push commits and tags
  pull-requests: write   # Comment on PRs
  pages: write          # Deploy to GitHub Pages
  id-token: write       # npm provenance
```

### npm Publishing

**Method**: Trusted Publishers (OIDC)

**Setup**:

1. Configure in npm: https://www.npmjs.com/package/@thebushidocollective/han/access
2. Add GitHub Actions as trusted publisher
3. No npm token needed in secrets

### GitHub Pages

**Setup**:

1. Settings → Pages → Source: GitHub Actions
2. Workflow has `pages: write` permission
3. Automatic deployment on push to main

## Files

### Workflows

- `.github/workflows/auto-tag-release.yml` - Version and tag automation
- `.github/workflows/release-binaries.yml` - Native module builds
- `.github/workflows/publish-npm.yml` - npm publishing
- `.github/workflows/deploy-website.yml` - Website deployment
- `.github/workflows/test-website.yml` - E2E testing
- `.github/workflows/claudelint.yml` - Plugin validation
- `.github/workflows/auto-fix-ci.yml` - Automatic fixes
- `.github/workflows/claude-code-review.yml` - AI code review
- `.github/workflows/bump-plugin-versions.yml` - Version updates
- `.github/workflows/issue-triage.yml` - Issue labeling
- `.github/workflows/issue-deduplication.yml` - Duplicate detection

### Configuration

- `package.json` - Version, scripts, dependencies
- `tsconfig.json` - TypeScript compiler options
- `biome.json` - Linting/formatting rules
- `playwright.config.ts` - E2E test configuration

## Related Systems

- [CLI Architecture](./cli-architecture.md) - Builds CLI package
- [Native Module](./native-module.md) - Compiles Rust bindings
- [Website](./website.md) - Deploys static site
- [Marketplace](./marketplace.md) - Validates marketplace structure
