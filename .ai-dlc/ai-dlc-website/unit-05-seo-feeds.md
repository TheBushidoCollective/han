---
status: pending
depends_on: [03-website-foundation]
branch: ai-dlc/ai-dlc-website/05-seo-feeds
discipline: frontend
---

# unit-05-seo-feeds

## Description

Implement SEO best practices, RSS feeds, sitemap, and AI crawler accessibility.

## Discipline

frontend - This unit handles web infrastructure and discoverability.

## Success Criteria

- [ ] RSS feed at `/feed.xml`
- [ ] Atom feed at `/atom.xml`
- [ ] JSON feed at `/feed.json`
- [ ] Sitemap at `/sitemap.xml` (auto-generated)
- [ ] `robots.txt` allowing AI crawlers (GPTBot, ClaudeBot, etc.)
- [ ] OpenGraph meta tags on all pages
- [ ] Twitter card meta tags
- [ ] Canonical URLs configured
- [ ] Structured data (JSON-LD) for:
  - Organization
  - Article (for blog posts)
  - SoftwareApplication (for the plugin)

## Notes

- Follow patterns from han.guru website (see `.claude/rules/feeds-and-seo.md`)
- Use Next.js route handlers for feed generation
- Include blog posts in all feeds
- Test with social media debuggers (Facebook, Twitter, LinkedIn)
