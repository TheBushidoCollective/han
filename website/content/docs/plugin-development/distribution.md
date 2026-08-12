---
title: "Distribution"
description: "How to share your Han plugins via local paths, Git repositories, URLs, or the Han marketplace."
---

Once your plugin is tested and ready, you have two ways to distribute it: submit it to the Han marketplace, or publish it in a marketplace repository of your own.

`han plugin install` resolves plugin names against a marketplace. It has no `--path`, `--git`, `--url`, `--branch`, or `--tag` flags; earlier documentation described those and none of them exist. The full option set is `--auto`, `--no-analyze`, `--scope`, and `--from`.

## Distribution Methods

| Method | Best For | Installation |
|--------|----------|--------------|
| Han marketplace | Public distribution | `han plugin install my-plugin` |
| Your own marketplace repo | Team or private plugins | `han plugin install my-plugin --from myorg/my-plugins` |
| Local development | Building and testing a plugin | Run from a checkout of the marketplace repo |

## External Marketplace Repositories

`--from` points Han at another GitHub repository that carries its own `.claude-plugin/marketplace.json`. This is how you ship plugins to a team without landing them in the public Han marketplace.

```bash
# Install from another org's marketplace
han plugin install ai-dlc --from thebushidocollective/ai-dlc

# Your own private plugin set
han plugin install internal-linter --from myorg/claude-plugins
```

### Repository Structure

Mirror the Han marketplace layout: plugins in category directories, all of them registered in a root manifest.

```
my-plugins-repo/
├── .claude-plugin/
│   └── marketplace.json      # Registers every plugin below
├── validation/
│   └── internal-linter/
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── han-plugin.yml
│       ├── skills/
│       ├── README.md
│       └── CHANGELOG.md
└── README.md
```

Each entry in `marketplace.json` needs `name`, `description`, `source` (the path to the plugin directory), `category`, and `keywords`:

```json
{
  "name": "internal-linter",
  "description": "House lint rules for our services.",
  "source": "./validation/internal-linter",
  "category": "Validation",
  "keywords": ["lint", "internal"]
}
```

### Versioning Through Git

Han reads the repository's default branch, so tag releases for your own record-keeping and merge to the default branch to publish:

```bash
git tag v1.0.0
git push origin v1.0.0
```

There is no `--tag` or `--branch` flag to pin an install to a specific ref.

## Local Development

To iterate on a plugin, work inside a checkout of the marketplace repository that contains it. Han discovers plugins from the marketplace manifest, so a plugin registered in the local `.claude-plugin/marketplace.json` is visible to `han plugin install`, `han hook list`, and `han plugin validate` without any extra install step.

```bash
# From the plugin directory
han plugin validate

# Regenerate hooks.json after editing han-plugin.yml
han plugin generate-hooks

# Run the hook you just defined
han hook run my-plugin lint --verbose
```

## Han Marketplace Submission

For maximum visibility, submit to the Han marketplace.

### Prerequisites

1. Plugin passes validation (run `han plugin validate` from the plugin directory)
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

### Option 1: Private Marketplace Repository

Put your plugins in a private GitHub repository with its own `.claude-plugin/marketplace.json`, then install by name with `--from`. Users need read access to the repo and a working `gh` or git credential for it.

```bash
han plugin install internal-linter --from org/private-plugins
```

### Option 2: Monorepo Embedding

Keep plugins in the project that uses them, registered in the repository's own marketplace manifest:

```
your-project/
├── .claude-plugin/
│   └── marketplace.json
├── plugins/
│   └── internal-linter/
│       ├── .claude-plugin/
│       │   └── plugin.json
│       └── han-plugin.yml
└── ...
```

Han discovers plugins through the marketplace manifest, so a plugin registered here is available to `han hook run` and `han plugin validate` from inside the repo with no install step.

There is no private registry protocol and no `--path` or `--git` install flag. Both were described in earlier documentation; neither exists.

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
