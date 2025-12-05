---
name: figma-generate-component
description: Generate production-ready code from a Figma component or frame using the Figma MCP server
---

# Generate Component from Figma

## Name

hashi-figma:figma-generate-component - Generate production-ready code from Figma designs

## Synopsis

Convert Figma frames and components into production code (React, Vue, HTML/CSS) using the Figma Desktop MCP server with support for Code Connect mappings and design tokens.

## Description

You are tasked with generating production-ready code from a Figma design using the Figma MCP server. This command bridges the design-to-code workflow by analyzing Figma frames and converting them into semantic, accessible, framework-specific components.

## Implementation

Uses the Figma Desktop MCP server (HTTP transport at `http://127.0.0.1:3845/mcp`) to access selected frames or node IDs from Figma URLs. Leverages Code Connect mappings when available to prefer design system components over generating code from scratch.

## Input Methods

The user can provide Figma context in two ways:

1. **Selection-based**: User has selected a frame in Figma desktop app
2. **Link-based**: User provides a Figma URL with node ID

## Your Task

1. **Understand the Context**:
   - If the user selected a frame in Figma, access it via MCP
   - If the user provided a URL, extract the node ID and access the design
   - If neither is provided, ask the user to either:
     - Select a frame in Figma and try again, OR
     - Provide a Figma URL with a node ID

2. **Analyze the Design**:
   - Use Figma MCP tools to extract the frame structure
   - Identify components, layout, styling, and content
   - Note any design tokens or variables used
   - Check for Code Connect mappings if available

3. **Generate Code**:
   - Ask the user what framework/language they want (React, Vue, HTML/CSS, etc.)
   - Generate clean, production-ready code that matches the design
   - Use semantic HTML and accessible markup
   - Apply proper component patterns for the target framework
   - Use design system components if Code Connect mappings exist
   - Include comments explaining key decisions

4. **Provide Context**:
   - Explain the component structure
   - Note any design tokens that should be added to the design system
   - Suggest any improvements or accessibility enhancements
   - Mention responsive behavior considerations

## Best Practices

- **Semantic HTML**: Use appropriate HTML elements (nav, main, article, etc.)
- **Accessibility**: Include ARIA labels, proper heading hierarchy, keyboard navigation
- **Design Tokens**: Use variables for colors, spacing, typography when possible
- **Component Composition**: Break complex UIs into smaller, reusable components
- **Responsive Design**: Consider mobile, tablet, desktop breakpoints
- **Code Connect**: Prefer mapped components over generating from scratch

## Example Output Format

When generating a React component, structure it like:

```tsx
// ComponentName.tsx
import React from 'react';
import { DesignSystemButton } from '@/components/Button'; // Using Code Connect mapping

interface ComponentNameProps {
  // Props based on Figma variants
}

/**
 * ComponentName - Brief description
 *
 * Figma: [Link to Figma frame]
 * Design tokens used: --color-primary, --spacing-md, --font-heading
 */
export const ComponentName: React.FC<ComponentNameProps> = ({ ...props }) => {
  return (
    // JSX matching Figma layout
  );
};
```

## Validation

Before finishing:

1. Verify the code compiles/is valid syntax
2. Check that layout matches Figma design
3. Ensure all interactive elements are accessible
4. Confirm design tokens are properly referenced
5. Note any missing assets or resources needed

## Notes

- If the Figma MCP server is not connected, provide setup instructions
- If the frame is very complex, offer to break it into multiple components
- Always respect the user's framework preference
- Suggest testing in different viewports/screen sizes
