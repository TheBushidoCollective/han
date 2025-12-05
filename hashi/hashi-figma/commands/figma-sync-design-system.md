---
name: figma-sync-design-system
description: Sync design system components between Figma and code using Code Connect mappings
---

# Sync Design System Components

## Synopsis

Synchronize design system components between Figma and codebase using Code Connect mappings. Identifies gaps, generates missing components, updates existing ones, and creates bidirectional links between design and code.

## Description

You are tasked with synchronizing a design system between Figma and the codebase using the Figma MCP server and Code Connect. This command analyzes both Figma components and code components to identify discrepancies and facilitate keeping design and code in sync.

## Implementation

Inventories all Figma components via MCP server and scans codebase for component library. Compares component sets to identify missing, outdated, or unmapped components. Generates Code Connect configuration files to establish bidirectional mapping between Figma designs and code implementations.

## Your Task

1. **Inventory Figma Components**:
   - Use Figma MCP tools to list all components in the file
   - Group components by category (buttons, inputs, cards, etc.)
   - Identify component variants and properties
   - Note component descriptions and documentation

2. **Inventory Code Components**:
   - Scan the codebase for existing component library
   - Identify component files and their exports
   - Check for existing Code Connect configurations
   - Map components to Figma equivalents

3. **Analyze Gaps**:
   - Identify Figma components without code implementations
   - Identify code components without Figma designs
   - Note variant mismatches (Figma has variants code doesn't)
   - Find naming inconsistencies

4. **Create Sync Plan**:
   - Prioritize which components to sync first
   - Determine if generating new code or updating existing
   - Plan Code Connect mapping creation/updates
   - Identify breaking changes that need migration

5. **Execute Sync**:
   Based on user preference, either:
   - **Generate missing components**: Create code for Figma-only components
   - **Update existing components**: Align code with Figma changes
   - **Create Code Connect mappings**: Link existing code to Figma
   - **Document discrepancies**: Report on mismatches without changing code

## Code Connect Integration

When creating or updating Code Connect mappings:

```typescript
// Button.figma.tsx
import figma from '@figma/code-connect';
import { Button } from './Button';

figma.connect(
  Button,
  'https://www.figma.com/file/abc123?node-id=1:234',
  {
    props: {
      variant: figma.enum('Variant', {
        Primary: 'primary',
        Secondary: 'secondary',
      }),
      size: figma.enum('Size', {
        Small: 'sm',
        Medium: 'md',
        Large: 'lg',
      }),
      disabled: figma.boolean('Disabled'),
      children: figma.string('Label'),
    },
    example: ({ variant, size, disabled, children }) => (
      <Button variant={variant} size={size} disabled={disabled}>
        {children}
      </Button>
    ),
  }
);
```

## Sync Report Format

Provide a comprehensive report:

```markdown
# Design System Sync Report

Generated: [date]
Figma File: [file name and URL]
Code Location: [path to component library]

## Summary

- Total Figma Components: 45
- Total Code Components: 38
- Synced Components: 35
- Needs Generation: 10
- Needs Update: 3
- Needs Code Connect: 7

## Components Needing Action

### Generate (Figma → Code)

1. **AlertDialog**
   - Variants: Info, Warning, Error, Success
   - Props: title, message, onClose, onConfirm
   - Figma: [URL]

2. **Tooltip**
   - Variants: Top, Right, Bottom, Left
   - Props: content, trigger, delay
   - Figma: [URL]

### Update (Align Code with Figma)

1. **Button**
   - Missing variant: Ghost
   - New prop: iconPosition (left/right)
   - Action: Add variant and prop to code

### Create Code Connect

1. **Card**
   - Code exists at: src/components/Card/Card.tsx
   - Figma: [URL]
   - Action: Create Card.figma.tsx mapping

## Recommendations

1. Consolidate Button and IconButton components
2. Standardize size prop values across all components
3. Add missing documentation to Input component
4. Consider deprecating old Badge variants
```

## Best Practices

1. **Component Naming**:
   - Keep names consistent between Figma and code
   - Use PascalCase for component names
   - Match variant names exactly (case-sensitive)

2. **Variant Mapping**:
   - Map Figma variant properties to code props
   - Handle boolean variants properly
   - Support all variant combinations
   - Provide sensible defaults

3. **Documentation**:
   - Sync component descriptions from Figma
   - Document prop types and accepted values
   - Include usage examples
   - Note any differences between Figma and code

4. **Validation**:
   - Test all generated components compile
   - Verify variants render correctly
   - Check accessibility compliance
   - Validate against design system guidelines

## Workflow Options

Ask the user which workflow they prefer:

1. **Full Sync**: Generate all missing components, update existing ones, create all Code Connect mappings
2. **Partial Sync**: Only sync specified components or categories
3. **Report Only**: Generate sync report without making changes
4. **Code Connect Only**: Only create/update Code Connect mappings for existing components

## Additional Deliverables

1. **Migration Guide**:
   - If updating existing components, document breaking changes
   - Provide codemod scripts if possible
   - List all components affected

2. **Testing Plan**:
   - Visual regression test suggestions
   - Component test updates needed
   - Storybook story generation

3. **Documentation Updates**:
   - Updated component documentation
   - Design system guidelines
   - Usage examples

## Notes

- Preserve existing component behavior unless explicitly changing
- Maintain backwards compatibility when possible
- Use design tokens from Figma variables
- Consider responsive behavior and breakpoints
- Test dark mode if supported
- Validate accessibility (WCAG AA minimum)
