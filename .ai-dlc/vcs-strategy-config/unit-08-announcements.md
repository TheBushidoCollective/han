---
status: pending
depends_on: [unit-07-integrator-hat]
branch: ai-dlc/vcs-strategy-config/08-announcements
discipline: backend
---

# unit-08-announcements

## Description

Implement announcement generation on intent completion. During elaboration, ask what formats are needed. On completion, generate those formats for marketing/communication.

## Discipline

backend - This unit modifies the elaboration skill and adds announcement generation.

## Success Criteria

- [ ] During elaboration, `AskUserQuestion` asks about announcement formats
- [ ] Announcement config stored in intent.md frontmatter: `announcements: [changelog, release-notes]`
- [ ] On intent completion, generate configured announcement formats
- [ ] CHANGELOG format: conventional changelog entry
- [ ] Release notes format: user-facing summary of changes
- [ ] Social posts format: short-form posts for Twitter/LinkedIn
- [ ] Blog draft format: long-form announcement suitable for company blog
- [ ] Announcements written to `.ai-dlc/{intent}/announcements/` directory

## Notes

- Announcement generation happens after integrator marks intent complete
- Use LLM to summarize intent, units, and changes into each format
- Consider: should announcements be reviewed before publishing?
- CHANGELOG should follow Keep a Changelog format
- Social posts should be platform-appropriate length
- Blog draft should include: problem, solution, key features, what's next
