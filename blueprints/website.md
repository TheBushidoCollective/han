---
name: website
summary: Static marketplace site with search and documentation
---

# Website System

Static marketplace site with search, plugin discovery, and documentation rendering.

## Overview

The Han website is a Next.js static site that serves as the primary discovery interface for the plugin marketplace. It provides search functionality, category browsing, and dynamic documentation rendering for all plugins.

## Architecture

### Technology Stack

- **Framework**: Next.js 16 (App Router, static export)
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4.1
- **Typography**: @tailwindcss/typography
- **Search**: Fuse.js 7.1 (client-side fuzzy search)
- **Markdown**: react-markdown 10.1 + remark-gfm 4.0
- **Syntax Highlighting**: rehype-highlight 7.0 (highlight.js 11.11)
- **Testing**: Playwright 1.56
- **Build Tool**: Bun
- **Analytics**: counter.dev (privacy-friendly)

### Build Pipeline

```
Pre-build Scripts
    ↓
┌────────────────────────────────────────┐
│ generate-marketplace.ts                │
│ - Transform marketplace.json           │
│ - Convert local paths to GitHub URLs   │
│ - Output: public/marketplace.json      │
└────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────┐
│ generate-search-index.ts               │
│ - Scan plugin directories              │
│ - Detect skills/hooks/agents           │
│ - Build Fuse.js index                  │
│ - Output: public/search-index.json     │
└────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────┐
│ generate-rss.ts                        │
│ - Build RSS/Atom/JSON feeds            │
│ - Output: public/{feed.xml,atom.xml}   │
└────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────┐
│ generate-sitemap.ts                    │
│ - Build XML sitemap                    │
│ - Output: public/sitemap.xml           │
└────────────────────────────────────────┘
    ↓
┌────────────────────────────────────────┐
│ generate-paper-revisions.ts            │
│ - Track paper version history          │
│ - Generate revision metadata           │
└────────────────────────────────────────┘
    ↓
Next.js Build (Static Export)
    ↓
Railway Deployment (dashboard.han.guru)
```

## Page Routes

### Static Pages

- `/` - Homepage with marketplace overview
- `/plugins` - Plugin directory (all categories)
- `/search` - Search interface
- `/tags` - Tag-based browsing
- `/docs` - General documentation
- `/insights` - Blog posts and articles
- `/papers` - Research papers (AI-DLC 2026, etc.)

### Dynamic Routes

```
/plugins/[category]
├── /plugins/core
├── /plugins/languages
├── /plugins/validation
├── /plugins/services
├── /plugins/tools
├── /plugins/frameworks
└── /plugins/disciplines

/plugins/[category]/[slug]
├── Plugin detail page
└── Nested routes:
    ├── /skills/[skill]      - Skill documentation
    └── /hooks/[hookfile]    - Hook documentation
```

## API / Interface

### Marketplace Transformation

**Input**: `.claude-plugin/marketplace.json`

```json
{
  "plugins": [
    {
      "name": "typescript",
      "source": "./plugins/languages/typescript"
    }
  ]
}
```

**Output**: `public/marketplace.json`

```json
{
  "plugins": [
    {
      "name": "typescript",
      "source": "https://github.com/thebushidocollective/han/tree/main/plugins/languages/typescript"
    }
  ]
}
```

**Transform Logic**:

- Local paths (`./plugins/*`) → GitHub URLs
- Preserves all metadata (name, description, keywords)
- Maintains structure for frontend consumption

### Search Index Generation

**Detection Logic**:

```typescript
for each plugin:
  skills = glob("skills/*/SKILL.md")
  hooks = glob("hooks/hooks.json")
  agents = glob("agents/*.md")
```

**Index Structure**:

```json
{
  "plugins": [
    {
      "name": "typescript",
      "category": "languages",
      "description": "...",
      "keywords": ["typescript", "linting"],
      "skills": ["typescript-patterns", "type-safety"],
      "hooks": ["lint", "typecheck"]
    }
  ]
}
```

**Fuse.js Configuration**:

```typescript
const fuse = new Fuse(index.plugins, {
  keys: [
    { name: 'name', weight: 2 },
    { name: 'description', weight: 1.5 },
    { name: 'keywords', weight: 1 },
    { name: 'skills', weight: 0.8 },
  ],
  threshold: 0.3,  // Fuzzy matching tolerance
  includeScore: true
});
```

### Component Architecture

```
app/
├── layout.tsx                  # Root layout with Analytics
├── page.tsx                    # Homepage
├── plugins/
│   ├── page.tsx               # Plugin directory
│   ├── [category]/
│   │   ├── page.tsx           # Category view
│   │   └── [slug]/
│   │       ├── page.tsx       # Plugin detail
│   │       ├── skills/[skill]/page.tsx
│   │       └── hooks/[hookfile]/page.tsx
├── search/page.tsx            # Search interface
├── tags/page.tsx              # Tag browser
├── insights/page.tsx          # Blog listing
├── papers/page.tsx            # Papers listing
└── components/
    ├── InstallationTabs.tsx   # Multi-method install UI
    ├── PluginCard.tsx         # Plugin preview card
    ├── SearchBar.tsx          # Search input
    ├── Analytics.tsx          # counter.dev script
    └── Footer.tsx             # Site footer
```

## Behavior

### Static Generation

All pages are pre-rendered at build time:

```typescript
// Dynamic route generation
export async function generateStaticParams() {
  const marketplace = await getMarketplace();
  return marketplace.plugins.map(plugin => ({
    category: plugin.category.toLowerCase(),
    slug: plugin.name
  }));
}
```

### Search Functionality

1. **Client-Side Search**: Fuse.js runs in browser
2. **Index Loading**: Fetched once on search page mount
3. **Real-Time Results**: Updates as user types
4. **Fuzzy Matching**: Handles typos and partial matches
5. **Weighted Scoring**: Prioritizes name/description over keywords

### Documentation Rendering

Markdown files are rendered using `react-markdown` + `next-mdx-remote`:

```typescript
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  rehypePlugins={[rehypeHighlight, rehypeSlug]}
  className="prose dark:prose-invert"
>
  {content}
</ReactMarkdown>
```

Features:

- GitHub Flavored Markdown (tables, task lists, strikethrough)
- Syntax highlighting with highlight.js
- Dark mode support
- Responsive typography
- Heading anchors

### Installation Instructions

Component shows multiple installation methods:

1. **npx** (no installation)

   ```bash
   npx @thebushidocollective/han plugin install typescript
   ```

2. **Claude Code** (built-in)

   ```
   /marketplace add han
   /plugin install typescript@han
   ```

3. **Manual** (config edit)

   ```json
   {
     "enabledPlugins": {
       "typescript@han": true
     }
   }
   ```

## Deployment

### Railway

Service: `han-dashboard`
URL: https://dashboard.han.guru

**Build Configuration**:

- Root directory: `/website`
- Build command: `bun run build`
- Start command: `bun run start`
- Dockerfile: Multi-stage with `oven/bun:1` base image

**Environment**:

- Static hosting via `serve` on port 3000
- HTTPS enabled
- Auto-deploys on main branch changes

### Testing

Playwright tests validate critical flows:

```typescript
test('plugin search works', async ({ page }) => {
  await page.goto('/search');
  await page.fill('input[type="search"]', 'typescript');
  await expect(page.getByText('typescript')).toBeVisible();
});

test('plugin detail page loads', async ({ page }) => {
  await page.goto('/plugins/languages/typescript');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('typescript');
});
```

**Test Commands**:

- `bun run test:e2e` - End-to-end Playwright tests
- `bun run test:bdd` - BDD-style Cucumber tests
- `bun run test:all` - Run all test suites

## Files

### Build Scripts

- `website/scripts/generate-marketplace.ts` - Marketplace transformation
- `website/scripts/generate-search-index.ts` - Search index generation
- `website/scripts/generate-rss.ts` - RSS/Atom/JSON feeds
- `website/scripts/generate-sitemap.ts` - XML sitemap
- `website/scripts/generate-paper-revisions.ts` - Paper version tracking

### Core Application

- `website/app/layout.tsx` - Root layout
- `website/app/page.tsx` - Homepage
- `website/app/globals.css` - Global styles + Tailwind
- `website/tailwind.config.ts` - Tailwind configuration
- `website/next.config.ts` - Next.js configuration
- `website/package.json` - Dependencies and scripts

### Components

- `website/app/components/InstallationTabs.tsx` - Install method selector
- `website/app/components/PluginCard.tsx` - Plugin preview
- `website/app/components/SearchBar.tsx` - Search input
- `website/app/components/Analytics.tsx` - Analytics script
- `website/app/components/Footer.tsx` - Site footer

### Generated Files

- `website/public/marketplace.json` - Web-formatted marketplace
- `website/public/search-index.json` - Fuse.js search index
- `website/public/feed.xml` - RSS 2.0 feed
- `website/public/atom.xml` - Atom 1.0 feed
- `website/public/feed.json` - JSON Feed
- `website/public/sitemap.xml` - XML sitemap

### Testing

- `website/playwright.config.ts` - Playwright configuration
- `website/playwright.bdd.config.ts` - BDD test configuration
- `website/tests/*.spec.ts` - E2E test suites

## Related Systems

- [Marketplace System](./marketplace.md) - Source of plugin data
- [Plugin Directory](./plugin-directory.md) - Files indexed for search
- [Build & Deployment](./build-deployment.md) - Deployment workflow