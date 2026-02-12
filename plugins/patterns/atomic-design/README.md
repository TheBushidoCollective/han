# Atomic Design

Validation and quality enforcement for Atomic Design methodology in component-based projects.

## Overview

This plugin provides comprehensive skills and validation for implementing Brad Frost's Atomic Design methodology, extended with quarks for design tokens. Atomic Design organizes UI components into a clear hierarchy:

0. **Quarks** - Design tokens (colors, spacing, typography, shadows)
1. **Atoms** - Basic building blocks (buttons, inputs, labels)
2. **Molecules** - Groups of atoms (form fields, search bars)
3. **Organisms** - Complex UI sections (headers, footers, cards)
4. **Templates** - Page layouts without content
5. **Pages** - Templates with real content

## Skills

This plugin provides the following skills:

- **atomic-design-fundamentals** - Core methodology, hierarchy, and organization patterns
- **atomic-design-quarks** - Design tokens, CSS variables, and primitive values
- **atomic-design-atoms** - Creating atomic-level components (buttons, inputs, icons)
- **atomic-design-molecules** - Composing atoms into functional units (form fields, nav items)
- **atomic-design-organisms** - Building complex UI sections (headers, footers, product cards)
- **atomic-design-templates** - Page layouts with placeholder content
- **atomic-design-integration** - Framework-specific patterns for React, Vue, Angular

## Usage

Skills can be invoked using the Skill tool:

```javascript
Skill("atomic-design:atomic-design-fundamentals")
Skill("atomic-design:atomic-design-quarks")
Skill("atomic-design:atomic-design-atoms")
Skill("atomic-design:atomic-design-molecules")
Skill("atomic-design:atomic-design-organisms")
Skill("atomic-design:atomic-design-templates")
Skill("atomic-design:atomic-design-integration")
```

Each skill provides specialized knowledge, best practices, and code examples for that level of atomic design.

## Quality Hooks

This plugin includes validation hooks powered by [eslint-plugin-atomic-design](https://github.com/nicksrandall/eslint-plugin-atomic-design) that enforce proper component import hierarchy.

### Hierarchical Import Validation

The `hierarchical-import` rule ensures components only import from lower levels in the hierarchy:

| Level     | Can Import From                               |
|-----------|-----------------------------------------------|
| quarks    | (none - base level)                           |
| atoms     | quarks                                        |
| molecules | quarks, atoms                                 |
| organisms | quarks, atoms, molecules, other organisms     |
| templates | quarks, atoms, molecules, organisms           |
| pages     | quarks, atoms, molecules, organisms, templates|

Note: Organisms can import from other organisms (prefixed with `=` in the config), which is a common pattern for composing complex UI sections.

**Example violations:**

```jsx
// In molecules/SearchBar.jsx
import Header from '../organisms/Header';  // ERROR: molecules cannot import organisms

// In atoms/Button.jsx
import FormField from '../molecules/FormField';  // ERROR: atoms cannot import molecules
```

The hook runs automatically on `.jsx` and `.tsx` files when you modify components.

### Configuration Options

The ESLint rule accepts these options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `levels` | `Array<String\|String[]>` | `['atoms', 'molecules', '=organisms', 'templates', 'pages']` | Hierarchy in order of size. Prefix with `=` to allow same-level imports |
| `excludes` | `Array<RegExpString>` | `['node_modules\/\\w']` | Patterns to ignore |
| `pathPatterns` | `Array<RegExpString>` | - | Custom regex for identifying levels |
| `module` | `'strict' \| 'loose' \| 'off' \| false` | `'loose'` | How to handle sibling module imports |

**This plugin's configuration:**

```json
{
  "plugins": ["atomic-design"],
  "rules": {
    "atomic-design/hierarchical-import": ["error", {
      "levels": ["quarks", "atoms", "molecules", "=organisms", "templates", "pages"],
      "excludes": ["node_modules"],
      "module": "loose"
    }]
  }
}
```

Key configuration choices:

- **quarks** included at the start for design token support
- **=organisms** allows organisms to import from other organisms (common pattern)
- **module: "loose"** provides flexibility for sibling module imports

## Installation

Install with the Han CLI:

```bash
han plugin install atomic-design
```

Or add to your Claude Code settings manually.

## Requirements

- A component-based project (React, Vue, etc.) with `.jsx` or `.tsx` files
- Node.js and npm (for running ESLint via npx)
- Standard directory structure with atoms, molecules, organisms, templates, pages directories

## Directory Structure Recommendations

### Standard Structure

```text
src/
  quarks/                    # Design tokens
    index.ts
    colors.ts
    spacing.ts
    typography.ts
  components/
    atoms/
      Button/
        Button.tsx
        Button.test.tsx
        Button.stories.tsx
        index.ts
      Input/
      Label/
    molecules/
      FormField/
      SearchForm/
    organisms/
      Header/
      Footer/
    templates/
      MainLayout/
    pages/
      HomePage/
```

### Alternative Flat Structure

```text
src/
  quarks/
    colors.ts
    spacing.ts
  components/
    atoms/
      Button.tsx
      Input.tsx
    molecules/
      FormField.tsx
    organisms/
      Header.tsx
```

## Key Concepts

### Component Hierarchy

Components should only import from lower levels (enforced by eslint-plugin-atomic-design):

- **Quarks**: Design tokens, CSS variables (no imports - base level)
- **Atoms**: Base UI elements that consume quarks for styling
- **Molecules**: Import from quarks and atoms only
- **Organisms**: Import from quarks, atoms, and molecules
- **Templates**: Import from quarks, atoms, molecules, and organisms
- **Pages**: Import from all lower levels

### Naming Conventions

- Use PascalCase for component names
- Use descriptive names that indicate purpose
- Prefix with level for clarity when needed

### Props Flow

Props should flow downward through the hierarchy:

- Atoms receive primitive props and callbacks
- Molecules compose atom props
- Organisms receive domain objects
- Templates receive content slots

## Resources

- [Atomic Design by Brad Frost](https://atomicdesign.bradfrost.com/)
- [Pattern Lab](https://patternlab.io/)
- [Storybook](https://storybook.js.org/)
