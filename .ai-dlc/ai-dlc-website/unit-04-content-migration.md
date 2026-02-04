---
status: pending
depends_on: [03-website-foundation]
branch: ai-dlc/ai-dlc-website/04-content-migration
discipline: documentation
---

# unit-04-content-migration

## Description

Migrate and expand the AI-DLC 2026 paper into full website content, including tutorials and examples.

## Discipline

documentation - This unit will be executed by `do-technical-documentation` agents.

## Success Criteria

- [ ] AI-DLC 2026 paper migrated from `website/content/papers/ai-dlc-2026.md`
- [ ] Paper split into digestible documentation sections:
  - Core concepts
  - Workflows (default, TDD, hypothesis, adversarial)
  - Hats (elaborator, planner, builder, reviewer, etc.)
  - Quality gates and backpressure
- [ ] Installation guide with step-by-step instructions
- [ ] Quick start tutorial (first AI-DLC task in 5 minutes)
- [ ] At least 2 real-world examples:
  - Simple feature implementation
  - Bug fix with hypothesis workflow
- [ ] Blog post announcing the launch
- [ ] Community page with links to Discord/GitHub Discussions

## Notes

- Content should be beginner-friendly while maintaining technical depth
- Use diagrams where helpful (Mermaid or static images)
- Include code snippets showing actual AI-DLC commands
- Examples should be self-contained and reproducible
