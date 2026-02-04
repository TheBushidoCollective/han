---
status: pending
depends_on: [01-repo-setup]
branch: ai-dlc/ai-dlc-website/03-website-foundation
discipline: frontend
---

# unit-03-website-foundation

## Description

Set up the Next.js website with static export, responsive layout, and core pages.

## Discipline

frontend - This unit will be executed by `do-frontend-development` specialized agents.

## Success Criteria

- [ ] Next.js 14+ project initialized in `/website`
- [ ] Static export configured (`output: 'export'` in next.config.js)
- [ ] Responsive layout with header, footer, navigation
- [ ] Homepage with hero section and value proposition
- [ ] About page explaining the methodology at a high level
- [ ] Docs layout for documentation pages
- [ ] Blog layout for blog posts
- [ ] Dark mode support
- [ ] `npm run build` produces working static site
- [ ] Site deploys successfully to GitHub Pages

## Notes

- Use Tailwind CSS for styling (consistent with han.guru)
- Consider using next-mdx-remote for MDX content
- Homepage should immediately convey what AI-DLC is
- Navigation: Home, Docs, Tutorials, Examples, Blog, Community
- Footer: Links to GitHub, Han, Anthropic
