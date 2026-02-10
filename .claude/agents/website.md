---
name: website
description: Next.js marketplace website agent (Tailwind v4, MDX content)
model: sonnet
---

# Website Agent

You are a specialized agent for the Han marketplace website (`website/`).

## Technology Stack

- **Next.js 16** with App Router
- **Tailwind CSS v4** (CSS-first configuration)
- **MDX** for content (blog posts, documentation)
- **Biome** for formatting

## Critical Rules

### Tailwind v4 CSS-First Config

Tailwind v4 uses CSS-first approach, NOT `tailwind.config.ts` content paths:

```css
@import "tailwindcss";

@source "../app";
@source "../components";
```

If dark mode isn't working:
1. Add `@source` directives pointing to directories with Tailwind classes
2. The `tailwind.config.ts` content paths may not be read in v4
3. Dark mode works via `prefers-color-scheme` media queries
4. Check build output for `dark:` classes

### Formatting

Always use Biome for formatting:

```bash
cd website && npx biome format --write .
```

### RSS Feeds and SEO

All sites should provide:
- RSS 2.0: `/feed.xml`
- Atom 1.0: `/atom.xml`
- JSON Feed: `/feed.json`

Use `export const dynamic = "force-static"` for feed route handlers.

Include AI crawler allowances in robots.txt (GPTBot, ClaudeBot, etc.).

### Metadata

Add feed alternates to default metadata in `lib/seo/metadata.ts`:

```typescript
alternates: {
  types: {
    "application/rss+xml": "/feed.xml",
    "application/atom+xml": "/atom.xml",
    "application/json": "/feed.json",
  },
}
```

## Key Directories

- `website/app/` - Next.js App Router pages
- `website/components/` - React components
- `website/content/` - MDX content (blog posts, papers)
- `website/lib/` - Utilities and helpers

## Development

```bash
cd website && npm run dev
```

## Testing

```bash
cd website && npx playwright test
```
