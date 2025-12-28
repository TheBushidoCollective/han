/**
 * Tool Result Block Component
 *
 * Renders the result from a tool execution with error handling,
 * content preview, and image display.
 */

import type React from 'react';
import { useState } from 'react';
import { AnsiText, containsAnsi } from '@/components/atoms/AnsiText.tsx';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';

interface ToolResultBlockProps {
  toolCallId: string;
  content: string;
  isError: boolean;
  isLong: boolean;
  preview: string;
  hasImage: boolean;
}

export function ToolResultBlock({
  content,
  isError,
  isLong,
  preview,
  hasImage,
}: ToolResultBlockProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const displayContent = expanded ? content : preview;
  const hasAnsiCodes = containsAnsi(content);

  // Determine the result indicator
  const getResultIndicator = () => {
    if (isError) {
      return { icon: '❌', label: 'Error', variant: 'danger' as const };
    }
    if (hasImage) {
      return { icon: '🖼️', label: 'Image', variant: 'info' as const };
    }
    return { icon: '✓', label: 'Result', variant: 'success' as const };
  };

  const indicator = getResultIndicator();

  return (
    <Box
      className={`content-block tool-result-block ${isError ? 'result-error' : 'result-success'}`}
    >
      <HStack className="result-header" gap="sm" align="center">
        <Text className="result-icon" size="sm">
          {indicator.icon}
        </Text>
        <Badge variant={indicator.variant}>{indicator.label}</Badge>
        {isLong && (
          <Text size="xs" color="muted">
            {content.length.toLocaleString()} chars
          </Text>
        )}
        {isLong && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            style={{ marginLeft: 'auto', fontSize: '11px' }}
          >
            {expanded ? '▼ Collapse' : '▶ Expand'}
          </Button>
        )}
      </HStack>
      <VStack className="result-content" gap="xs">
        {displayContent ? (
          <pre className="result-output">
            {hasAnsiCodes ? (
              <AnsiText>{displayContent}</AnsiText>
            ) : (
              <code>{displayContent}</code>
            )}
          </pre>
        ) : (
          <Text size="xs" color="muted">
            (empty result)
          </Text>
        )}
      </VStack>
    </Box>
  );
}
