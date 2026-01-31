---
status: pending
depends_on: [unit-01-config-system]
branch: ai-dlc/vcs-strategy-config/03-change-strategies
discipline: backend
---

# unit-03-change-strategies

## Description

Implement the four change strategies (trunk, bolt, unit, intent) with their respective branching and MR behaviors.

## Discipline

backend - This unit involves modifying the construct.md workflow and related shell utilities.

## Success Criteria

- [ ] `trunk` strategy: creates ephemeral branch, auto-merges to default after each unit
- [ ] `bolt` strategy: creates branch per bolt, MR per bolt
- [ ] `unit` strategy: creates branch per unit, MR per unit (default behavior)
- [ ] `intent` strategy: single branch for entire intent, one MR at completion
- [ ] Strategy-specific branch naming: `ai-dlc/{intent}/{unit}` or `ai-dlc/{intent}/{unit}/{bolt}`
- [ ] MR creation uses `gh pr create` (git) or equivalent (jj)

## Notes

- Modify `jutsu/jutsu-ai-dlc/skills/construct.md` to read strategy from config
- Add strategy-specific logic to worktree creation in construct workflow
- For `trunk`, implement auto-merge after validation passes
- For `bolt`, need to track bolt number within unit iteration
- Consider: should `trunk` still use worktrees? (Yes, for isolation, but merge immediately)
