import { Box, Text } from 'ink';
import React from 'react';

interface MarkdownTextProps {
  children: string;
}

/**
 * Simple markdown-like formatter for terminal output
 * Handles basic formatting without requiring heavy dependencies
 */
export const MarkdownText: React.FC<MarkdownTextProps> = ({ children }) => {
  const lines = children.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headers (# ## ###)
    const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = headerMatch[2];
      elements.push(
        <Box key={i} marginTop={level === 1 ? 1 : 0} marginBottom={1}>
          <Text bold color={level === 1 ? 'cyan' : level === 2 ? 'blue' : 'white'}>
            {text}
          </Text>
        </Box>
      );
      continue;
    }

    // Bullet lists (- or *)
    const bulletMatch = line.match(/^[\s]*[-*]\s+(.+)$/);
    if (bulletMatch) {
      const text = bulletMatch[1];
      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      elements.push(
        <Box key={i} marginLeft={Math.floor(indent / 2)}>
          <Text>• {text}</Text>
        </Box>
      );
      continue;
    }

    // Numbered lists (1. 2. etc)
    const numberedMatch = line.match(/^[\s]*(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      const num = numberedMatch[1];
      const text = numberedMatch[2];
      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      elements.push(
        <Box key={i} marginLeft={Math.floor(indent / 2)}>
          <Text>{num}. {text}</Text>
        </Box>
      );
      continue;
    }

    // Code blocks (```)
    if (line.trim() === '```' || line.trim().startsWith('```')) {
      // Skip code fence markers
      continue;
    }

    // Inline code (`code`)
    const codeMatch = line.match(/`([^`]+)`/g);
    if (codeMatch) {
      const parts = line.split(/(`[^`]+`)/);
      elements.push(
        <Box key={i}>
          <Text>
            {parts.map((part, idx) => {
              if (part.startsWith('`') && part.endsWith('`')) {
                return (
                  <Text key={idx} backgroundColor="gray" color="white">
                    {part.slice(1, -1)}
                  </Text>
                );
              }
              return part;
            })}
          </Text>
        </Box>
      );
      continue;
    }

    // Bold (**text**)
    const boldMatch = line.match(/\*\*([^*]+)\*\*/g);
    if (boldMatch) {
      const parts = line.split(/(\*\*[^*]+\*\*)/);
      elements.push(
        <Box key={i}>
          <Text>
            {parts.map((part, idx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <Text key={idx} bold>{part.slice(2, -2)}</Text>;
              }
              return part;
            })}
          </Text>
        </Box>
      );
      continue;
    }

    // Empty lines
    if (line.trim() === '') {
      elements.push(<Box key={i} height={1} />);
      continue;
    }

    // Regular text
    elements.push(
      <Box key={i}>
        <Text wrap="wrap">{line}</Text>
      </Box>
    );
  }

  return <Box flexDirection="column">{elements}</Box>;
};
