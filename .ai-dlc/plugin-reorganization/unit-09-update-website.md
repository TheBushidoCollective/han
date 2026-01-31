---
status: completed
depends_on:
  - unit-02-move-languages
  - unit-03-move-frameworks
  - unit-04-move-validation
  - unit-05-move-tools
  - unit-06-move-services
  - unit-07-move-disciplines
  - unit-08-move-patterns
branch: ai-dlc/plugin-reorganization/09-update-website
discipline: frontend
---

# unit-09-update-website

## Description

Update the han.guru website plugin index to reflect new category structure. Update marketplace.json with new plugin paths.

## Discipline

frontend - Website content and data updates

## Success Criteria

- [ ] marketplace.json updated with all new plugin paths
- [ ] Website plugin index shows new categories
- [ ] Category pages exist: languages, frameworks, validation, tools, services, disciplines, patterns
- [ ] Search/filtering works with new structure
- [ ] Old URLs redirect to new (if applicable)

## Implementation Notes

Files to update:
- `website/public/marketplace.json` - Plugin registry
- `website/content/plugins/` - Plugin documentation pages
- `website/app/plugins/` - Plugin listing pages

New category structure should be intuitive:
- "Where's TypeScript support?" → languages/typescript
- "Where's React/Relay?" → frameworks/relay
- "Where's linting?" → validation/biome
