---
status: pending
depends_on: [unit-01-config-system, unit-02-vcs-detection]
branch: ai-dlc/vcs-strategy-config/05-worktree-management
discipline: backend
---

# unit-05-worktree-management

## Description

Implement worktree discovery, resume functionality, and cleanup commands for managing AI-DLC worktrees.

## Discipline

backend - This unit involves CLI commands and worktree management utilities.

## Success Criteria

- [ ] `/construct` discovers active worktrees for current intent when called from default branch
- [ ] Resume prompt shown when existing worktrees found with options: resume, start fresh, list
- [ ] `han worktree list` command shows all AI-DLC worktrees with status
- [ ] `han worktree prune` command removes orphaned worktrees (no matching branch or stale)
- [ ] Worktree discovery works for both git (`git worktree list`) and jj (`jj workspace list`)
- [ ] Stale worktree detection: worktree exists but unit status is `completed`

## Notes

- Add `packages/han/lib/commands/worktree/` with `list.ts` and `prune.ts`
- Register commands in `packages/han/lib/main.ts`
- Modify `jutsu/jutsu-ai-dlc/skills/construct.md` to call discovery before spawning
- Parse `git worktree list --porcelain` for structured output
- Consider: should prune require confirmation? (Yes, with `--force` to skip)
