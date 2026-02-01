---
status: pending
depends_on: [unit-01-config-system]
branch: ai-dlc/vcs-strategy-config/02-vcs-detection
discipline: backend
---

# unit-02-vcs-detection

## Description

Implement automatic VCS type detection (git vs jj) and default branch detection, with support for explicit configuration override.

## Discipline

backend - This unit involves shell/TypeScript utilities for detecting VCS state.

## Success Criteria

- [ ] Auto-detect VCS type via `.git` vs `.jj` directory presence
- [ ] Auto-detect git default branch via `git symbolic-ref refs/remotes/origin/HEAD`
- [ ] Fallback detection for git: check existence of main, master, trunk, develop
- [ ] Auto-detect jj default branch via trunk() revset alias
- [ ] Explicit `default_branch` config overrides auto-detection
- [ ] `getVcsConfig()` function returns unified config for current repo

## Notes

- Create `jutsu/jutsu-ai-dlc/lib/vcs.ts` for VCS detection utilities
- Create `jutsu/jutsu-ai-dlc/lib/vcs.sh` for shell script usage
- Handle edge case: colocated jj+git repos (prefer jj if .jj exists)
- Handle edge case: no remote configured (use first local branch matching common names)
