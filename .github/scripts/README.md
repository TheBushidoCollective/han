# CI/CD Scripts

This directory contains scripts used by GitHub Actions workflows for automation.

## generate-changelog.sh

Automatically generates `CHANGELOG.md` files based on conventional commit messages.

### Usage

```bash
./generate-changelog.sh <path> <new_version> [old_version]
```

**Arguments:**

- `path`: Path to the directory (e.g., `packages/bushido-han`, `jutsu/jutsu-react`, `website`)
- `new_version`: The new version being released (e.g., `1.2.3`)
- `old_version`: (Optional) The previous version (e.g., `1.2.2`) - will auto-detect if not provided

**Examples:**

```bash
# Generate changelog for the CLI
./generate-changelog.sh packages/bushido-han 1.32.2

# Generate changelog for a plugin
./generate-changelog.sh jutsu/jutsu-react 2.1.0 2.0.5

# Generate changelog for the website
./generate-changelog.sh website 0.5.0
```

### How It Works

1. Extracts commits from git history for the specified path
2. Filters out version bump commits (those with `[skip ci]`)
3. Categorizes commits based on conventional commit prefixes:
   - `feat:` → Added section
   - `fix:` → Fixed section
   - `refactor:` → Changed section
   - `chore:` → Excluded from changelog
   - Breaking changes (`!:` or `BREAKING CHANGE`) → BREAKING CHANGES section
4. Generates a Keep a Changelog formatted CHANGELOG.md
5. Preserves existing changelog entries from previous versions

### Integration with Workflows

The script is automatically invoked by these workflows:

- **auto-tag-release.yml** - Generates changelog for the CLI (`packages/bushido-han/`)
- **bump-plugin-versions.yml** - Generates changelogs for each changed plugin
- **bump-website-version.yml** - Generates changelog for the website

### Changelog Format

Generated changelogs follow the [Keep a Changelog](https://keepachangelog.com/) format and are organized by semantic version:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-12-02

### Added

- New feature description ([abc123](../../commit/abc123))

### Fixed

- Bug fix description ([def456](../../commit/def456))

### Changed

- Refactoring description ([ghi789](../../commit/ghi789))
```

Each entry includes a link to the commit for easy reference.
