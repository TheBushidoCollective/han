---
name: atomic-design-quarks
user-invocable: false
description: Use when working with design tokens, CSS custom properties, and primitive values that form the foundation below atoms. Quarks are the sub-atomic building blocks.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# Atomic Design: Quarks

Master the creation and organization of quarks - the sub-atomic design tokens and primitive values that form the foundation of your design system. Quarks are the smallest building blocks that atoms consume.

## What Are Quarks?

Quarks extend Brad Frost's Atomic Design methodology by adding a level below atoms. While atoms are the smallest *UI components*, quarks are the smallest *design values* - the raw materials from which atoms are built.

Quarks are:

- **Primitive Values**: Colors, spacing units, font sizes, shadows
- **Non-Visual**: They don't render anything on their own
- **Design Tokens**: Named constants that define your design language
- **Consumed by Atoms**: Atoms import and use quarks for styling

## Quarks vs Atoms

| Aspect | Quarks | Atoms |
|--------|--------|-------|
| Nature | Values/Tokens | UI Components |
| Render | Nothing (CSS variables, constants) | Visual elements |
| Examples | `--color-primary-500`, `spacing.md` | Button, Input, Label |
| Imports | None (base level) | Quarks only |
| Purpose | Define design language | Implement design language |

## Common Quark Types

### Color Tokens

```typescript
// quarks/colors.ts
export const colors = {
  // Brand colors
  primary: {
    50: '#e3f2fd',
    100: '#bbdefb',
    200: '#90caf9',
    300: '#64b5f6',
    400: '#42a5f5',
    500: '#2196f3', // Primary
    600: '#1e88e5',
    700: '#1976d2',
    800: '#1565c0',
    900: '#0d47a1',
  },

  // Semantic colors
  success: {
    light: '#4caf50',
    main: '#2e7d32',
    dark: '#1b5e20',
  },
  warning: {
    light: '#ff9800',
    main: '#ed6c02',
    dark: '#e65100',
  },
  danger: {
    light: '#ef5350',
    main: '#d32f2f',
    dark: '#c62828',
  },

  // Neutral colors
  neutral: {
    0: '#ffffff',
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#eeeeee',
    300: '#e0e0e0',
    400: '#bdbdbd',
    500: '#9e9e9e',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  },
} as const;

export type ColorScale = keyof typeof colors;
export type PrimaryShade = keyof typeof colors.primary;
```

### Spacing Tokens

```typescript
// quarks/spacing.ts
export const spacing = {
  px: '1px',
  0: '0',
  0.5: '0.125rem', // 2px
  1: '0.25rem',    // 4px
  1.5: '0.375rem', // 6px
  2: '0.5rem',     // 8px
  2.5: '0.625rem', // 10px
  3: '0.75rem',    // 12px
  3.5: '0.875rem', // 14px
  4: '1rem',       // 16px
  5: '1.25rem',    // 20px
  6: '1.5rem',     // 24px
  7: '1.75rem',    // 28px
  8: '2rem',       // 32px
  9: '2.25rem',    // 36px
  10: '2.5rem',    // 40px
  12: '3rem',      // 48px
  14: '3.5rem',    // 56px
  16: '4rem',      // 64px
  20: '5rem',      // 80px
  24: '6rem',      // 96px
} as const;

// Semantic spacing aliases
export const spacingAliases = {
  none: spacing[0],
  xs: spacing[1],
  sm: spacing[2],
  md: spacing[4],
  lg: spacing[6],
  xl: spacing[8],
  '2xl': spacing[12],
  '3xl': spacing[16],
} as const;
```

### Typography Tokens

```typescript
// quarks/typography.ts
export const fontFamily = {
  sans: [
    'Inter',
    'ui-sans-serif',
    'system-ui',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'sans-serif',
  ].join(', '),
  serif: [
    'Georgia',
    'Cambria',
    'Times New Roman',
    'Times',
    'serif',
  ].join(', '),
  mono: [
    'Fira Code',
    'ui-monospace',
    'SFMono-Regular',
    'Menlo',
    'Monaco',
    'Consolas',
    'monospace',
  ].join(', '),
} as const;

export const fontSize = {
  xs: '0.75rem',    // 12px
  sm: '0.875rem',   // 14px
  base: '1rem',     // 16px
  lg: '1.125rem',   // 18px
  xl: '1.25rem',    // 20px
  '2xl': '1.5rem',  // 24px
  '3xl': '1.875rem', // 30px
  '4xl': '2.25rem', // 36px
  '5xl': '3rem',    // 48px
  '6xl': '3.75rem', // 60px
} as const;

export const fontWeight = {
  thin: 100,
  extralight: 200,
  light: 300,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
} as const;

export const lineHeight = {
  none: 1,
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
} as const;

export const letterSpacing = {
  tighter: '-0.05em',
  tight: '-0.025em',
  normal: '0em',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.1em',
} as const;
```

### Border Tokens

```typescript
// quarks/borders.ts
export const borderRadius = {
  none: '0',
  sm: '0.125rem',   // 2px
  DEFAULT: '0.25rem', // 4px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  '3xl': '1.5rem',  // 24px
  full: '9999px',
} as const;

export const borderWidth = {
  DEFAULT: '1px',
  0: '0',
  2: '2px',
  4: '4px',
  8: '8px',
} as const;
```

### Shadow Tokens

```typescript
// quarks/shadows.ts
export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
} as const;

// Focus ring shadows
export const focusRings = {
  primary: '0 0 0 3px rgba(33, 150, 243, 0.4)',
  danger: '0 0 0 3px rgba(239, 83, 80, 0.4)',
  success: '0 0 0 3px rgba(76, 175, 80, 0.4)',
} as const;
```

### Animation Tokens

```typescript
// quarks/animations.ts
export const duration = {
  instant: '0ms',
  fast: '100ms',
  normal: '200ms',
  slow: '300ms',
  slower: '500ms',
} as const;

export const easing = {
  linear: 'linear',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  out: 'cubic-bezier(0, 0, 0.2, 1)',
  inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const;

export const transitions = {
  none: 'none',
  all: `all ${duration.normal} ${easing.inOut}`,
  colors: `background-color, border-color, color, fill, stroke ${duration.normal} ${easing.inOut}`,
  opacity: `opacity ${duration.normal} ${easing.inOut}`,
  shadow: `box-shadow ${duration.normal} ${easing.inOut}`,
  transform: `transform ${duration.normal} ${easing.inOut}`,
} as const;
```

### Breakpoint Tokens

```typescript
// quarks/breakpoints.ts
export const breakpoints = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// Media query helpers
export const mediaQueries = {
  xs: `@media (min-width: ${breakpoints.xs})`,
  sm: `@media (min-width: ${breakpoints.sm})`,
  md: `@media (min-width: ${breakpoints.md})`,
  lg: `@media (min-width: ${breakpoints.lg})`,
  xl: `@media (min-width: ${breakpoints.xl})`,
  '2xl': `@media (min-width: ${breakpoints['2xl']})`,
} as const;
```

### Z-Index Tokens

```typescript
// quarks/z-index.ts
export const zIndex = {
  hide: -1,
  base: 0,
  raised: 1,
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  tooltip: 1600,
  toast: 1700,
} as const;
```

## CSS Custom Properties

Export quarks as CSS custom properties for runtime theming.

```typescript
// quarks/css-variables.ts
import { colors, spacing, fontSize, fontFamily } from './index';

export function generateCSSVariables(): string {
  const lines: string[] = [':root {'];

  // Colors
  Object.entries(colors).forEach(([category, shades]) => {
    if (typeof shades === 'object') {
      Object.entries(shades).forEach(([shade, value]) => {
        lines.push(`  --color-${category}-${shade}: ${value};`);
      });
    }
  });

  // Spacing
  Object.entries(spacing).forEach(([key, value]) => {
    const sanitizedKey = key.replace('.', '_');
    lines.push(`  --spacing-${sanitizedKey}: ${value};`);
  });

  // Typography
  Object.entries(fontSize).forEach(([key, value]) => {
    lines.push(`  --font-size-${key}: ${value};`);
  });

  Object.entries(fontFamily).forEach(([key, value]) => {
    lines.push(`  --font-family-${key}: ${value};`);
  });

  lines.push('}');
  return lines.join('\n');
}
```

### Generated CSS

```css
/* quarks/variables.css - Generated output */
:root {
  /* Colors - Primary */
  --color-primary-50: #e3f2fd;
  --color-primary-100: #bbdefb;
  --color-primary-500: #2196f3;
  --color-primary-900: #0d47a1;

  /* Colors - Neutral */
  --color-neutral-0: #ffffff;
  --color-neutral-100: #f5f5f5;
  --color-neutral-900: #212121;

  /* Spacing */
  --spacing-0: 0;
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-4: 1rem;
  --spacing-8: 2rem;

  /* Typography */
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;

  --font-family-sans: Inter, ui-sans-serif, system-ui, sans-serif;
  --font-family-mono: Fira Code, ui-monospace, monospace;

  /* Borders */
  --border-radius-sm: 0.125rem;
  --border-radius-md: 0.375rem;
  --border-radius-lg: 0.5rem;
  --border-radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);

  /* Transitions */
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --easing-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}
```

## Directory Structure

### Recommended Structure

```text
src/
  quarks/                    # Design tokens
    index.ts                 # Barrel export
    colors.ts
    spacing.ts
    typography.ts
    borders.ts
    shadows.ts
    animations.ts
    breakpoints.ts
    z-index.ts
    css-variables.ts         # CSS custom property generator
    variables.css            # Generated CSS file
  components/
    atoms/                   # Atoms that consume quarks
      Button/
      Input/
    molecules/
    organisms/
    templates/
    pages/
```

### Index Barrel Export

```typescript
// quarks/index.ts
export * from './colors';
export * from './spacing';
export * from './typography';
export * from './borders';
export * from './shadows';
export * from './animations';
export * from './breakpoints';
export * from './z-index';
```

## Using Quarks in Atoms

### CSS-in-JS (styled-components/emotion)

```typescript
// atoms/Button/Button.tsx
import styled from 'styled-components';
import { colors, spacing, fontSize, borderRadius, transitions } from '@/quarks';

export const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: ${spacing[2]} ${spacing[4]};
  font-size: ${fontSize.base};
  border-radius: ${borderRadius.md};
  transition: ${transitions.colors};

  ${({ variant = 'primary' }) =>
    variant === 'primary'
      ? `
        background-color: ${colors.primary[500]};
        color: ${colors.neutral[0]};

        &:hover {
          background-color: ${colors.primary[600]};
        }
      `
      : `
        background-color: transparent;
        color: ${colors.primary[500]};
        border: 1px solid ${colors.primary[500]};

        &:hover {
          background-color: ${colors.primary[50]};
        }
      `}
`;
```

### CSS Modules with Variables

```tsx
// atoms/Button/Button.tsx
import styles from './Button.module.css';

export const Button = ({ variant = 'primary', children }) => (
  <button className={`${styles.button} ${styles[variant]}`}>
    {children}
  </button>
);
```

```css
/* atoms/Button/Button.module.css */
.button {
  padding: var(--spacing-2) var(--spacing-4);
  font-size: var(--font-size-base);
  border-radius: var(--border-radius-md);
  transition: var(--duration-normal) var(--easing-in-out);
}

.primary {
  background-color: var(--color-primary-500);
  color: var(--color-neutral-0);
}

.primary:hover {
  background-color: var(--color-primary-600);
}

.secondary {
  background-color: transparent;
  color: var(--color-primary-500);
  border: 1px solid var(--color-primary-500);
}
```

### Tailwind CSS Integration

```javascript
// tailwind.config.js
const { colors, spacing, fontSize, borderRadius } = require('./src/quarks');

module.exports = {
  theme: {
    colors,
    spacing,
    fontSize,
    borderRadius,
  },
};
```

## Theming with Quarks

### Dark Mode Support

```typescript
// quarks/themes.ts
import { colors } from './colors';

export const lightTheme = {
  background: colors.neutral[0],
  foreground: colors.neutral[900],
  muted: colors.neutral[100],
  mutedForeground: colors.neutral[500],
  primary: colors.primary[500],
  primaryForeground: colors.neutral[0],
};

export const darkTheme = {
  background: colors.neutral[900],
  foreground: colors.neutral[0],
  muted: colors.neutral[800],
  mutedForeground: colors.neutral[400],
  primary: colors.primary[400],
  primaryForeground: colors.neutral[900],
};

export type Theme = typeof lightTheme;
```

### CSS Variables for Theming

```css
/* quarks/theme-light.css */
:root {
  --background: var(--color-neutral-0);
  --foreground: var(--color-neutral-900);
  --muted: var(--color-neutral-100);
  --primary: var(--color-primary-500);
}

/* quarks/theme-dark.css */
[data-theme="dark"] {
  --background: var(--color-neutral-900);
  --foreground: var(--color-neutral-0);
  --muted: var(--color-neutral-800);
  --primary: var(--color-primary-400);
}
```

## Best Practices

### 1. Use Semantic Names

```typescript
// GOOD: Semantic naming
export const colors = {
  primary: { ... },
  danger: { ... },
  success: { ... },
};

// BAD: Raw color names
export const colors = {
  blue: { ... },
  red: { ... },
  green: { ... },
};
```

### 2. Consistent Scales

```typescript
// GOOD: Consistent scale pattern
export const colors = {
  primary: { 50, 100, 200, 300, 400, 500, 600, 700, 800, 900 },
  secondary: { 50, 100, 200, 300, 400, 500, 600, 700, 800, 900 },
};

// BAD: Inconsistent scales
export const colors = {
  primary: { light, medium, dark },
  secondary: { 100, 500, 900 },
};
```

### 3. Type Safety

```typescript
// GOOD: Type-safe tokens
export const spacing = { ... } as const;
export type SpacingKey = keyof typeof spacing;

function getSpacing(key: SpacingKey): string {
  return spacing[key];
}

// BAD: Untyped strings
function getSpacing(key: string): string {
  return spacing[key]; // No type checking
}
```

### 4. Single Source of Truth

```typescript
// GOOD: Quarks as the only source
// All components import from quarks
import { colors } from '@/quarks';

// BAD: Duplicate values
const Button = styled.button`
  color: #2196f3; // Hardcoded, not from quarks!
`;
```

### 5. Documentation

```typescript
// GOOD: Document your tokens
/**
 * Primary color scale
 * Use 500 for default primary actions
 * Use 600+ for hover/active states
 * Use 100-400 for backgrounds/accents
 */
export const primary = { ... };
```

## Anti-Patterns to Avoid

### 1. Quarks with Logic

```typescript
// BAD: Quarks should be pure values
export const getColor = (isDark: boolean) =>
  isDark ? '#ffffff' : '#000000';

// GOOD: Pure values, logic in components/themes
export const colors = {
  light: { text: '#000000' },
  dark: { text: '#ffffff' },
};
```

### 2. Component-Specific Tokens

```typescript
// BAD: Token for specific component
export const buttonPrimaryBackground = '#2196f3';

// GOOD: Generic semantic tokens
export const colors = {
  primary: { 500: '#2196f3' },
};
```

### 3. Too Many Tokens

```typescript
// BAD: Token for every possible value
export const spacing = {
  1: '1px',
  2: '2px',
  3: '3px',
  4: '4px',
  5: '5px',
  // ... 100 more values
};

// GOOD: Deliberate, usable scale
export const spacing = {
  1: '0.25rem',
  2: '0.5rem',
  4: '1rem',
  6: '1.5rem',
  8: '2rem',
};
```

## When to Use This Skill

- Setting up design tokens for a new design system
- Organizing existing CSS variables into a structured system
- Creating theme-able component libraries
- Ensuring consistency across a large codebase
- Building white-label or multi-brand applications
- Migrating from hardcoded values to design tokens

## Related Skills

- `atomic-design-fundamentals` - Core methodology overview
- `atomic-design-atoms` - Creating atomic components that consume quarks
- `atomic-design-integration` - Framework-specific implementation patterns

## Resources

### Documentation

- Design Tokens W3C Community Group: <https://www.w3.org/community/design-tokens/>
- Style Dictionary: <https://amzn.github.io/style-dictionary/>
- Tokens Studio: <https://tokens.studio/>

### Tools

- Figma Tokens: <https://www.figma.com/community/plugin/843461159747178978>
- Style Dictionary: <https://amzn.github.io/style-dictionary/>
- Theme UI: <https://theme-ui.com/>
