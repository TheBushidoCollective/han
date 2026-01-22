# RSS Feeds and AI Accessibility

## Feed Formats Available

All sites should provide multiple feed formats for maximum compatibility:

- **RSS 2.0**: `/feed.xml` - Most widely supported
- **Atom 1.0**: `/atom.xml` - Modern alternative to RSS
- **JSON Feed**: `/feed.json` - Developer-friendly format

## Implementation Pattern

Use Next.js App Router route handlers for feeds:

```typescript
// app/feed.xml/route.ts or app/atom.xml/route.ts
export const dynamic = "force-static"
export const revalidate = false

export async function GET() {
  const content = await getAllContent("insights")
  // Generate feed XML/JSON
  return new Response(feed, {
    headers: {
      "Content-Type": "application/xml", // or application/json
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  })
}
```

## Sitemap Generation

Include all content types and static pages:

- Static pages (home, about, contact, etc.)
- Blog posts / insights
- Dynamic content (services, team, etc.)
- Set appropriate priority and changefreq values

## Metadata Discovery Links

Add to default metadata in `lib/seo/metadata.ts`:

```typescript
alternates: {
  types: {
    "application/rss+xml": "/feed.xml",
    "application/atom+xml": "/atom.xml",
    "application/json": "/feed.json",
  },
}
```

## robots.txt for AI Agents

Explicitly allow all major AI crawlers:

- GPTBot, ChatGPT-User (OpenAI)
- ClaudeBot, Claude-Web, anthropic-ai (Anthropic)
- Google-Extended, CCBot, PerplexityBot, cohere-ai, Applebot-Extended

Include sitemap reference and feed URLs in comments.
