---
status: pending
depends_on: [unit-01-config-system, unit-02-vcs-detection]
branch: ai-dlc/vcs-strategy-config/06-jj-support
discipline: backend
---

# unit-06-jj-support

## Description

Implement full Jujutsu (jj) support including workspace management, branch equivalents, and jj-specific configuration options.

## Discipline

backend - This unit involves jj CLI integration and workspace management.

## Success Criteria

- [ ] Detect jj repo via `.jj` directory (prefer over git if colocated)
- [ ] `jj workspace add` used for parallel unit execution instead of `git worktree`
- [ ] `jj workspace list` used for discovery
- [ ] jj-specific config: `auto_squash` option for squashing on merge
- [ ] Branch equivalent: jj bookmarks or change descriptions for tracking
- [ ] MR creation works with jj (via git interop or native if supported)

## Notes

- Create `jutsu/jutsu-ai-dlc/lib/jj.ts` for jj-specific utilities
- Create `jutsu/jutsu-ai-dlc/lib/jj.sh` for shell script usage
- jj uses "workspaces" not "worktrees" - same concept, different command
- jj auto-stages everything - this is a feature for AI workflows
- For MR creation, likely need to use git interop (`jj git push`) then `gh pr create`
- Handle caveat: jj workspaces in colocated repos become pure jj (not colocated)
- Consider: should we warn users about colocation workspace behavior?
