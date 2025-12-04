---
name: storybook-args-controls
description: Use when configuring interactive controls and args for Storybook stories. Helps create dynamic, explorable component demonstrations with proper type constraints.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Storybook - Args and Controls

Configure interactive controls and args to make stories dynamic and explorable, allowing designers and developers to test component variations in real-time.

## Key Concepts

### Args

Args are inputs to components that Storybook tracks and makes interactive:

```typescript
export const Primary: Story = {
  args: {
    label: 'Button',
    primary: true,
    size: 'medium',
    onClick: () => alert('clicked'),
  },
};
```

### ArgTypes

ArgTypes define metadata about args, including control types and documentation:

```typescript
const meta = {
  component: Button,
  argTypes: {
    backgroundColor: {
      control: 'color',
      description: 'Background color of the button',
    },
    size: {
      control: { type: 'select' },
      options: ['small', 'medium', 'large'],
      description: 'Size variant',
    },
    onClick: {
      action: 'clicked',
    },
  },
} satisfies Meta<typeof Button>;
```

### Control Types

Storybook provides various control types for different data types:

- `text` - String input
- `number` - Number input with validation
- `boolean` - Checkbox toggle
- `color` - Color picker
- `date` - Date picker
- `select` - Dropdown menu
- `radio` - Radio buttons
- `range` - Slider with min/max
- `object` - JSON editor
- `array` - Array editor

## Best Practices

### 1. Infer Controls from TypeScript

Let Storybook auto-generate controls from TypeScript types:

```typescript
interface ButtonProps {
  label: string;
  primary?: boolean;
  size?: 'small' | 'medium' | 'large';
  backgroundColor?: string;
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({ ... }) => { ... };

const meta = {
  component: Button,
  // Controls inferred from ButtonProps
} satisfies Meta<typeof Button>;
```

### 2. Customize Control Types When Needed

Override auto-inferred controls for better UX:

```typescript
const meta = {
  component: ColorPicker,
  argTypes: {
    color: {
      control: 'color',  // Override default text input
    },
    opacity: {
      control: { type: 'range', min: 0, max: 1, step: 0.1 },
    },
    preset: {
      control: 'select',
      options: ['primary', 'secondary', 'success', 'warning', 'danger'],
    },
  },
} satisfies Meta<typeof ColorPicker>;
```

### 3. Use Actions for Event Handlers

Track event callbacks in the Actions panel:

```typescript
const meta = {
  component: Form,
  argTypes: {
    onSubmit: { action: 'submitted' },
    onChange: { action: 'changed' },
    onError: { action: 'error occurred' },
  },
} satisfies Meta<typeof Form>;

export const Default: Story = {
  args: {
    onSubmit: (data) => console.log('Form data:', data),
  },
};
```

### 4. Set Sensible Defaults

Provide default args at the meta level:

```typescript
const meta = {
  component: Slider,
  args: {
    min: 0,
    max: 100,
    step: 1,
    value: 50,
  },
  argTypes: {
    value: {
      control: { type: 'range', min: 0, max: 100, step: 1 },
    },
  },
} satisfies Meta<typeof Slider>;
```

### 5. Document Args

Add descriptions to help users understand each arg:

```typescript
const meta = {
  component: Tooltip,
  argTypes: {
    placement: {
      control: 'select',
      options: ['top', 'right', 'bottom', 'left'],
      description: 'Position of the tooltip relative to its trigger',
      table: {
        defaultValue: { summary: 'top' },
        type: { summary: 'string' },
      },
    },
    delay: {
      control: { type: 'number', min: 0, max: 2000, step: 100 },
      description: 'Delay in milliseconds before showing the tooltip',
    },
  },
} satisfies Meta<typeof Tooltip>;
```

## Common Patterns

### Enum/Union Type Controls

```typescript
type ButtonVariant = 'primary' | 'secondary' | 'danger';

const meta = {
  component: Button,
  argTypes: {
    variant: {
      control: 'radio',
      options: ['primary', 'secondary', 'danger'] satisfies ButtonVariant[],
    },
  },
} satisfies Meta<typeof Button>;
```

### Complex Object Controls

```typescript
const meta = {
  component: Chart,
  argTypes: {
    data: {
      control: 'object',
      description: 'Chart data points',
    },
    options: {
      control: 'object',
      description: 'Chart configuration',
    },
  },
} satisfies Meta<typeof Chart>;

export const Default: Story = {
  args: {
    data: [
      { x: 0, y: 10 },
      { x: 1, y: 20 },
      { x: 2, y: 15 },
    ],
    options: {
      showLegend: true,
      animate: true,
    },
  },
};
```

### Conditional Controls

Hide irrelevant controls based on other arg values:

```typescript
const meta = {
  component: Input,
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'number', 'email', 'password'],
    },
    min: {
      control: 'number',
      if: { arg: 'type', eq: 'number' },  // Only show for number inputs
    },
    max: {
      control: 'number',
      if: { arg: 'type', eq: 'number' },
    },
    showPasswordToggle: {
      control: 'boolean',
      if: { arg: 'type', eq: 'password' },
    },
  },
} satisfies Meta<typeof Input>;
```

### Disable Controls

Disable controls for props that shouldn't be editable:

```typescript
const meta = {
  component: DataTable,
  argTypes: {
    data: {
      control: false,  // Disable control (use args instead)
    },
    onSort: {
      table: { disable: true },  // Hide from docs table
    },
  },
} satisfies Meta<typeof DataTable>;
```

### Grouping Controls

Organize controls into logical categories:

```typescript
const meta = {
  component: Modal,
  argTypes: {
    // Appearance
    title: {
      control: 'text',
      table: { category: 'Appearance' },
    },
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
      table: { category: 'Appearance' },
    },

    // Behavior
    closeOnEscape: {
      control: 'boolean',
      table: { category: 'Behavior' },
    },
    closeOnOverlayClick: {
      control: 'boolean',
      table: { category: 'Behavior' },
    },

    // Events
    onClose: {
      action: 'closed',
      table: { category: 'Events' },
    },
  },
} satisfies Meta<typeof Modal>;
```

## Advanced Patterns

### Custom Control Components

Create custom controls for specialized inputs:

```typescript
import { useArgs } from '@storybook/preview-api';

const meta = {
  component: GradientPicker,
  argTypes: {
    gradient: {
      control: {
        type: 'object',
      },
    },
  },
} satisfies Meta<typeof GradientPicker>;

export const Custom: Story = {
  render: (args) => {
    const [{ gradient }, updateArgs] = useArgs();
    return (
      <GradientPicker
        {...args}
        gradient={gradient}
        onChange={(newGradient) => updateArgs({ gradient: newGradient })}
      />
    );
  },
};
```

### Dynamic ArgTypes

Generate argTypes programmatically:

```typescript
const themes = ['light', 'dark', 'system'] as const;

const meta = {
  component: ThemeProvider,
  argTypes: {
    theme: {
      control: 'select',
      options: themes,
      mapping: Object.fromEntries(
        themes.map(theme => [theme, theme])
      ),
    },
  },
} satisfies Meta<typeof ThemeProvider>;
```

## Anti-Patterns

### ❌ Don't Override Args in Render

```typescript
// Bad
export const Example: Story = {
  render: (args) => <Button {...args} label="Hardcoded" />,
};
```

```typescript
// Good
export const Example: Story = {
  args: {
    label: 'Hardcoded',
  },
};
```

### ❌ Don't Use Controls for Static Data

```typescript
// Bad - Large mock data in controls
export const WithData: Story = {
  args: {
    items: Array.from({ length: 1000 }, (_, i) => ({ id: i, ... })),
  },
  argTypes: {
    items: { control: 'object' },  // Don't make editable
  },
};
```

```typescript
// Good - Disable control for mock data
export const WithData: Story = {
  args: {
    items: mockLargeDataset,
  },
  argTypes: {
    items: { control: false },
  },
};
```

### ❌ Don't Duplicate ArgTypes Across Stories

```typescript
// Bad
export const Story1: Story = {
  argTypes: {
    size: { control: 'select', options: ['small', 'large'] },
  },
};
export const Story2: Story = {
  argTypes: {
    size: { control: 'select', options: ['small', 'large'] },
  },
};
```

```typescript
// Good - Define at meta level
const meta = {
  component: Button,
  argTypes: {
    size: { control: 'select', options: ['small', 'large'] },
  },
} satisfies Meta<typeof Button>;
```

## Related Skills

- **storybook-story-writing**: Writing well-structured stories
- **storybook-component-documentation**: Auto-generating docs from controls
- **storybook-play-functions**: Testing interactions with args
