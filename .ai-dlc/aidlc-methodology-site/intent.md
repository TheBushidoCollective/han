---
workflow: default
created: 2026-02-02
status: active
---

# AI-DLC Methodology Site Enhancement

## Problem

The current ai-dlc.dev website has basic documentation but lacks the comprehensive, interactive experience that established methodologies like SAFe and LEAN provide. Teams need:
- Visual overviews to quickly grasp the methodology
- Interactive tools to guide decision-making
- Clear adoption paths and resources
- The full methodology paper integrated with interactive elements

## Solution

Transform ai-dlc.dev into a comprehensive methodology platform with:
1. **Big Picture Diagram** - Clickable overview showing all AI-DLC concepts
2. **Interactive Tools** - Mode selector, workflow visualizer
3. **Adoption Resources** - Roadmap, role guides, templates
4. **Full Paper Integration** - Complete AI-DLC 2026 paper with linked sections

## Success Criteria

### Interactive Features
- [ ] Big Picture diagram showing AI-DLC methodology overview (clickable, like SAFe)
- [ ] Interactive mode selector (HITL → OHOTL → AHOTL decision tree)
- [ ] Workflow visualizer with animated hat transitions for all 4 workflows
- [ ] All interactive elements work on mobile and desktop

### Adoption Resources
- [ ] Implementation roadmap page with phased adoption guide
- [ ] Role guides explaining what each team member needs to know
- [ ] Downloadable templates (intent.md, unit.md, settings.yaml)
- [ ] Checklists for getting started

### Paper Integration
- [ ] Full AI-DLC 2026 paper rendered as primary methodology reference
- [ ] Paper sections linked from interactive diagrams
- [ ] Glossary with all methodology terms

### Site Structure
- [ ] Clear navigation mirroring SAFe/LEAN patterns
- [ ] Landing page with compelling value proposition
- [ ] "Start Here" onboarding flow for new users

## Context

- Repository: https://github.com/thebushidocollective/ai-dlc
- Existing site has docs, blog, basic content from previous work
- Reference: SAFe (scaledagileframework.com), LEAN (lean.org)
- Tech stack: Next.js with static export, Tailwind CSS
