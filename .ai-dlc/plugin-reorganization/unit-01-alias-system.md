---
status: completed
depends_on: []
branch: ai-dlc/plugin-reorganization/01-alias-system
discipline: backend
---

# unit-01-alias-system

## Description

Implement the alias resolution system that maps old plugin names (e.g., `jutsu-typescript`) to new paths (e.g., `languages/typescript`). This is the foundation for backwards compatibility.

## Discipline

backend - Core CLI logic for plugin resolution

## Success Criteria

- [ ] Alias map defined in code with all old→new mappings
- [ ] `han plugin install jutsu-typescript` resolves to `languages/typescript`
- [ ] `han plugin install typescript` works directly
- [ ] Alias resolution has unit tests with 70%+ coverage
- [ ] Integration test verifies full install flow with old name

## Implementation Notes

Location: `packages/han/lib/plugin-aliases.ts` (new file)

```typescript
export const PLUGIN_ALIASES: Record<string, string> = {
  // Languages
  "jutsu-typescript": "languages/typescript",
  "jutsu-rust": "languages/rust",
  // ... etc
};

export function resolvePluginName(name: string): string {
  return PLUGIN_ALIASES[name] || name;
}
```

Integration points:
- `packages/han/lib/install.ts` - call resolvePluginName before fetching
- `packages/han/lib/shared.ts` - utility functions may need updates
