# Marketplace Plugin Aliases (CRITICAL)

## NEVER Remove Plugin Aliases from marketplace.json

The marketplace.json file MUST contain alias entries for backwards compatibility with existing user installations.

### Why Aliases Are Required

1. **Users have existing settings** with old plugin names like `jutsu-typescript@han`, `hashi-gitlab@han`, `do-api-engineering@han`
2. **Claude Code resolves plugins by name** directly from marketplace.json - it does NOT use han's CLI alias resolution
3. **Removing aliases breaks existing installations** - users see "Plugin not found" errors

### Alias Format

Aliases are regular plugin entries that point to the same source directory as the canonical entry:

```json
{
  "name": "typescript",
  "source": "./plugins/languages/typescript",
  ...
},
{
  "name": "jutsu-typescript",
  "source": "./plugins/languages/typescript",
  ...
}
```

Both entries point to the same directory. This is intentional and required.

### Do NOT Add These Fields

Previous attempts added `deprecated` and `alias_for` fields which caused Claude Code's marketplace validator to reject them. Keep alias entries as normal plugin entries:

```json
// WRONG - causes schema errors
{
  "name": "jutsu-typescript",
  "deprecated": true,
  "alias_for": "typescript",
  ...
}

// CORRECT - just a regular entry pointing to same source
{
  "name": "jutsu-typescript",
  "source": "./plugins/languages/typescript",
  ...
}
```

### Source of Truth for Aliases

The `packages/han/lib/plugin-aliases.ts` file defines the mapping of old names to new paths. When adding new plugins or reorganizing, ensure:

1. The canonical (short) name exists in marketplace.json
2. ALL alias variants from plugin-aliases.ts also exist in marketplace.json
3. All entries point to the correct `./plugins/` path

### Common Alias Patterns

| Pattern | Example Old Name | Maps To |
|---------|-----------------|---------|
| `jutsu-{name}` | `jutsu-typescript` | `languages/typescript` |
| `hashi-{name}` | `hashi-gitlab` | `services/gitlab` |
| `do-{name}` | `do-api` | `disciplines/api-engineering` |
| `do-{name}-engineering` | `do-api-engineering` | `disciplines/api-engineering` |
| `do-{name}-development` | `do-backend-development` | `disciplines/backend-development` |

### If You See "Plugin not found" Errors

Check that:
1. The plugin name in the user's settings exists in marketplace.json
2. The source path is correct (includes `./plugins/` prefix)
3. The target directory actually exists
