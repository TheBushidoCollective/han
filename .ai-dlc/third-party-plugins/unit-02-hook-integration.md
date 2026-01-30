---
status: in_progress
depends_on: []
branch: ai-dlc/third-party-plugins/02-hook-integration
discipline: backend
---

# unit-02-hook-integration

## Description

Ensure the han hook system discovers and executes hooks from externally-installed plugins (not in the han repo). Verify that external plugins integrate seamlessly with the hook orchestration system.

## Discipline

backend - This unit involves the han hook orchestrator and plugin discovery system.

## Success Criteria

- [ ] han discovers hooks from plugins installed via local path
- [ ] han discovers hooks from plugins installed via git URL
- [ ] External plugin hooks run in correct order with first-party hooks
- [ ] `han hook list` shows hooks from external plugins
- [ ] Hook caching works correctly for external plugins
- [ ] External plugin hooks can define dependencies on han hooks

## Notes

- Review how Claude Code discovers plugins via settings.json
- Check if CLAUDE_PLUGIN_ROOT is set correctly for external plugins
- Test with a real external plugin installed from a different directory
- May need to update hook discovery to search all installed plugin locations

## Plan

### Current Architecture Understanding

The han hook system already has partial support for external plugins through the marketplace configuration system:

1. **Plugin Discovery** (`getMergedPluginsAndMarketplaces` in `lib/config/claude-settings.ts`):
   - Reads `enabledPlugins` from settings files (user, project, local, enterprise scopes)
   - Plugin format: `"pluginName@marketplaceName": true`
   - Marketplace configurations stored in `extraKnownMarketplaces`

2. **Plugin Root Resolution** (`getPluginDir` in multiple files):
   - For `source: "directory"` - uses local path directly
   - For `source: "github"` - looks in `~/.claude/plugins/marketplaces/{marketplace}/`
   - For `source: "git"` - same as github pattern
   - Falls back to cwd if running in a marketplace repo (development mode)

3. **Hook Loading** (`loadPluginConfig` in `lib/hooks/hook-config.ts`):
   - Reads `han-plugin.yml` from plugin root
   - Parses hook definitions with event bindings

4. **Hook Orchestration** (`orchestrate.ts`):
   - Iterates through all enabled plugins
   - Loads their `han-plugin.yml` configs
   - Executes hooks matching the event type

### Gap Analysis

External plugin support largely already exists, but there are gaps:

1. **No explicit "han hook list" command** - Need to verify hooks from all sources are discoverable
2. **Git URL installations** - The `source: "git"` path resolution needs verification
3. **Local path installations** - The `source: "directory"` needs testing with external paths
4. **Hook caching** - Need to verify cache keys distinguish external plugins correctly
5. **Dependency resolution** - Cross-plugin dependencies need testing with external plugins
6. **CLAUDE_PLUGIN_ROOT** - Need to verify this is set correctly for external plugins

### Implementation Steps

#### Phase 1: Investigation and Verification

1. Create a test external plugin outside the han repo
2. Test local path installation with `source: "directory"`
3. Verify hook discovery with `han hook orchestrate Stop --verbose`

#### Phase 2: Implement Missing Functionality

1. **Add "han hook list" command** (if not present):
   - List all discovered hooks from all installed plugins
   - Show source (marketplace, path) for each hook
   - Group by plugin and event type

2. **Fix plugin root resolution for external plugins** (if needed):
   - Ensure `getPluginDir` correctly handles absolute/relative local paths and git-cloned locations

3. **Update cache key generation** (if needed):
   - Include full plugin path in cache key to distinguish same-named hooks

4. **Verify CLAUDE_PLUGIN_ROOT propagation**:
   - Ensure `executeHookInDirectory` sets correct `pluginRoot` for external plugins

#### Phase 3: Add Tests

Create test suite for external plugin integration:

1. **Unit tests** (`test/external-plugin-hooks.test.ts`):
   - Test plugin discovery with directory source
   - Test plugin discovery with git source
   - Test hook loading from external plugin
   - Test cache isolation between plugins

2. **Integration tests**:
   - Install external plugin via local path
   - Run hooks and verify execution
   - Test dependency resolution across first-party and external plugins

### Files to Modify

1. `packages/han/lib/commands/hook/index.ts` - Add hook list command registration
2. Create `packages/han/lib/commands/hook/list.ts` - Implement hook listing
3. `packages/han/lib/commands/hook/orchestrate.ts` - Verify external plugin handling
4. `packages/han/lib/config/claude-settings.ts` - Verify marketplace resolution
5. Create `packages/han/test/external-plugin-hooks.test.ts` - Add comprehensive tests

### Critical Files

- `packages/han/lib/commands/hook/orchestrate.ts` - Core orchestration logic
- `packages/han/lib/config/claude-settings.ts` - Plugin/marketplace resolution
- `packages/han/lib/hooks/hook-config.ts` - Plugin config loading
- `packages/han/lib/commands/hook/dispatch.ts` - Legacy dispatch
