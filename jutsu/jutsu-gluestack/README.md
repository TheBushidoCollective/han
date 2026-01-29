# gluestack-ui

Validation and quality enforcement for gluestack-ui projects with component patterns, accessibility, and theming skills. Includes MCP server integration for component discovery and source code retrieval.

## Overview

This plugin provides TypeScript validation hooks, comprehensive skills, and MCP server integration for building universal UI with gluestack-ui across React and React Native platforms.

## What It Validates

The plugin runs TypeScript type checking on projects containing `gluestack-ui.config.json`:

- TypeScript compilation errors
- Type safety for component props
- Proper typing of theme tokens and design system
- NativeWind/Tailwind CSS class usage

## MCP Server Integration

This plugin includes the `gluestack-ui-mcp-server` which provides direct access to gluestack-ui component source code, documentation, and metadata.

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `list_components` | Lists all 70+ gluestack-ui components |
| `list_component_variants` | Shows NativeWind, Themed, and Unstyled variants for a component |
| `get_directory_structure` | Navigate the gluestack-ui monorepo structure |
| `get_component` | Get complete source code for any component |
| `get_component_demo` | Access Storybook examples and demos |
| `get_component_metadata` | Get TypeScript props and dependency information |

### Environment Variables

The MCP server supports optional environment variables for advanced configuration:

| Variable | Description |
|----------|-------------|
| `GLUESTACK_PATH` | Path to a local clone of the gluestack-ui repository for offline access |
| `GITHUB_TOKEN` | GitHub personal access token for increased API rate limits when accessing components from GitHub |

When neither variable is set, the server fetches components directly from GitHub's public API.

## Skills

This plugin provides the following skills:

- **gluestack-components** - Building UI with gluestack-ui's 50+ universal components including Button, Input, Modal, Select, Toast, Accordion, and more
- **gluestack-theming** - Customizing themes with design tokens, dark mode, NativeWind integration, and Tailwind CSS configuration
- **gluestack-accessibility** - Ensuring WCAG 2.1 AA compliance with WAI-ARIA patterns, screen reader support, keyboard navigation, and focus management
- **gluestack-mcp-tools** - Using the MCP server tools to discover, explore, and retrieve component source code and metadata

## Usage

Skills can be invoked using the Skill tool:

```javascript
Skill("jutsu-gluestack:gluestack-components")
Skill("jutsu-gluestack:gluestack-theming")
Skill("jutsu-gluestack:gluestack-accessibility")
Skill("jutsu-gluestack:gluestack-mcp-tools")
```

Each skill provides specialized knowledge and patterns for gluestack-ui development.

## Quality Hooks

This plugin includes hooks that ensure TypeScript type checks pass before completing work. The hooks use `@thebushidocollective/han` to support both single-package and monorepo projects.

### Monorepo Support

The hooks automatically detect directories with `gluestack-ui.config.json` and run TypeScript checks in each:

```bash
han hook run jutsu-gluestack typecheck
```

This ensures all packages in your monorepo pass TypeScript validation before work is marked complete.

## Installation

Install with the han CLI:

```bash
han plugin install jutsu-gluestack
```

Or use npx (no installation required):

```bash
npx @thebushidocollective/han plugin install jutsu-gluestack
```

## Configuration

The hook configuration in `han-plugin.yml`:

```yaml
hooks:
  typecheck:
    command: "npx -y --package typescript tsc --noEmit"
    dirs_with:
      - "gluestack-ui.config.json"
    if_changed:
      - "**/*.{ts,tsx}"
```

## Project Detection

This plugin activates when your project contains:

- `gluestack-ui.config.json` - gluestack-ui configuration file

## About gluestack-ui

gluestack-ui is a universal UI component library for React and React Native that provides:

- 50+ accessible, unstyled components
- NativeWind (Tailwind CSS) styling integration
- WCAG 2.1 AA accessibility compliance
- Copy-pasteable component architecture
- 40% faster performance than NativeBase
- Support for Next.js, Expo, and React Native

Learn more at [gluestack.io](https://gluestack.io)
