---
status: pending
depends_on: []
branch: ai-dlc/docs-reorganization/07-blog-posts
discipline: documentation
---

# unit-07-blog-posts

## Description

Update blog posts to use new plugin names and category terminology while maintaining their narrative flow.

## Discipline

documentation - This unit will be executed by `do-technical-documentation` specialized agents.

## Files

- `content/blog/introduction-to-han-plugins.md` - Plugin introduction post
- `content/blog/third-party-plugins.md` - Third-party plugin guide
- `content/blog/ai-dlc-2026-paper.md` - AI-DLC methodology post
- `content/blog/mcp-architecture.md` - MCP architecture post
- `content/blog/checkpoint-system.md` - Checkpoint system post
- `content/blog/han-memory-system.mdx` - Memory system post
- `content/blog/testing-with-confidence.md` - Testing guide post

## Success Criteria

- [ ] All plugin name references updated
- [ ] Category terminology updated throughout
- [ ] Narrative flow preserved (don't break storytelling)
- [ ] Code examples updated
- [ ] No remaining jutsu/do/hashi references

## Notes

Blog posts are different from docs - they tell a story. When updating:
1. Preserve the original narrative and tone
2. Update terminology naturally within sentences
3. Don't just find-replace - ensure sentences still read well
4. Update code examples and commands

Example transformation:
- "Install the jutsu-typescript plugin" → "Install the typescript plugin"
- "Hashi plugins connect to external services" → "Service plugins connect to external APIs"
