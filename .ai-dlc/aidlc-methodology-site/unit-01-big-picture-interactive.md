---
status: pending
depends_on: []
branch: ai-dlc/aidlc-methodology-site/01-big-picture-interactive
discipline: frontend
---

# unit-01-big-picture-interactive

## Description

Create an interactive "Big Picture" diagram for AI-DLC methodology, similar to SAFe's main diagram. This serves as the visual anchor for the entire methodology site.

## Discipline

frontend - Interactive React components with animations.

## Success Criteria

- [ ] SVG-based or Canvas diagram showing AI-DLC methodology overview
- [ ] Clickable regions for: Intents, Units, Bolts, Hats, Operating Modes
- [ ] Hover states showing brief descriptions
- [ ] Click navigates to detailed documentation
- [ ] Responsive design (desktop, tablet, mobile views)
- [ ] Smooth animations on interactions
- [ ] Accessible (keyboard navigation, screen reader support)

## Notes

- Reference SAFe Big Picture: https://scaledagileframework.com/
- Consider using React Flow, D3.js, or custom SVG
- Should show the full AI-DLC lifecycle at a glance
- Color-code different concept types (hats, modes, artifacts)
