# Storybook

Validation and quality enforcement for Storybook projects, ensuring stories always build and render correctly.

## What This Plugin Provides

### Validation Hooks

- **Storybook Build Validation**: Runs `npm run build-storybook` to ensure all stories build successfully without errors
- **Story Rendering**: Validates that all component stories render correctly and don't throw runtime errors
- **Type Safety**: Ensures TypeScript stories have proper type annotations and type-safe args

### Skills

This plugin provides comprehensive Storybook expertise across five key areas:

- **storybook-story-writing**: Creating well-structured stories using CSF3 format, showcasing component variations, and following best practices
- **storybook-args-controls**: Configuring interactive controls and args for dynamic component exploration with proper type constraints
- **storybook-component-documentation**: Auto-generating comprehensive documentation using autodocs, MDX, and JSDoc comments
- **storybook-play-functions**: Writing automated interaction tests within stories to verify component behavior and user interactions
- **storybook-configuration**: Setting up Storybook with optimal configuration, addons, and framework-specific integrations

## Installation

```bash
han plugin install storybook
```

## Usage

Once installed, this plugin automatically validates your Storybook build:

- When you finish a conversation with Claude Code (Stop hook)
- When Claude Code agents complete their work (SubagentStop hook)
- Before commits (when combined with git hooks)

### Build Validation

The plugin runs `npm run build-storybook` in directories containing a `.storybook` folder. This ensures:

1. All stories are valid and can be compiled
2. No TypeScript errors exist in story files
3. No runtime errors occur during rendering
4. All dependencies are properly imported
5. Component props are correctly used

### Package.json Script

Ensure your project has a `build-storybook` script:

```json
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  }
}
```

## What Gets Validated

### Story Files

- ✅ CSF3 format compliance
- ✅ TypeScript type safety
- ✅ Valid args and argTypes
- ✅ Proper imports and exports
- ✅ Component references exist

### Configuration

- ✅ Valid `.storybook/main.ts` configuration
- ✅ Working preview configuration
- ✅ Addon compatibility
- ✅ Framework integration

### Build Output

- ✅ All stories compile successfully
- ✅ No console errors during build
- ✅ Assets are properly bundled
- ✅ Static build is generated

## Requirements

- **Storybook** 7.0 or higher (8.0+ recommended)
- **Node.js** 18 or higher
- **npm** or **yarn** for running build scripts
- A `.storybook` directory in your project

## Supported Frameworks

This plugin works with all Storybook-supported frameworks:

- React (Vite, Webpack, Next.js)
- Vue 3 (Vite, Webpack)
- Angular
- Web Components
- Svelte
- Solid
- Preact

## Common Issues

### Build Script Not Found

**Error**: `npm ERR! missing script: build-storybook`

**Solution**: Add the script to your package.json:

```json
{
  "scripts": {
    "build-storybook": "storybook build"
  }
}
```

### TypeScript Errors in Stories

**Error**: Type errors in story files

**Solution**: Ensure proper types are imported and used:

```typescript
import type { Meta, StoryObj } from '@storybook/react';

const meta = {
  component: Button,
} satisfies Meta<typeof Button>;

type Story = StoryObj<typeof meta>;
```

### Build Fails on Missing Dependencies

**Error**: Module not found during build

**Solution**: Install missing dependencies:

```bash
npm install @storybook/addon-essentials --save-dev
```

## Customization

### Override Build Command

If you use a custom build script, create a `han-config.yml` in your project root:

```yaml
plugins:
  storybook:
    hooks:
      storybook-build-validation:
        command: "npm run custom-storybook-build"
```

### Disable for Specific Projects

In a monorepo, disable validation for specific packages:

```yaml
plugins:
  storybook:
    hooks:
      storybook-build-validation:
        enabled: false
```

## Best Practices

### Always Run Locally First

Before relying on the hook, test your build locally:

```bash
npm run build-storybook
```

### Fix Warnings Early

Don't ignore build warnings—they often indicate real issues:

```
Warning: Component 'Button' is missing a display name
```

### Keep Stories Simple

Complex logic in stories can break builds. Move complexity to components:

```typescript
// ❌ Bad - Complex logic in story
export const Complex: Story = {
  render: (args) => {
    const [state, setState] = useState();
    // Complex logic...
    return <Component {...args} />;
  },
};

// ✅ Good - Logic in component
export const Complex: Story = {
  args: {
    // Simple args only
  },
};
```

### Use TypeScript

TypeScript catches errors before build time:

```typescript
// Catches type errors immediately
const meta = {
  component: Button,
  args: {
    invalidProp: true,  // TypeScript error!
  },
} satisfies Meta<typeof Button>;
```
