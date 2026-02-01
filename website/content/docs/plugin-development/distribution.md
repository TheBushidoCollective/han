---
title: "Distribution"
description: "How to share your Han plugins via local paths, Git repositories, URLs, or the Han marketplace."
---

Once your plugin is tested and ready, you have several options for distribution. This guide covers all methods from simple local sharing to marketplace submission.

## Distribution Methods

| Method | Best For | Installation |
|--------|----------|--------------|
| Local Path | Development, private plugins | `han plugin install --path ./my-plugin` |
| Git Repository | Team sharing, open source | `han plugin install --git https://github.com/...` |
| URL Archive | Quick sharing, no Git | `han plugin install --url https://.../plugin.tar.gz` |
| Han Marketplace | Public distribution | `han plugin install my-plugin` |

## Local Path Distribution

The simplest method - share a directory:

### Installation

```bash
# From absolute path
han plugin install --path /Users/me/plugins/my-plugin

# From relative path
han plugin install --path ./my-plugin

# With scope
han plugin install --path ./my-plugin --scope project
```

### Use Cases

- Local development and testing
- Private plugins within an organization
- Plugins embedded in monorepos

### Sharing

Share the plugin directory via:

- File sharing (Dropbox, Google Drive)
- Internal network drives
- Copying to team members

## Git Repository Distribution

Host your plugin in a Git repository for version control and easy updates.

### Repository Structure

Your repository should contain the plugin at its root:

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json
├── han-plugin.yml
├── skills/
├── README.md
└── CHANGELOG.md
```

Or in a subdirectory:

```
my-plugins-repo/
├── biome/
│   └── ...
├── eslint/
│   └── ...
└── README.md
```

### Installation

```bash
# From GitHub (default branch)
han plugin install --git https://github.com/user/my-plugin

# Specific branch
han plugin install --git https://github.com/user/my-plugin --branch main

# Specific tag
han plugin install --git https://github.com/user/my-plugin --tag v1.0.0

# Subdirectory
han plugin install --git https://github.com/user/plugins --path biome
```

### Version Tags

Use Git tags for versioning:

```bash
# Create version tag
git tag v1.0.0
git push origin v1.0.0

# Users install specific version
han plugin install --git https://github.com/user/my-plugin --tag v1.0.0
```

### Branch Strategy

- `main` - Stable releases
- `develop` - Development versions
- `v*` tags - Specific versions

## URL Archive Distribution

Distribute plugins as downloadable archives.

### Creating Archives

```bash
# Create tar.gz
tar -czvf my-plugin-1.0.0.tar.gz -C /path/to my-plugin

# Create zip
zip -r my-plugin-1.0.0.zip my-plugin
```

### Hosting Options

- GitHub Releases
- S3 / Cloud Storage
- Personal website
- CDN

### Installation

```bash
# From URL
han plugin install --url https://example.com/plugins/my-plugin-1.0.0.tar.gz

# From GitHub Release
han plugin install --url https://github.com/user/repo/releases/download/v1.0.0/my-plugin.tar.gz
```

### Archive Structure

Archives should extract to a single directory:

```
my-plugin-1.0.0.tar.gz
└── my-plugin/
    ├── .claude-plugin/
    │   └── plugin.json
    ├── han-plugin.yml
    └── ...
```

## Han Marketplace Submission

For maximum visibility, submit to the Han marketplace.

### Prerequisites

1. Plugin passes validation (`han plugin validate .`)
2. Comprehensive README
3. Proper versioning (semver)
4. License specified
5. Author information complete

### Submission Process

1. **Fork the Han repository**

   ```bash
   gh repo fork thebushidocollective/han
   ```

2. **Add your plugin**

   Place in the appropriate category directory:

   | Category | Directory |
   |----------|-----------|
   | Language | `languages/` |
   | Framework | `frameworks/` |
   | Validation | `validation/` |
   | Tool | `tools/` |
   | Integration | `services/` |
   | Discipline | `disciplines/` |
   | Pattern | `patterns/` |
   | Specialized | `specialized/` |

3. **Follow naming conventions**

   Use simple, clear names that match the tool or concept:
   - `typescript` (language)
   - `react` (framework)
   - `biome` (validation)
   - `playwright` (tool)
   - `github` (integration)
   - `frontend` (discipline)
   - `tdd` (pattern)
   - `android` (specialized)

4. **Submit a pull request**

   ```bash
   gh pr create --title "Add biome validation plugin" \
     --body "Description of your plugin..."
   ```

5. **Review process**

   The Han team reviews for:
   - Plugin structure compliance
   - Documentation quality
   - Code quality (if applicable)
   - No security issues

### Marketplace Requirements

**Required:**

- `.claude-plugin/plugin.json` with all fields
- `README.md` with installation and usage
- `CHANGELOG.md` with version history
- Valid `han-plugin.yml` (if hooks)
- License file or field

**Recommended:**

- Examples in README
- Troubleshooting section
- Version compatibility notes
- Screenshots (for UI-related plugins)

### After Acceptance

Once merged:

- Plugin appears at han.guru/plugins
- Users can install with `han plugin install your-plugin`
- Searchable in `han plugin search`
- Auto-detected by `han plugin install --auto` (if applicable)

## Versioning Guidelines

Follow semantic versioning (semver):

```
MAJOR.MINOR.PATCH
```

- **MAJOR** - Breaking changes
- **MINOR** - New features, backward compatible
- **PATCH** - Bug fixes, backward compatible

### Version in plugin.json

```json
{
  "name": "biome",
  "version": "1.2.3"
}
```

### Updating Versions

1. Update `plugin.json` version
2. Update `CHANGELOG.md`
3. Create Git tag (if using Git)
4. Push changes

## Documentation Best Practices

### README Structure

```markdown
# Plugin Name

Brief description.

## Installation

\`\`\`bash
han plugin install my-plugin
\`\`\`

## Features

- Feature 1
- Feature 2

## Configuration

How to configure...

## Usage

How to use...

## Hooks (for validation/tool plugins)

| Hook | Description |
|------|-------------|
| lint | Runs linter |

## Skills (if any)

- skill-a: Description
- skill-b: Description

## Requirements

- Tool version X.Y+
- Node.js 18+

## License

MIT
```

### CHANGELOG Structure

```markdown
# Changelog

## [1.2.0] - 2024-01-15

### Added
- New feature X

### Changed
- Updated hook behavior

### Fixed
- Bug in configuration loading

## [1.1.0] - 2024-01-01

### Added
- Initial skill set
```

## Private Distribution

For organization-internal plugins:

### Option 1: Private Git Repository

```bash
# Users install with credentials
han plugin install --git https://github.com/org/private-plugin

# Or via SSH
han plugin install --git git@github.com:org/private-plugin.git
```

### Option 2: Private Registry

Set up an internal plugin registry:

1. Host plugin archives internally
2. Configure registry URL
3. Users install normally

### Option 3: Monorepo Embedding

Include plugins in your project:

```
your-project/
├── .claude/
│   └── plugins/
│       └── my-internal-plugin/
│           └── ...
└── ...
```

Install with:

```bash
han plugin install --path .claude/plugins/my-internal-plugin --scope project
```

## Distribution Checklist

Before distributing:

- [ ] `han plugin validate .` passes
- [ ] All hooks tested and working
- [ ] README is comprehensive
- [ ] CHANGELOG is up to date
- [ ] License is specified
- [ ] Version follows semver
- [ ] No sensitive data included
- [ ] Dependencies documented
- [ ] Works on target platforms

## Support and Maintenance

After distribution:

1. **Monitor issues** - Watch for bug reports
2. **Release updates** - Fix bugs, add features
3. **Communicate changes** - Update CHANGELOG
4. **Maintain compatibility** - Test with Han updates
5. **Respond to feedback** - Improve based on user input
