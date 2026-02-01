---
name: storybook-component-documentation
description: Use when creating or improving component documentation in Storybook. Helps generate comprehensive docs using MDX, autodocs, and JSDoc comments.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Storybook - Component Documentation

Create comprehensive, auto-generated component documentation using Storybook's autodocs feature, MDX pages, and JSDoc comments.

## Key Concepts

### Autodocs

Automatically generate documentation pages from stories:

```typescript
const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],  // Enable auto-documentation
  parameters: {
    docs: {
      description: {
        component: 'A versatile button component with multiple variants and sizes.',
      },
    },
  },
} satisfies Meta<typeof Button>;
```

### MDX Documentation

Create custom documentation pages with full control:

```mdx
import { Meta, Canvas, Story, Controls } from '@storybook/blocks';
import * as ButtonStories from './Button.stories';

<Meta of={ButtonStories} />

# Button Component

A versatile button component for user interactions.

## Usage

<Canvas of={ButtonStories.Primary} />

## Props

<Controls of={ButtonStories.Primary} />
```

### JSDoc Comments

Document component props for auto-extraction:

```typescript
interface ButtonProps {
  /**
   * The button label text
   */
  label: string;

  /**
   * Is this the principal call to action?
   * @default false
   */
  primary?: boolean;

  /**
   * Button size variant
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large';
}
```

## Best Practices

### 1. Enable Autodocs

Add the `autodocs` tag to generate documentation automatically:

```typescript
const meta = {
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Button component with primary and secondary variants.',
      },
    },
  },
} satisfies Meta<typeof Button>;
```

### 2. Document Component Descriptions

Provide clear, concise component descriptions:

```typescript
const meta = {
  component: Tooltip,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
Tooltip displays helpful information when users hover over an element.
Supports multiple placements and can be triggered by hover, click, or focus.

## Features
- Multiple placement options
- Customizable delay
- Accessible (ARIA compliant)
- Keyboard navigation support
        `.trim(),
      },
    },
  },
} satisfies Meta<typeof Tooltip>;
```

### 3. Document Story Variations

Add descriptions to individual stories:

```typescript
export const WithIcon: Story = {
  args: {
    label: 'Download',
    icon: 'download',
  },
  parameters: {
    docs: {
      description: {
        story: 'Buttons can include icons to enhance visual communication.',
      },
    },
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    label: 'Processing...',
  },
  parameters: {
    docs: {
      description: {
        story: 'Loading state disables interaction and shows a spinner.',
      },
    },
  },
};
```

### 4. Use JSDoc for Type Documentation

Document props with JSDoc for rich documentation:

```typescript
interface CardProps {
  /**
   * Card title displayed at the top
   */
  title: string;

  /**
   * Optional subtitle below the title
   */
  subtitle?: string;

  /**
   * Card variant affecting visual style
   * @default 'default'
   */
  variant?: 'default' | 'outlined' | 'elevated';

  /**
   * Card content
   */
  children: React.ReactNode;

  /**
   * Called when card is clicked
   * @param event - The click event
   */
  onClick?: (event: React.MouseEvent) => void;

  /**
   * Elevation level (shadow depth)
   * @minimum 0
   * @maximum 5
   * @default 1
   */
  elevation?: number;
}
```

### 5. Create Usage Examples

Show realistic usage examples in MDX:

```mdx
import { Meta, Canvas, Story } from '@storybook/blocks';
import * as FormStories from './Form.stories';

<Meta of={FormStories} />

# Form Component

## Basic Usage

<Canvas of={FormStories.Default} />

## With Validation

<Canvas of={FormStories.WithValidation} />

```tsx
import { Form } from './Form';

function MyForm() {
  return (
    <Form
      onSubmit={(data) => console.log(data)}
      validationSchema={schema}
    >
      <Input name="email" label="Email" />
      <Button type="submit">Submit</Button>
    </Form>
  );
}
```

```

## Common Patterns

### Component Overview Page

```mdx
import { Meta, Canvas, Controls } from '@storybook/blocks';
import * as ButtonStories from './Button.stories';

<Meta of={ButtonStories} />

# Button

Buttons trigger actions and events throughout the application.

## Variants

### Primary

Use primary buttons for the main call-to-action.

<Canvas of={ButtonStories.Primary} />

### Secondary

Use secondary buttons for less important actions.

<Canvas of={ButtonStories.Secondary} />

## Props

<Controls of={ButtonStories.Primary} />

## Accessibility

- Keyboard accessible (Enter/Space to activate)
- Screen reader friendly
- Focus visible indicator
- Proper ARIA labels

## Best Practices

- Use clear, action-oriented labels
- Provide sufficient click target size (min 44×44px)
- Don't use more than one primary button per section
- Include loading states for async actions
```

### API Documentation

```typescript
const meta = {
  component: DataGrid,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Advanced data grid with sorting, filtering, and pagination.',
      },
    },
  },
  argTypes: {
    data: {
      description: 'Array of data objects to display',
      table: {
        type: { summary: 'Array<Record<string, any>>' },
      },
    },
    columns: {
      description: 'Column configuration',
      table: {
        type: { summary: 'ColumnDef[]' },
      },
    },
    onRowClick: {
      description: 'Callback fired when a row is clicked',
      table: {
        type: { summary: '(row: any, index: number) => void' },
      },
    },
  },
} satisfies Meta<typeof DataGrid>;
```

### Migration Guides

```mdx
import { Meta } from '@storybook/blocks';

<Meta title="Guides/Migration/v2 to v3" />

# Migration Guide: v2 → v3

## Breaking Changes

### Button Component

**Before (v2):**
```tsx
<Button type="primary">Click me</Button>
```

**After (v3):**

```tsx
<Button variant="primary">Click me</Button>
```

The `type` prop has been renamed to `variant` for consistency.

### Input Component

**Before (v2):**

```tsx
<Input error="Invalid email" />
```

**After (v3):**

```tsx
<Input error={{ message: "Invalid email" }} />
```

Error handling now uses an object to support additional metadata.

## New Features

### Icon Support

Buttons now support icons:

```tsx
<Button variant="primary" icon="check">
  Save
</Button>
```

```

### Design Tokens

Document design tokens and theming:

```mdx
import { Meta, ColorPalette, ColorItem, Typeset } from '@storybook/blocks';

<Meta title="Design System/Colors" />

# Color Palette

## Primary Colors

<ColorPalette>
  <ColorItem
    title="Primary"
    subtitle="Main brand color"
    colors={{ Primary: '#007bff' }}
  />
  <ColorItem
    title="Secondary"
    subtitle="Supporting color"
    colors={{ Secondary: '#6c757d' }}
  />
</ColorPalette>

## Typography

<Typeset
  fontSizes={[12, 14, 16, 20, 24, 32, 40, 48]}
  fontWeight={400}
  sampleText="The quick brown fox jumps over the lazy dog"
/>
```

## Advanced Patterns

### Inline Stories in MDX

```mdx
import { Meta, Story } from '@storybook/blocks';
import { Button } from './Button';

<Meta title="Components/Button/Examples" component={Button} />

# Button Examples

## Inline Story

<Story name="Custom">
  {() => {
    const [count, setCount] = React.useState(0);
    return (
      <Button onClick={() => setCount(count + 1)}>
        Clicked {count} times
      </Button>
    );
  }}
</Story>
```

### Code Snippets

```mdx
import { Source } from '@storybook/blocks';

<Meta title="Guides/Setup" />

# Installation

Install the component library:

<Source
  language="bash"
  code={`
npm install @company/ui-components
# or
yarn add @company/ui-components
  `}
/>

Then import components:

<Source
  language="tsx"
  code={`
import { Button, Input, Form } from '@company/ui-components';

function App() {
  return (
    <Form>
      <Input label="Email" />
      <Button>Submit</Button>
    </Form>
  );
}
  `}
/>
```

## Anti-Patterns

### ❌ Don't Skip Component Descriptions

```typescript
// Bad
const meta = {
  component: Button,
  tags: ['autodocs'],
} satisfies Meta<typeof Button>;
```

```typescript
// Good
const meta = {
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Primary UI component for user actions.',
      },
    },
  },
} satisfies Meta<typeof Button>;
```

### ❌ Don't Use Generic JSDoc Comments

```typescript
// Bad
interface ButtonProps {
  /** The label */
  label: string;
  /** The size */
  size?: string;
}
```

```typescript
// Good
interface ButtonProps {
  /** Text displayed on the button */
  label: string;
  /**
   * Visual size of the button
   * @default 'medium'
   */
  size?: 'small' | 'medium' | 'large';
}
```

### ❌ Don't Forget Story Descriptions

```typescript
// Bad
export const Disabled: Story = {
  args: { disabled: true },
};
```

```typescript
// Good
export const Disabled: Story = {
  args: { disabled: true },
  parameters: {
    docs: {
      description: {
        story: 'Disabled state prevents user interaction and dims the button visually.',
      },
    },
  },
};
```

## Related Skills

- **storybook-story-writing**: Creating well-structured stories
- **storybook-args-controls**: Configuring interactive controls for props
- **storybook-configuration**: Setting up Storybook with proper documentation addons
