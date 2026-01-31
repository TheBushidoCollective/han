---
workflow: default
created: 2026-01-30
---

# AI-DLC VCS Strategy Configuration

## Problem

The AI-DLC workflow currently has implicit assumptions about branching and merging:
- Assumes `main` as the default branch
- No configurable MR/PR strategy (bolt vs unit vs intent granularity)
- Elaboration commits directly without review option
- No support for trunk-based development
- Git-only (no jj/Jujutsu support)
- No discovery of active worktrees when resuming work
- Orphaned worktrees accumulate without cleanup

Teams have different workflows (feature branching, trunk-based, etc.) and need AI-DLC to adapt.

## Solution

Add configurable VCS strategy with repo-level defaults and per-intent overrides:

### Configuration Schema

```yaml
# .ai-dlc/settings.yml

git:
  default_branch: auto           # Detect or specify: main, master, trunk
  change_strategy: unit          # trunk | bolt | unit | intent
  elaboration_review: true       # MR for plan before construction
  auto_merge: false              # Merge without review if CI passes

jj:
  default_branch: auto
  change_strategy: unit
  elaboration_review: true
  auto_squash: true              # jj-specific: squash on merge
```

### Strategy Behaviors

| Strategy | Branches | MRs | Use Case |
|----------|----------|-----|----------|
| `trunk` | Ephemeral per unit | Auto-merge, no review | Mature CI/CD teams |
| `bolt` | Per bolt | Per bolt | Maximum review granularity |
| `unit` | Per unit | Per unit | Balanced (default) |
| `intent` | One for entire intent | Single MR at end | Feature branch model |

### Elaboration as MR

When `elaboration_review: true`:
1. Elaboration creates branch `ai-dlc/{intent}/plan`
2. Commits `.ai-dlc/{intent}/` artifacts
3. Creates MR with DAG visualization
4. Construction blocked until MR merged

### Worktree Discovery

When `/construct` called from default branch:
1. Scan `.ai-dlc/` for active intents
2. Check `git worktree list` / `jj workspace list` for existing work
3. Offer to resume or start fresh units

## Success Criteria

### Configuration System
- [ ] `.ai-dlc/settings.yml` schema defined and documented
- [ ] JSON schema for editor autocomplete/validation
- [ ] Per-intent override via intent.md frontmatter `git:` / `jj:` key
- [ ] Config loading with precedence: intent → repo → defaults

### VCS Detection
- [ ] Auto-detect VCS type (git vs jj)
- [ ] Auto-detect default branch (not assume main)
- [ ] Support explicit configuration override

### Change Strategies
- [ ] `trunk` strategy: ephemeral branches, auto-merge to default
- [ ] `bolt` strategy: branch + MR per bolt
- [ ] `unit` strategy: branch + MR per unit (default)
- [ ] `intent` strategy: single branch + MR for entire intent

### Elaboration Review
- [ ] When enabled, elaboration creates `ai-dlc/{intent}/plan` branch
- [ ] MR created with intent summary and DAG visualization
- [ ] `/construct` blocked until elaboration MR merged
- [ ] DAG visualization auto-generated in MR description

### Worktree Management
- [ ] `/construct` discovers active worktrees for intent
- [ ] Resume prompt when existing worktrees found
- [ ] `han worktree list` shows AI-DLC worktrees
- [ ] `han worktree prune` cleans orphaned worktrees

### jj (Jujutsu) Support
- [ ] Detect jj repo via `.jj` directory
- [ ] `jj workspace add` for parallel unit execution
- [ ] `jj workspace list` for discovery
- [ ] jj-specific config options (auto_squash, etc.)

### Strategy Injection
- [ ] PreToolUse hook reads VCS config
- [ ] Strategy-specific instructions injected into subagent prompts
- [ ] Subagents know when to create MRs vs auto-merge

## Context

### Existing Code Locations
- `jutsu/jutsu-ai-dlc/skills/construct.md` - Construction workflow
- `jutsu/jutsu-ai-dlc/skills/elaborate.md` - Elaboration workflow
- `jutsu/jutsu-ai-dlc/hooks/subagent-context.ts` - PreToolUse injection
- `jutsu/jutsu-ai-dlc/lib/dag.sh` - DAG utilities

### Design Decisions from Discussion

1. **Worktrees always** - Every intent uses worktrees for isolation, regardless of strategy
2. **Branches vary by strategy** - trunk uses ephemeral branches, others persist
3. **Elaboration is reviewable** - Plan can be MR'd before code, catching bad decomposition early
4. **Repo defaults, intent overrides** - One config for team, override when needed
5. **Both VCS supported** - git and jj are first-class citizens

### Defaults
- `change_strategy`: `unit`
- `elaboration_review`: `true`
- `default_branch`: `auto` (detect)
