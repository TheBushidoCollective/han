# Ink

Advanced Ink skills for building beautiful, interactive terminal UIs with React.

## Overview

Ink is React for the terminal - it lets you build interactive command-line apps using React components. This buki provides comprehensive skills for creating production-quality terminal interfaces.

## Skills Included

### ink-component-patterns

Master component architecture and common patterns for terminal UIs:

- Functional components with TypeScript
- Built-in components (Box, Text, Newline, Spacer)
- Layout patterns (vertical stack, horizontal row, centered content)
- Common UI patterns (lists, status messages, progress indicators)
- Collapsible sections and interactive components
- Best practices and anti-patterns

### ink-hooks-state

Advanced state management and React hooks for Ink applications:

- Core hooks (useState, useEffect, useRef)
- Ink-specific hooks (useInput, useApp, useStdout, useFocus)
- Custom hooks for common patterns
- Async state management
- Promise-based flow control
- Keyboard input handling
- Terminal dimension detection

### ink-layout-styling

Create beautiful layouts with Flexbox and styling:

- Flexbox-based layout with Box component
- Spacing (margin, padding, directional spacing)
- Alignment and justification
- Dimensions (width, height, min/max constraints)
- Borders and border styles
- Text styling (colors, formatting, wrapping)
- Layout patterns (cards, split layouts, headers/footers, grids)
- Responsive layouts
- Utility components

## Use Cases

- **CLI Tools**: Build interactive command-line applications
- **Developer Tools**: Create rich terminal interfaces for development workflows
- **Build Systems**: Display build progress and status
- **Package Managers**: Show installation progress and package information
- **Testing Frameworks**: Display test results with beautiful formatting
- **Monitoring Tools**: Real-time dashboards in the terminal

## Example: Simple Status Display

```tsx
import { Box, Text } from 'ink';
import React, { useState, useEffect } from 'react';

interface StatusProps {
  onComplete: () => void;
}

const Status: React.FC<StatusProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'loading' | 'complete'>('loading');

  useEffect(() => {
    setTimeout(() => {
      setPhase('complete');
      onComplete();
    }, 2000);
  }, [onComplete]);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🚀 My CLI App
        </Text>
      </Box>

      {phase === 'loading' && (
        <Text color="yellow">⏳ Loading...</Text>
      )}

      {phase === 'complete' && (
        <Box flexDirection="column">
          <Text color="green">✅ Complete!</Text>
          <Box marginTop={1}>
            <Text color="blue">💡 Next steps here</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};
```

## Integration with TypeScript

All skills emphasize TypeScript best practices:

- Proper prop type definitions
- Interface-based component APIs
- Type-safe event handlers
- Generic hooks for reusable logic

## Resources

- [Ink Documentation](https://github.com/vadimdemedes/ink)
- [Ink Examples](https://github.com/vadimdemedes/ink/tree/master/examples)
- [React Hooks](https://react.dev/reference/react)
- [Flexbox Guide](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)

## Real-World Examples

This buki's patterns are used in production tools like:

- `npx create-next-app` - Next.js project scaffolding
- `npm` - Package manager output
- `gatsby` - Build progress and development server
- `@anthropic-ai/claude-agent-sdk` - Claude agent development

## License

MIT
