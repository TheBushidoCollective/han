---
status: pending
depends_on: [unit-03-change-strategies]
branch: ai-dlc/vcs-strategy-config/07-integrator-hat
discipline: backend
---

# unit-07-integrator-hat

## Description

Implement the integrator hat that runs conditionally based on VCS strategy. For `trunk` and `intent` strategies, integrator provides final validation or creates the single merge.

## Discipline

backend - This unit modifies workflow orchestration and adds a new hat to the workflow system.

## Success Criteria

- [ ] Integrator hat defined in `workflows.yml` with clear triggers
- [ ] For `trunk` strategy: integrator validates auto-merged state on main
- [ ] For `intent` strategy: integrator creates single PR and merges on approval
- [ ] For `unit`/`bolt` strategies: integrator hat is skipped (no-op)
- [ ] Integrator runs Stop hooks to validate final state
- [ ] Integrator marks intent as complete if all validations pass
- [ ] If validation fails, integrator documents issues and blocks completion

## Notes

- Integrator is NOT a separate PR/MR - it's a validation step
- For `trunk`: runs on main after all auto-merges complete
- For `intent`: creates the PR, runs validation on the branch, merges if approved
- Integrator uses the same Stop hooks infrastructure as builder/reviewer
- Consider: should integrator have access to all unit context for holistic validation?
