# Plugin Naming Convention (Current)

## IMPORTANT: Forget Old Naming Format

The old plugin naming format with prefixes is **deprecated**. Do NOT use:
- ~~`jutsu-typescript`~~ → Use `typescript`
- ~~`jutsu-biome`~~ → Use `biome`
- ~~`hashi-github`~~ → Use `github`
- ~~`hashi-gitlab`~~ → Use `gitlab`
- ~~`do-frontend-development`~~ → Use `frontend-development`

## Current Plugin Names

Plugins are named by their short identifier only, matching their directory name:

| Category | Directory | Plugin Name |
|----------|-----------|-------------|
| Languages | `languages/typescript` | `typescript` |
| Languages | `languages/rust` | `rust` |
| Validation | `validation/biome` | `biome` |
| Validation | `validation/eslint` | `eslint` |
| Services | `services/github` | `github` |
| Services | `services/gitlab` | `gitlab` |
| Tools | `tools/playwright` | `playwright` |
| Tools | `tools/vitest` | `vitest` |
| Frameworks | `frameworks/relay` | `relay` |
| Disciplines | `disciplines/frontend-development` | `frontend-development` |
| Disciplines | `disciplines/api-engineering` | `api-engineering` |
| Disciplines | `disciplines/security-engineering` | `security-engineering` |

## Installation Commands

```bash
# Correct
claude plugin install typescript@han
claude plugin install github@han
claude plugin install biome@han

# WRONG - old format
claude plugin install jutsu-typescript@han
claude plugin install hashi-github@han
```

## In Code

When referencing plugin names in code:

```typescript
// Correct
const VCS_PLUGIN_MAP = {
  "github.com": "github",
  "gitlab.com": "gitlab",
};

// WRONG - old format
const VCS_PLUGIN_MAP = {
  "github.com": "hashi-github",  // DON'T USE
  "gitlab.com": "hashi-gitlab",  // DON'T USE
};
```

## Why This Changed

The old prefixes (`jutsu-`, `hashi-`, `do-`) were replaced with a flat namespace where plugins are identified solely by their short name. The category is determined by the directory structure, not a name prefix.
