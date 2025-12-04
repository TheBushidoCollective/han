# Website System

Static marketplace site with search, plugin discovery, and documentation rendering.

## Overview

The Han website is a Next.js static site that serves as the primary discovery interface for the plugin marketplace. It provides search functionality, category browsing, and dynamic documentation rendering for all 120+ plugins.

## Architecture

### Technology Stack

- **Framework**: Next.js 16 (App Router, static export)
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4.1
- **Typography**: @tailwindcss/typography
- **Search**: Fuse.js (client-side fuzzy search)
- **Markdown**: react-markdown + remark-gfm
- **Testing**: Playwright
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
│ - Detect skills/commands/agents/hooks  │
│ - Build Fuse.js index                  │
│ - Output: public/search-index.json     │
└────────────────────────────────────────┘
    ↓
Next.js Build (Static Export)
    ↓
GitHub Pages Deployment
```

## Page Routes

### Static Pages

- `/` - Homepage with marketplace overview
- `/plugins` - Plugin directory (all categories)
- `/search` - Search interface
- `/tags` - Tag-based browsing
- `/docs` - General documentation

### Dynamic Routes

```
/plugins/[category]
├── /plugins/bushido
├── /plugins/jutsu
├── /plugins/do
└── /plugins/hashi

/plugins/[category]/[slug]
├── Plugin detail page
└── Nested routes:
    ├── /skills/[skill]      - Skill documentation
    ├── /commands/[command]  - Command documentation
    ├── /agents/[agent]      - Agent documentation
    └── /hooks/[hookfile]    - Hook documentation
```

## API / Interface

### Marketplace Transformation

**Input**: `.claude-plugin/marketplace.json`

```json
{
  "plugins": [
    {
      "name": "jutsu-typescript",
      "source": "./jutsu/jutsu-typescript"
    }
  ]
}
```

**Output**: `public/marketplace.json`

```json
{
  "plugins": [
    {
      "name": "jutsu-typescript",
      "source": "https://github.com/thebushidocollective/han/tree/main/jutsu/jutsu-typescript"
    }
  ]
}
```

**Transform Logic**:

- Local paths (`./*`) → GitHub URLs
- Preserves all metadata (name, description, keywords)
- Maintains structure for frontend consumption

### Search Index Generation

**Detection Logic**:

```typescript
for each plugin:
  skills = glob("skills/*/SKILL.md")
  commands = glob("commands/*.md")
  agents = glob("agents/*.md")
  hooks = glob("hooks/*.md")
```

**Index Structure**:

```json
{
  "plugins": [
    {
      "name": "jutsu-typescript",
      "category": "Technique",
      "description": "...",
      "keywords": ["typescript", "linting"],
      "skills": ["typescript-patterns", "type-safety"],
      "commands": ["typecheck"],
      "agents": [],
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
    { name: 'commands', weight: 0.8 }
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
│   │       ├── commands/[command]/page.tsx
│   │       ├── agents/[agent]/page.tsx
│   │       └── hooks/[hookfile]/page.tsx
├── search/page.tsx            # Search interface
├── tags/page.tsx              # Tag browser
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

Markdown files are rendered using `react-markdown`:

```typescript
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  className="prose dark:prose-invert"
>
  {content}
</ReactMarkdown>
```

Features:

- GitHub Flavored Markdown (tables, task lists, strikethrough)
- Syntax highlighting (via Tailwind Typography)
- Dark mode support
- Responsive typography

### Installation Instructions

Component shows 4 installation methods:

1. **npx** (no installation)

   ```bash
   npx @thebushidocollective/han plugin install jutsu-typescript
   ```

2. **Claude Code** (built-in)

   ```
   /marketplace add han
   /plugin install jutsu-typescript@han
   ```

3. **Claude CLI**

   ```bash
   claude marketplace add han
   claude plugin install jutsu-typescript@han
   ```

4. **Manual** (config edit)

   ```json
   {
     "enabledPlugins": {
       "jutsu-typescript@han": true
     }
   }
   ```

## Deployment

### GitHub Pages

Workflow: `.github/workflows/deploy-website.yml`

```yaml
on:
  push:
    branches: [main]
    paths:
      - "website/**"
      - "jutsu/**"
      - "do/**"
      - "hashi/**"
      - "bushido/**"
```

**Build Steps**:

1. Checkout repository
2. Setup Node.js 20
3. Install dependencies
4. Copy marketplace.json to public/
5. Run pre-build scripts
6. Build Next.js (static export)
7. Add .nojekyll file (bypass Jekyll)
8. Upload artifact
9. Deploy to GitHub Pages

**Environment**:

- Static hosting
- Custom domain: han.guru
- HTTPS enabled
- No server-side rendering

### Testing

Playwright tests validate critical flows:

```typescript
test('plugin search works', async ({ page }) => {
  await page.goto('/search');
  await page.fill('input[type="search"]', 'typescript');
  await expect(page.getByText('jutsu-typescript')).toBeVisible();
});

test('plugin detail page loads', async ({ page }) => {
  await page.goto('/plugins/jutsu/jutsu-typescript');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('typescript');
});
```

## Files

### Build Scripts

- `website/scripts/generate-marketplace.ts` - Marketplace transformation
- `website/scripts/generate-search-index.ts` - Search index generation

### Core Application

- `website/app/layout.tsx` - Root layout
- `website/app/page.tsx` - Homepage
- `website/app/globals.css` - Global styles + Tailwind
- `website/tailwind.config.ts` - Tailwind configuration
- `website/next.config.ts` - Next.js configuration

### Components

- `website/app/components/InstallationTabs.tsx` - Install method selector
- `website/app/components/PluginCard.tsx` - Plugin preview
- `website/app/components/SearchBar.tsx` - Search input
- `website/app/components/Analytics.tsx` - Analytics script
- `website/app/components/Footer.tsx` - Site footer

### Generated Files

- `website/public/marketplace.json` - Web-formatted marketplace
- `website/public/search-index.json` - Fuse.js search index

### Testing

- `website/playwright.config.ts` - Playwright configuration
- `website/tests/*.spec.ts` - E2E test suites

## Related Systems

- [Marketplace System](./marketplace.md) - Source of plugin data
- [Plugin Directory](./plugin-directory.md) - Files indexed for search
- [Build & Deployment](./build-deployment.md) - Deployment workflow
