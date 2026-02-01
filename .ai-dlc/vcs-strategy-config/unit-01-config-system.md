---
status: complete
depends_on: []
branch: ai-dlc/vcs-strategy-config/01-config-system
discipline: backend
---

# unit-01-config-system

## Description

Implement the `.ai-dlc/settings.yml` configuration system with schema definition, loading logic, and per-intent override support.

## Discipline

backend - This unit involves TypeScript/shell configuration loading and YAML parsing in the jutsu-ai-dlc plugin.

## Success Criteria

- [ ] `.ai-dlc/settings.yml` schema defined with `git:` and `jj:` keys
- [ ] JSON schema created at `jutsu/jutsu-ai-dlc/schemas/settings.schema.json` for editor autocomplete
- [ ] Per-intent override supported via intent.md frontmatter `git:` / `jj:` key
- [ ] Config loading function with precedence: intent → repo → defaults
- [ ] Default values: `change_strategy: unit`, `elaboration_review: true`, `default_branch: auto`

## Notes

- Create `jutsu/jutsu-ai-dlc/lib/config.ts` for TypeScript config loading
- Create `jutsu/jutsu-ai-dlc/lib/config.sh` for shell script config loading (used by dag.sh)
- JSON schema should be referenced in settings.yml via `$schema` comment
- Consider using `yaml` package for parsing (already used elsewhere in han)

## Plan

### Overview

Implement a configuration system for AI-DLC that allows users to configure VCS strategy, supporting both `git` and `jj` (Jujutsu) backends. Configuration follows precedence: defaults < repo-level settings < intent-level overrides.

### Phase 1: Schema Definition

**Step 1.1: Create JSON Schema**

Create `jutsu/jutsu-ai-dlc/schemas/settings.schema.json` with:
- `git:` and `jj:` top-level keys
- Each containing: `change_strategy`, `elaboration_review`, `default_branch`
- Proper defaults and enums

**Step 1.2: Define TypeScript Interfaces**

```typescript
interface VcsConfig {
  change_strategy: 'trunk' | 'unit' | 'bolt' | 'intent';
  elaboration_review: boolean;
  default_branch: string;
  auto_merge?: boolean;      // git-specific
  auto_squash?: boolean;     // jj-specific
}

interface AiDlcSettings {
  git?: Partial<VcsConfig>;
  jj?: Partial<VcsConfig>;
}
```

### Phase 2: TypeScript Configuration Loader

Create `jutsu/jutsu-ai-dlc/lib/config.ts`:

- `DEFAULT_CONFIG` - Hardcoded defaults
- `loadRepoSettings(repoRoot)` - Load `.ai-dlc/settings.yml`
- `loadIntentOverrides(intentFile)` - Extract `git:`/`jj:` from frontmatter
- `getMergedSettings(repoRoot, intentFile?)` - Apply precedence
- `detectVcs(repoRoot)` - Check for `.jj` vs `.git`
- `getVcsConfig(settings, vcs)` - Get config for detected VCS

### Phase 3: Shell Configuration Loader

Create `jutsu/jutsu-ai-dlc/lib/config.sh`:

- `detect_vcs()` - Returns "git" or "jj"
- `get_ai_dlc_config <key> <vcs> [repo_root] [intent_file]` - Get single value with precedence
- `resolve_default_branch <vcs> [repo_root] [intent_file]` - Resolve "auto" to actual branch

Uses `han parse yaml` for YAML parsing (existing command).

### Phase 4: Example Settings File

Create `jutsu/jutsu-ai-dlc/examples/settings.yml` as documentation/template.

### Phase 5: Integration

- Update `dag.sh` to source `config.sh`
- Update `inject-context.sh` to use config functions

### Files to Create

1. `jutsu/jutsu-ai-dlc/schemas/settings.schema.json`
2. `jutsu/jutsu-ai-dlc/lib/config.ts`
3. `jutsu/jutsu-ai-dlc/lib/config.sh`
4. `jutsu/jutsu-ai-dlc/examples/settings.yml`

### Files to Modify

1. `jutsu/jutsu-ai-dlc/lib/dag.sh` - Source config.sh
2. `jutsu/jutsu-ai-dlc/hooks/inject-context.sh` - Use config functions

### Critical Files for Reference

- `packages/han/lib/config/han-settings.ts` - Pattern for TS config loading
- `packages/han/schemas/han-config-override.schema.json` - Schema pattern
- `jutsu/jutsu-ai-dlc/lib/dag.sh` - Shell library to integrate with
