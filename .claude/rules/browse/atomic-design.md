# Browse Client Atomic Design Structure

The browse-client follows Brad Frost's Atomic Design methodology, extended with quarks.

## Directory Structure

```
src/
  theme.ts                    # Quarks (design tokens)
  components/
    atoms/                    # Basic building blocks
    molecules/                # Groups of atoms
    organisms/                # Complex UI sections
    templates/                # Page layouts
    pages/                    # Pages with real content
```

## Component Levels

### Quarks (theme.ts)

Design tokens - the foundation of the design system:

- `colors` - Color palette
- `spacing` - Spacing scale (xs, sm, md, lg, xl)
- `fonts` - Typography (body, mono, heading)
- `fontSizes` - Font size scale
- `radii` - Border radius values

### Atoms (components/atoms/)

Basic building blocks that cannot be broken down further:

- Box, HStack, VStack, Center - Layout primitives
- Button, Input, Checkbox - Form elements
- Text, Heading, Link - Typography
- Badge, Spinner, Skeleton - UI indicators

### Molecules (components/molecules/)

Groups of atoms functioning together:

- ConfidenceBadge - Badge with confidence level styling
- StatItem - Label + value pair
- StatusIndicator - Status icon + text
- TabButton - Tab navigation item

### Organisms (components/organisms/)

Complex UI sections composed of molecules and atoms:

- SessionListItem - Session row with metadata
- StatCard - Metric display card
- SectionCard - Titled content section
- VirtualList - Virtualized scrolling list
- MarkdownContent - Rendered markdown with syntax highlighting

Re-exported from pages/ (due to Relay fragment colocation):

- SessionMessages - Paginated message list
- SessionSidebar - Session details sidebar
- FileChangeCard, HookExecutionCard, TaskCard

### Templates (components/templates/)

Page layouts without real content:

- PageLayout - Main app layout with sidebar
- DashboardTemplate - Dashboard layout with stats/charts sections
- Sidebar - Navigation sidebar

### Pages (components/pages/)

Templates filled with real content from GraphQL:

- DashboardPage - Main dashboard
- SessionDetailPage - Session view with messages
- SessionListPage - Session listing
- (etc.)

## Import Patterns

```typescript
// Import atoms
import { Button, Text, VStack } from '@/components/atoms';

// Import molecules
import { StatItem, StatusIndicator } from '@/components/molecules';

// Import organisms
import { SessionListItem, StatCard } from '@/components/organisms';

// Import templates
import { PageLayout, DashboardTemplate } from '@/components/templates';

// Import theme (quarks)
import { colors, spacing, fonts } from '@/theme';
```

## Rules

1. **Atoms** import only from quarks (theme.ts)
2. **Molecules** import from atoms and quarks
3. **Organisms** import from molecules, atoms, and quarks
4. **Templates** import from organisms, molecules, atoms, and quarks
5. **Pages** import from templates, organisms, molecules, atoms, and quarks

## Relay Fragment Colocation

Some organisms live in `pages/` directories due to Relay fragment colocation requirements. These are re-exported from `organisms/index.ts` for consumers who prefer atomic design imports.
