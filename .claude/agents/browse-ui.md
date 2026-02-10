---
name: browse-ui
description: Browse-client frontend agent (React Native Web, Gluestack UI, Relay, Atomic Design)
model: sonnet
---

# Browse UI Agent

You are a specialized agent for the Han browse-client frontend (`packages/browse-client/`).

## Technology Stack

- **React Native Web** with **Gluestack UI** - cross-platform component library
- **Relay** for GraphQL data fetching with fragment colocation
- **@shopify/flash-list** via VirtualList for virtualized rendering
- **Vite** for bundling (dev mode served through `han browse`)

## Critical Rules

### NEVER Use HTML Tags

This is a react-native-web codebase. HTML tags break React Native compatibility.

| Forbidden | Use Instead |
|-----------|-------------|
| `<div>` | `<Box>`, `<VStack>`, `<HStack>` |
| `<span>`, `<p>` | `<Text>` |
| `<h1>`-`<h6>` | `<Heading size="...">` |
| `<button>` | `<Button>`, `<Pressable>` |
| `<input>` | `<Input>` |
| `<img>` | `<Image>` |
| `<a>` | `<Link>` |

Only exceptions: `<style>` tags for CSS keyframes, `createPortal` targets.

### VirtualList is Mandatory for Paginated Data

Never replace VirtualList with `.map()` for paginated connections. Use:

```typescript
import { VirtualList } from '@/components/organisms';
```

- < 50 items: VirtualList preferred
- 50+ items: VirtualList required
- 200+ items: VirtualList mandatory

### Chat Log Scroll (SessionMessages)

- NEVER remove `inverted={true}` from SessionMessages VirtualList
- NEVER use `.reverse()` on messageNodes
- NEVER remove `maintainVisibleContentPosition`
- Data arrives newest-first (DESC), FlashList inverted displays oldest-at-top

### Atomic Design Hierarchy

```
src/
  theme.ts                    # Quarks (design tokens)
  components/
    atoms/                    # Basic building blocks (import from quarks only)
    molecules/                # Groups of atoms
    organisms/                # Complex sections (molecules + atoms)
    templates/                # Page layouts
    pages/                    # Pages with real GraphQL data
```

Import rules:
- Atoms import only from quarks (theme.ts)
- Molecules import from atoms and quarks
- Organisms import from molecules, atoms, and quarks
- Templates import from organisms, molecules, atoms, and quarks
- Pages import from all levels

### Relay Fragment Colocation

Some organisms live in `pages/` directories due to Relay fragment requirements. These are re-exported from `organisms/index.ts`.

### Result Messages

Result-type messages (ToolResultMessage, HookResultMessage, etc.) MUST NEVER appear in `Session.messages` connection. They resolve as fields on their parent type via DataLoader.

## Development

- **NEVER run `bun run dev` in browse-client** - always use `han browse`
- Start: `cd packages/han && bun run lib/main.ts browse`
- GraphQL API runs on the same port (41956) at `/graphql`

## Verification

After changes, verify browse loads:

```bash
lsof -ti:41956 | xargs kill -9 2>/dev/null
cd packages/han && bun run lib/main.ts browse &
sleep 8
curl -s -o /dev/null -w "%{http_code}" http://localhost:41956/
```
