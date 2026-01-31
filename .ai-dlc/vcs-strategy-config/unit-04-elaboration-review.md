---
status: pending
depends_on: [unit-01-config-system, unit-02-vcs-detection]
branch: ai-dlc/vcs-strategy-config/04-elaboration-review
discipline: backend
---

# unit-04-elaboration-review

## Description

Implement elaboration-as-MR workflow where the plan is reviewed before construction begins.

## Discipline

backend - This unit modifies the elaborate.md skill and adds MR creation logic.

## Success Criteria

- [ ] When `elaboration_review: true`, elaboration creates branch `ai-dlc/{intent}/plan`
- [ ] Elaboration commits `.ai-dlc/{intent}/` artifacts to plan branch
- [ ] MR created with title "Plan: {intent title}"
- [ ] MR body includes intent summary, unit list, and DAG visualization
- [ ] DAG visualization generated as ASCII or Mermaid diagram
- [ ] `/construct` checks if elaboration MR is merged before proceeding
- [ ] When `elaboration_review: false`, elaboration commits directly to default branch

## Notes

- Modify `jutsu/jutsu-ai-dlc/skills/elaborate.md` Phase 6 to handle branching
- Add `generateDagVisualization()` function to create Mermaid diagram from units
- Use `gh pr create` for MR creation
- Add check in construct.md to verify plan branch is merged
- Store plan branch state in han keep for resumability
