import { Text } from 'ink';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import React, { useMemo } from 'react';

interface MarkdownWrapperProps {
  children: string;
}

// Configure marked globally with terminal renderer
// Type assertion needed because marked-terminal has incomplete types
marked.setOptions({
  // biome-ignore lint/suspicious/noExplicitAny: marked-terminal types incompatible with marked v15
  renderer: new TerminalRenderer() as any,
});

const MarkdownWrapperInner: React.FC<MarkdownWrapperProps> = ({ children }) => {
  // Memoize the parsed markdown to prevent re-parsing on every render
  const output = useMemo(() => {
    try {
      const parsed = marked.parse(children);
      return typeof parsed === 'string' ? parsed.trim() : '';
    } catch (_error) {
      // Fallback to plain text if markdown parsing fails
      return children;
    }
  }, [children]);

  return <Text>{output}</Text>;
};

// Memoize the entire component to prevent re-renders when children haven't changed
export const MarkdownWrapper = React.memo(MarkdownWrapperInner);
