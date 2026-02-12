---
name: figma-extract-tokens
description: Extract design tokens and variables from a Figma file to create or update a design system
---

# Extract Design Tokens from Figma

## Name

figma:figma-extract-tokens - Extract design tokens and variables from Figma files

## Synopsis

Extract design tokens (colors, spacing, typography, etc.) from Figma files and generate token files in various formats (CSS Custom Properties, TypeScript, JSON, Style Dictionary, Tailwind config).

## Description

You are tasked with extracting design tokens and variables from a Figma file using the Figma MCP server. This command analyzes Figma variables and variable collections to generate structured token files for your design system.

## Implementation

Connects to the Figma Desktop MCP server to access Figma variables API. Extracts all variable types (colors, numbers, strings, booleans) and organizes them into primitive and semantic token hierarchies. Supports multiple output formats and theming variations.

## Your Task

1. **Access the Figma File**:
   - Use Figma MCP tools to access the current file
   - If no file is open, ask the user to open one in Figma or provide a URL

2. **Extract Variables**:
   - Get all color variables and their values
   - Get spacing/sizing variables
   - Get typography variables (font families, sizes, weights, line heights)
   - Get any other variables (border radius, shadows, etc.)
   - Organize by variable collections if they exist

3. **Analyze Token Structure**:
   - Identify semantic tokens (primary, secondary, etc.)
   - Note primitive tokens (specific values)
   - Detect theming variations (light/dark modes)
   - Check for token hierarchies and references

4. **Generate Token Files**:
   - Ask the user what format they prefer:
     - CSS Custom Properties
     - JavaScript/TypeScript objects
     - JSON
     - Sass/SCSS variables
     - Tailwind config
     - Style Dictionary format
   - Generate properly structured token files
   - Include comments with Figma references

5. **Provide Documentation**:
   - Create a mapping of token names to Figma variables
   - Note any missing tokens that should be added
   - Suggest token naming conventions if inconsistent
   - Document how to use tokens in code

## Output Formats

### CSS Custom Properties

```css
/**
 * Design Tokens - Extracted from Figma
 * File: [Figma file name]
 * Generated: [date]
 */

:root {
  /* Colors - Primitives */
  --color-blue-500: #3b82f6;
  --color-gray-900: #111827;

  /* Colors - Semantic */
  --color-primary: var(--color-blue-500);
  --color-text: var(--color-gray-900);

  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;

  /* Typography */
  --font-family-base: 'Inter', sans-serif;
  --font-size-body: 1rem;
  --line-height-body: 1.5;
}
```

### TypeScript/JavaScript

```typescript
/**
 * Design Tokens - Extracted from Figma
 * File: [Figma file name]
 * Generated: [date]
 */

export const tokens = {
  colors: {
    primitives: {
      blue500: '#3b82f6',
      gray900: '#111827',
    },
    semantic: {
      primary: '#3b82f6',
      text: '#111827',
    },
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
  },
  typography: {
    fontFamily: {
      base: "'Inter', sans-serif",
    },
    fontSize: {
      body: '1rem',
    },
    lineHeight: {
      body: 1.5,
    },
  },
} as const;

export type Tokens = typeof tokens;
```

### Style Dictionary Format

```json
{
  "color": {
    "primitive": {
      "blue": {
        "500": { "value": "#3b82f6" }
      },
      "gray": {
        "900": { "value": "#111827" }
      }
    },
    "semantic": {
      "primary": { "value": "{color.primitive.blue.500}" },
      "text": { "value": "{color.primitive.gray.900}" }
    }
  },
  "spacing": {
    "xs": { "value": "0.25rem" },
    "sm": { "value": "0.5rem" },
    "md": { "value": "1rem" }
  }
}
```

## Best Practices

1. **Token Naming**:
   - Use semantic names for application tokens (primary, secondary)
   - Use descriptive names for primitive tokens (blue-500, spacing-md)
   - Be consistent with naming conventions
   - Use namespacing for organization

2. **Token Organization**:
   - Group related tokens (colors, spacing, typography)
   - Separate primitives from semantics
   - Support theming with token references
   - Document token purposes

3. **Token Values**:
   - Preserve units from Figma (px, rem, em)
   - Convert to appropriate format for target platform
   - Include fallbacks for token references
   - Validate values are valid CSS/code

4. **Maintenance**:
   - Include Figma file reference for traceability
   - Add generation timestamp
   - Note any manual adjustments needed
   - Document how to re-sync from Figma

## Additional Deliverables

After extracting tokens, also provide:

1. **Token Documentation**:
   - Markdown file documenting each token category
   - Usage examples for designers and developers
   - Migration guide if updating existing tokens

2. **Integration Guide**:
   - How to import tokens in the project
   - How to use tokens in components
   - How to extend or override tokens

3. **Validation**:
   - Check for duplicate tokens
   - Note any missing semantic tokens
   - Identify unused variables in Figma
   - Suggest token consolidation opportunities

## Notes

- If variable collections exist, extract them separately
- Note any Figma variables without values
- Identify color mode variations (light/dark)
- Suggest token additions for common use cases not covered
- Provide examples of using tokens in actual components
