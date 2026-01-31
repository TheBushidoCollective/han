---
status: pending
depends_on:
  - unit-01-alias-system
branch: ai-dlc/plugin-reorganization/10-auto-migration
discipline: backend
---

# unit-10-auto-migration

## Description

Implement automatic migration for existing user installations. When han runs, detect old plugin names in settings and update them to new names.

## Discipline

backend - CLI migration logic

## Success Criteria

- [ ] Detect old plugin names in ~/.claude/settings.json
- [ ] Detect old plugin names in .claude/settings.json
- [ ] Auto-update to new names on next han run
- [ ] Log migration actions for user awareness
- [ ] Preserve all other settings
- [ ] Unit tests cover migration scenarios

## Implementation Notes

Location: `packages/han/lib/migrate.ts` (new file)

```typescript
export async function migratePluginNames(): Promise<void> {
  // Read settings files
  // For each installed plugin, check if name is in PLUGIN_ALIASES
  // If so, update to new name
  // Write updated settings
  // Log what was migrated
}
```

Called from:
- `han plugin install` (after install)
- `han` startup (SessionStart hook could trigger this)

Migration should be idempotent - running multiple times is safe.
