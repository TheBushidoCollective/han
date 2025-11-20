# Releasing @thebushidocollective/han

This document describes how to release a new version of
@thebushidocollective/han to npm.

## Prerequisites

1. You must have write access to the repository
2. An `NPM_TOKEN` secret must be configured in GitHub repository
   settings with publish permissions

## Release Process

### 1. Update Version

Update the version in `package.json`:

```bash
cd packages/bushido-han
npm version patch  # or minor, or major
```

This will update the version and create a git commit.

### 2. Create and Push Tag

Create a tag following the naming convention:

```bash
git tag han-v1.0.1
git push origin han-v1.0.1
```

**Important:** The tag must start with `han-v` to trigger
the publish workflow.

### 3. GitHub Actions

Once the tag is pushed, GitHub Actions will automatically:

1. Checkout the code
2. Setup Node.js 20
3. Install dependencies
4. Publish to npm with provenance

### 4. Verify Publication

Check that the package was published successfully:

```bash
npm view @thebushidocollective/han
```

Or visit: <https://www.npmjs.com/package/@thebushidocollective/han>

## Version Guidelines

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes
- **MINOR** (1.0.0 → 1.1.0): New features, backwards-compatible
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, backwards-compatible

## Troubleshooting

### Publish Failed

If the GitHub Action fails:

1. Check the Actions tab in GitHub for error logs
2. Verify `NPM_TOKEN` secret is set correctly
3. Ensure the version in package.json hasn't been published before
4. Check npm registry status at <https://status.npmjs.org/>

### Tag Already Exists

If you need to re-release:

```bash
git tag -d han-v1.0.1
git push origin :refs/tags/han-v1.0.1
# Fix issues, then create tag again
git tag han-v1.0.1
git push origin han-v1.0.1
```

## Manual Publishing (Emergency Only)

If GitHub Actions is unavailable:

```bash
cd packages/bushido-han
npm login
npm publish --access public
```
