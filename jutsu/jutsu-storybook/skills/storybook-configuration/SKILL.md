---
name: storybook-configuration
description: Use when setting up or configuring Storybook for a project. Covers main configuration, addons, builders, and framework-specific setup.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# Storybook - Configuration

Configure Storybook for optimal development experience with the right addons, builders, and framework integrations.

## Key Concepts

### Main Configuration

`.storybook/main.ts` is the primary configuration file:

```typescript
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
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

### Preview Configuration

`.storybook/preview.ts` configures how stories are rendered:

```typescript
import type { Preview } from '@storybook/react';
import '../src/index.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: ['light', 'dark'],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
```

### Addons

Addons extend Storybook functionality:

- **@storybook/addon-essentials** - Core addons bundle
- **@storybook/addon-interactions** - Interaction testing
- **@storybook/addon-a11y** - Accessibility testing
- **@storybook/addon-links** - Story navigation
- **@storybook/addon-coverage** - Code coverage
- **storybook-dark-mode** - Dark mode toggle

## Best Practices

### 1. Use TypeScript Configuration

Type-safe configuration prevents errors:

```typescript
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {
      builder: {
        viteConfigPath: './vite.config.ts',
      },
    },
  },
};

export default config;
```

### 2. Configure Story Patterns

Specify where stories are located:

```typescript
const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|ts|tsx)',
    // Include specific directories
    '../components/**/*.stories.tsx',
    '../features/**/*.stories.tsx',
    // Exclude patterns
    '!../src/**/*.test.stories.tsx',
  ],
};
```

### 3. Enable Autodocs

Generate documentation automatically:

```typescript
const config: StorybookConfig = {
  docs: {
    autodocs: 'tag',  // Autodocs for stories with 'autodocs' tag
    // OR
    autodocs: true,   // Autodocs for all stories
  },
};
```

### 4. Configure Essential Addons

Customize addon behavior in preview:

```typescript
import type { Preview } from '@storybook/react';

const preview: Preview = {
  parameters: {
    // Actions addon
    actions: { argTypesRegex: '^on[A-Z].*' },

    // Controls addon
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
      exclude: ['className', 'style'],
    },

    // Viewport addon
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: { width: '375px', height: '667px' },
        },
        tablet: {
          name: 'Tablet',
          styles: { width: '768px', height: '1024px' },
        },
      },
    },

    // Backgrounds addon
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#1a1a1a' },
      ],
    },
  },
};
```

### 5. Add Global Decorators

Wrap all stories with providers:

```typescript
import { Preview } from '@storybook/react';
import { ThemeProvider } from '../src/theme';

const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeProvider>
        <div style={{ padding: '2rem' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};
```

## Common Patterns

### Next.js Configuration

```typescript
import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {
      nextConfigPath: '../next.config.js',
    },
  },
  staticDirs: ['../public'],
  typescript: {
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) => (prop.parent ? !/node_modules/.test(prop.parent.fileName) : true),
    },
  },
};
```

### Vite Configuration

```typescript
import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  async viteFinal(config) {
    return mergeConfig(config, {
      resolve: {
        alias: {
          '@': '/src',
        },
      },
      define: {
        'process.env.STORYBOOK': JSON.stringify(true),
      },
    });
  },
};
```

### Webpack Configuration

```typescript
import type { StorybookConfig } from '@storybook/react-webpack5';
import path from 'path';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  webpackFinal: async (config) => {
    config.resolve = {
      ...config.resolve,
      alias: {
        ...config.resolve?.alias,
        '@': path.resolve(__dirname, '../src'),
      },
    };
    return config;
  },
};
```

### Accessibility Testing

```typescript
import type { Preview } from '@storybook/react';

const preview: Preview = {
  parameters: {
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true,
          },
          {
            id: 'aria-required-attr',
            enabled: true,
          },
        ],
      },
      options: {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa'],
        },
      },
    },
  },
};
```

### Theme Switching

```typescript
import { Preview } from '@storybook/react';
import { useDarkMode } from 'storybook-dark-mode';

const preview: Preview = {
  decorators: [
    (Story) => {
      const isDark = useDarkMode();
      return (
        <ThemeProvider theme={isDark ? darkTheme : lightTheme}>
          <Story />
        </ThemeProvider>
      );
    },
  ],
};
```

### Code Coverage

```typescript
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  addons: [
    '@storybook/addon-coverage',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
};

// In .storybook/test-runner.ts
import type { TestRunnerConfig } from '@storybook/test-runner';

const config: TestRunnerConfig = {
  async postRender(page, context) {
    // Add coverage collection
    await page.coverage.startJSCoverage();
  },
};

export default config;
```

## Advanced Patterns

### Multi-Framework Setup

```typescript
// .storybook/main.react.ts
const config: StorybookConfig = {
  stories: ['../src/react/**/*.stories.tsx'],
  framework: '@storybook/react-vite',
};

// .storybook/main.vue.ts
const config: StorybookConfig = {
  stories: ['../src/vue/**/*.stories.ts'],
  framework: '@storybook/vue3-vite',
};
```

### Custom Addon Development

```typescript
// .storybook/addons/custom-addon/register.tsx
import { addons, types } from '@storybook/manager-api';
import { AddonPanel } from '@storybook/components';
import React from 'react';

addons.register('custom-addon', () => {
  addons.add('custom-addon/panel', {
    type: types.PANEL,
    title: 'Custom Panel',
    render: ({ active, key }) => (
      <AddonPanel active={active} key={key}>
        <div>Custom addon content</div>
      </AddonPanel>
    ),
  });
});

// .storybook/main.ts
const config: StorybookConfig = {
  addons: ['./addons/custom-addon/register'],
};
```

### Manager Configuration

```typescript
// .storybook/manager.ts
import { addons } from '@storybook/manager-api';
import { themes } from '@storybook/theming';

addons.setConfig({
  theme: themes.dark,
  panelPosition: 'right',
  showPanel: true,
  selectedPanel: 'storybook/actions/panel',
  initialActive: 'sidebar',
  sidebar: {
    showRoots: true,
    collapsedRoots: ['other'],
  },
});
```

## Anti-Patterns

### ❌ Don't Skip Framework Type

```typescript
// Bad - No type safety
const config = {
  framework: '@storybook/react-vite',
};
```

```typescript
// Good - Type-safe
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
};
```

### ❌ Don't Hardcode Paths

```typescript
// Bad
const config: StorybookConfig = {
  stories: [
    '/Users/username/project/src/**/*.stories.tsx',
  ],
};
```

```typescript
// Good
const config: StorybookConfig = {
  stories: [
    '../src/**/*.stories.tsx',
  ],
};
```

### ❌ Don't Include Unnecessary Addons

```typescript
// Bad - Too many addons slow down Storybook
const config: StorybookConfig = {
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-actions',      // Included in essentials
    '@storybook/addon-controls',     // Included in essentials
    '@storybook/addon-backgrounds',  // Included in essentials
  ],
};
```

```typescript
// Good - Just essentials covers most needs
const config: StorybookConfig = {
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',  // Additional specialized addon
  ],
};
```

## Related Skills

- **storybook-story-writing**: Writing stories for configured Storybook
- **storybook-component-documentation**: Using documentation addons
- **storybook-play-functions**: Setting up interaction testing addon
