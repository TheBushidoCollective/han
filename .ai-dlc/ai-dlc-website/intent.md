---
workflow: default
created: 2026-02-02
status: active
---

# AI-DLC Website and External Plugin

## Problem

The AI-DLC methodology and plugin currently live inside the Han repository at `patterns/ai-dlc`. This limits discoverability and makes it harder to:
- Market AI-DLC as a standalone methodology
- Allow users to adopt AI-DLC without understanding the full Han ecosystem
- Build a community around the methodology
- Publish tutorials and learning content

## Solution

Create a dedicated monorepo (`github.com/thebushidocollective/ai-dlc`) containing:
1. **Plugin**: Migrated from `patterns/ai-dlc`, declaring Han as a dependency
2. **Website**: Next.js static site with full learning content, deployed to GitHub Pages

The website will serve as the primary landing for AI-DLC, hosting:
- The AI-DLC 2026 methodology paper
- Plugin installation and usage documentation
- Tutorials explaining the methodology step-by-step
- Real-world examples
- Blog for ongoing content
- Community links

## Success Criteria

### Repository & Infrastructure
- [ ] New monorepo `ai-dlc` created with `/website` and `/plugin` directories
- [ ] GitHub Pages workflow deploys website on push to main
- [ ] Custom domains configured (theaidlc.com, ai-dlc.dev if available)

### Plugin Migration
- [ ] Plugin moved from `han/patterns/ai-dlc` to `ai-dlc/plugin`
- [ ] Plugin declares Han as a dependency in `plugin.json`
- [ ] Plugin installable via `han plugin install thebushidocollective/ai-dlc`
- [ ] All existing skills and commands work after migration

### Website - Core
- [ ] Next.js site with static export builds successfully
- [ ] AI-DLC 2026 paper rendered as primary content
- [ ] Plugin installation guide with copy-paste commands
- [ ] Responsive design (mobile, tablet, desktop)

### Website - Learning Content
- [ ] Tutorials section explaining methodology step-by-step
- [ ] Examples showing real-world AI-DLC usage
- [ ] Blog infrastructure for ongoing content
- [ ] Community links (Discord/GitHub Discussions)

### SEO & Discoverability
- [ ] RSS/Atom/JSON feeds for blog
- [ ] Sitemap.xml generated
- [ ] robots.txt allows AI crawlers
- [ ] OpenGraph and Twitter meta tags

## Context

- Tech stack: Next.js with static export
- Hosting: GitHub Pages
- Domains: theaidlc.com (primary), ai-dlc.dev (if available)
- Plugin dependency: Requires Han core
- Content source: Existing paper at `website/content/papers/ai-dlc-2026.md`
