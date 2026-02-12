---
name: atomic-design-integration
user-invocable: false
description: Use when integrating Atomic Design methodology with React, Vue, Angular, or other frameworks. Framework-specific implementation patterns.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# Atomic Design: Framework Integration

Master the integration of Atomic Design methodology with modern frontend frameworks. This skill covers React, Vue, Angular, and general patterns for implementing atomic component hierarchies.

## React Integration

### Project Structure

```text
src/
  components/
    atoms/
      Button/
        Button.tsx
        Button.module.css
        Button.test.tsx
        Button.stories.tsx
        index.ts
      index.ts                 # Barrel export
    molecules/
      FormField/
        FormField.tsx
        FormField.module.css
        FormField.test.tsx
        index.ts
      index.ts
    organisms/
      Header/
        Header.tsx
        Header.module.css
        useHeader.ts           # Custom hook
        index.ts
      index.ts
    templates/
      MainLayout/
        MainLayout.tsx
        MainLayout.module.css
        index.ts
      index.ts
    index.ts                   # Main barrel export
  pages/                       # Next.js or page components
    HomePage/
      HomePage.tsx
      index.ts
```

### Barrel Exports Pattern

```typescript
// components/atoms/index.ts
export { Button } from './Button';
export type { ButtonProps } from './Button';

export { Input } from './Input';
export type { InputProps } from './Input';

export { Label } from './Label';
export type { LabelProps } from './Label';

export { Icon } from './Icon';
export type { IconProps } from './Icon';

// components/index.ts
export * from './atoms';
export * from './molecules';
export * from './organisms';
export * from './templates';
```

### Component Template (React/TypeScript)

```typescript
// components/atoms/Button/Button.tsx
import React, { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';
import { clsx } from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={clsx(
          styles.button,
          styles[variant],
          styles[size],
          fullWidth && styles.fullWidth,
          isLoading && styles.loading,
          className
        )}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading ? (
          <span className={styles.spinner} aria-hidden="true" />
        ) : (
          <>
            {leftIcon && <span className={styles.leftIcon}>{leftIcon}</span>}
            {children}
            {rightIcon && <span className={styles.rightIcon}>{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

### Custom Hooks with Atomic Design

```typescript
// organisms/Header/useHeader.ts
import { useState, useCallback } from 'react';

interface UseHeaderOptions {
  user?: { id: string; name: string };
  onLogout?: () => void;
}

export function useHeader({ user, onLogout }: UseHeaderOptions) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleMenu = useCallback(() => {
    setMenuOpen((prev) => !prev);
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    // Could trigger search action here
  }, []);

  const handleLogout = useCallback(() => {
    setMenuOpen(false);
    onLogout?.();
  }, [onLogout]);

  return {
    menuOpen,
    toggleMenu,
    searchQuery,
    handleSearch,
    handleLogout,
    isAuthenticated: !!user,
  };
}
```

### Context for Design Tokens

```typescript
// contexts/ThemeContext.tsx
import React, { createContext, useContext, useState } from 'react';

interface Theme {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
  };
}

const defaultTheme: Theme = {
  colors: {
    primary: '#2196f3',
    secondary: '#f50057',
    background: '#ffffff',
    text: '#212121',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
  },
};

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({
  theme: defaultTheme,
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setTheme] = useState(defaultTheme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
```

## Vue Integration

### Project Structure (Vue 3)

```text
src/
  components/
    atoms/
      VButton/
        VButton.vue
        VButton.spec.ts
        index.ts
      VInput/
      index.ts
    molecules/
      VFormField/
        VFormField.vue
        useFormField.ts
        index.ts
      index.ts
    organisms/
      VHeader/
        VHeader.vue
        index.ts
      index.ts
    templates/
      MainLayout/
        MainLayout.vue
        index.ts
```

### Vue Component Template

```vue
<!-- components/atoms/VButton/VButton.vue -->
<template>
  <button
    :class="buttonClasses"
    :disabled="disabled || loading"
    :aria-busy="loading"
    v-bind="$attrs"
  >
    <span v-if="loading" class="spinner" aria-hidden="true" />
    <template v-else>
      <span v-if="$slots.leftIcon" class="left-icon">
        <slot name="leftIcon" />
      </span>
      <slot />
      <span v-if="$slots.rightIcon" class="right-icon">
        <slot name="rightIcon" />
      </span>
    </template>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'tertiary';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<ButtonProps>(), {
  variant: 'primary',
  size: 'md',
  fullWidth: false,
  loading: false,
  disabled: false,
});

const buttonClasses = computed(() => [
  'btn',
  `btn-${props.variant}`,
  `btn-${props.size}`,
  { 'btn-full': props.fullWidth, 'btn-loading': props.loading },
]);
</script>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 14px;
}

.btn-md {
  padding: 8px 16px;
  font-size: 16px;
}

.btn-lg {
  padding: 12px 24px;
  font-size: 18px;
}

.btn-full {
  width: 100%;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

### Vue Composables (Hooks)

```typescript
// components/organisms/VHeader/useHeader.ts
import { ref, computed } from 'vue';
import type { Ref } from 'vue';

interface User {
  id: string;
  name: string;
}

export function useHeader(user: Ref<User | null>) {
  const menuOpen = ref(false);
  const searchQuery = ref('');

  const isAuthenticated = computed(() => !!user.value);

  const toggleMenu = () => {
    menuOpen.value = !menuOpen.value;
  };

  const handleSearch = (query: string) => {
    searchQuery.value = query;
  };

  return {
    menuOpen,
    searchQuery,
    isAuthenticated,
    toggleMenu,
    handleSearch,
  };
}
```

## Angular Integration

### Project Structure (Angular)

```text
src/
  app/
    components/
      atoms/
        button/
          button.component.ts
          button.component.html
          button.component.scss
          button.component.spec.ts
        input/
        atoms.module.ts
      molecules/
        form-field/
          form-field.component.ts
          form-field.component.html
        molecules.module.ts
      organisms/
        header/
          header.component.ts
          header.service.ts
        organisms.module.ts
      templates/
        main-layout/
          main-layout.component.ts
        templates.module.ts
    pages/
      home/
        home.component.ts
```

### Angular Component Template

```typescript
// components/atoms/button/button.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      [class]="buttonClasses"
      [disabled]="disabled || loading"
      [attr.aria-busy]="loading"
      (click)="onClick.emit($event)"
    >
      <span *ngIf="loading" class="spinner" aria-hidden="true"></span>
      <ng-container *ngIf="!loading">
        <ng-content select="[leftIcon]"></ng-content>
        <ng-content></ng-content>
        <ng-content select="[rightIcon]"></ng-content>
      </ng-container>
    </button>
  `,
  styleUrls: ['./button.component.scss'],
})
export class ButtonComponent {
  @Input() variant: ButtonVariant = 'primary';
  @Input() size: ButtonSize = 'md';
  @Input() fullWidth = false;
  @Input() loading = false;
  @Input() disabled = false;

  @Output() onClick = new EventEmitter<MouseEvent>();

  get buttonClasses(): string {
    return [
      'btn',
      `btn-${this.variant}`,
      `btn-${this.size}`,
      this.fullWidth ? 'btn-full' : '',
      this.loading ? 'btn-loading' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }
}
```

### Angular Module Organization

```typescript
// components/atoms/atoms.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from './button/button.component';
import { InputComponent } from './input/input.component';
import { LabelComponent } from './label/label.component';
import { IconComponent } from './icon/icon.component';

@NgModule({
  imports: [CommonModule],
  declarations: [
    ButtonComponent,
    InputComponent,
    LabelComponent,
    IconComponent,
  ],
  exports: [ButtonComponent, InputComponent, LabelComponent, IconComponent],
})
export class AtomsModule {}

// components/molecules/molecules.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AtomsModule } from '../atoms/atoms.module';
import { FormFieldComponent } from './form-field/form-field.component';
import { SearchFormComponent } from './search-form/search-form.component';

@NgModule({
  imports: [CommonModule, AtomsModule],
  declarations: [FormFieldComponent, SearchFormComponent],
  exports: [FormFieldComponent, SearchFormComponent],
})
export class MoleculesModule {}
```

## Storybook Integration

### Story File Template

```typescript
// components/atoms/Button/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';
import { Icon } from '../Icon';

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'tertiary'],
      description: 'Visual style variant',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Size of the button',
    },
    fullWidth: {
      control: 'boolean',
      description: 'Whether button takes full width',
    },
    isLoading: {
      control: 'boolean',
      description: 'Loading state',
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled state',
    },
  },
  args: {
    children: 'Button',
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    variant: 'primary',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
  },
};

export const WithIcons: Story = {
  args: {
    leftIcon: <Icon name="plus" size="sm" />,
    children: 'Add Item',
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
    children: 'Submitting...',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="tertiary">Tertiary</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};
```

### Storybook Configuration

```javascript
// .storybook/main.ts
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/components/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
};

export default config;
```

### Storybook Hierarchy

```typescript
// Organize stories by atomic level
// Title format: "Level/ComponentName"

// Atoms
title: 'Atoms/Button'
title: 'Atoms/Input'
title: 'Atoms/Icon'

// Molecules
title: 'Molecules/FormField'
title: 'Molecules/SearchForm'

// Organisms
title: 'Organisms/Header'
title: 'Organisms/Footer'

// Templates
title: 'Templates/MainLayout'
title: 'Templates/DashboardLayout'

// Pages (example compositions)
title: 'Pages/HomePage'
```

## Testing Integration

### Unit Test Template (React/Vitest)

```typescript
// components/atoms/Button/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  describe('rendering', () => {
    it('renders children correctly', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button')).toHaveTextContent('Click me');
    });

    it('applies variant class correctly', () => {
      render(<Button variant="secondary">Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('secondary');
    });

    it('applies size class correctly', () => {
      render(<Button size="lg">Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('lg');
    });
  });

  describe('states', () => {
    it('disables button when disabled prop is true', () => {
      render(<Button disabled>Button</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('disables button when loading', () => {
      render(<Button isLoading>Button</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    });

    it('shows spinner when loading', () => {
      render(<Button isLoading>Button</Button>);
      expect(screen.getByRole('button').querySelector('.spinner')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onClick handler when clicked', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Button</Button>);

      fireEvent.click(screen.getByRole('button'));

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick} disabled>Button</Button>);

      fireEvent.click(screen.getByRole('button'));

      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<Button>Accessible Button</Button>);
      // If using axe-core
      // const results = await axe(container);
      // expect(results).toHaveNoViolations();
    });

    it('forwards ref correctly', () => {
      const ref = { current: null };
      render(<Button ref={ref}>Button</Button>);
      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
  });
});
```

### Integration Test Template

```typescript
// components/organisms/Header/Header.integration.test.tsx
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Header } from './Header';

const mockNavigation = [
  { id: 'home', label: 'Home', href: '/' },
  { id: 'products', label: 'Products', href: '/products' },
  { id: 'about', label: 'About', href: '/about' },
];

const mockUser = {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
};

describe('Header Integration', () => {
  it('renders navigation items correctly', () => {
    render(
      <Header
        logo={<span>Logo</span>}
        navigation={mockNavigation}
      />
    );

    const nav = screen.getByRole('navigation');
    expect(within(nav).getByText('Home')).toBeInTheDocument();
    expect(within(nav).getByText('Products')).toBeInTheDocument();
    expect(within(nav).getByText('About')).toBeInTheDocument();
  });

  it('shows login button when no user', () => {
    render(
      <Header
        logo={<span>Logo</span>}
        navigation={mockNavigation}
        onLogin={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('shows user menu when authenticated', () => {
    render(
      <Header
        logo={<span>Logo</span>}
        navigation={mockNavigation}
        user={mockUser}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('calls onLogout when logout clicked', async () => {
    const handleLogout = vi.fn();

    render(
      <Header
        logo={<span>Logo</span>}
        navigation={mockNavigation}
        user={mockUser}
        onLogout={handleLogout}
      />
    );

    // Open user menu
    fireEvent.click(screen.getByText('John Doe'));

    // Click logout
    fireEvent.click(screen.getByText('Logout'));

    expect(handleLogout).toHaveBeenCalledTimes(1);
  });
});
```

## Path Aliases Configuration

### TypeScript (tsconfig.json)

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/components/*": ["src/components/*"],
      "@/components": ["src/components/index.ts"],
      "@/atoms/*": ["src/components/atoms/*"],
      "@/molecules/*": ["src/components/molecules/*"],
      "@/organisms/*": ["src/components/organisms/*"],
      "@/templates/*": ["src/components/templates/*"],
      "@/hooks/*": ["src/hooks/*"],
      "@/utils/*": ["src/utils/*"],
      "@/design-tokens/*": ["src/design-tokens/*"]
    }
  }
}
```

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/atoms': path.resolve(__dirname, './src/components/atoms'),
      '@/molecules': path.resolve(__dirname, './src/components/molecules'),
      '@/organisms': path.resolve(__dirname, './src/components/organisms'),
      '@/templates': path.resolve(__dirname, './src/components/templates'),
    },
  },
});
```

## Best Practices

### 1. Consistent Export Patterns

```typescript
// Every component folder should have index.ts
// atoms/Button/index.ts
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';
```

### 2. Clear Prop Typing

```typescript
// Always export prop interfaces for composition
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}
```

### 3. Framework-Agnostic Logic

```typescript
// Extract logic that can be shared across frameworks
// utils/formatPrice.ts
export function formatPrice(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}
```

## When to Use This Skill

- Setting up Atomic Design in a new project
- Migrating existing components to atomic structure
- Integrating with Storybook documentation
- Configuring testing infrastructure
- Establishing framework-specific patterns

## Related Skills

- `atomic-design-fundamentals` - Core methodology overview
- `atomic-design-atoms` - Creating atomic components
- `atomic-design-molecules` - Composing atoms into molecules
- `atomic-design-organisms` - Building complex organisms
- `atomic-design-templates` - Page layouts without content
