---
workflow: default
created: 2026-01-31
status: active
---

# Documentation Reorganization

## Problem

The Han documentation still references the old branded plugin categories (jutsu/do/hashi) throughout 19 docs files and 7 blog posts. This creates confusion for users who see the new tech layer categories (languages/frameworks/validation/tools/services/disciplines/patterns/specialized) in the UI but old terminology in the docs.

## Solution

Full rewrite of all documentation to:
1. Replace all jutsu/do/hashi references with new tech layer categories
2. Update all plugin name examples (e.g., `jutsu-typescript` → `typescript`)
3. Rewrite the plugin-categories.md page to explain the new 9-category structure
4. Update installation commands and code examples throughout
5. Ensure consistency between docs and current website UI

## Success Criteria

- [ ] All 19 docs files updated to use new tech layer categories
- [ ] No remaining references to `jutsu-*`, `do-*`, `hashi-*` plugin prefixes
- [ ] All 7 blog posts updated to use new terminology
- [ ] Plugin categories page completely rewritten for 9-category structure
- [ ] Getting-started guide uses new plugin names and commands
- [ ] All code examples use new plugin names
- [ ] Website builds successfully after all updates
- [ ] No broken internal links in documentation

## Context

The plugin reorganization was completed in PR #45, which updated:
- Filesystem structure from branded to tech layer directories
- marketplace.json with new category mappings
- Website UI (home page, sidebar, plugin pages)
- Installation examples and han-config.yml

This documentation update is the final step to complete the reorganization.

## Files to Update

### Documentation (19 files)
- content/docs/index.md
- content/docs/getting-started.md
- content/docs/plugin-categories.md
- content/docs/integrations.md
- content/docs/installation/index.md
- content/docs/installation/plugins.md
- content/docs/installation/scopes.md
- content/docs/cli/index.md
- content/docs/cli/hooks.md
- content/docs/cli/plugins.md
- content/docs/cli/other.md
- content/docs/configuration/index.md
- content/docs/configuration/caching.md
- content/docs/features/hooks.md
- content/docs/features/checkpoints.md
- content/docs/features/memory.md
- content/docs/plugin-development/index.md
- content/docs/plugin-development/types.md
- content/docs/plugin-development/hooks.md
- content/docs/plugin-development/skills.md
- content/docs/plugin-development/testing.md
- content/docs/plugin-development/distribution.md

### Blog Posts (7 files)
- content/blog/introduction-to-han-plugins.md
- content/blog/third-party-plugins.md
- content/blog/ai-dlc-2026-paper.md
- content/blog/mcp-architecture.md
- content/blog/checkpoint-system.md
- content/blog/han-memory-system.mdx
- content/blog/testing-with-confidence.md
