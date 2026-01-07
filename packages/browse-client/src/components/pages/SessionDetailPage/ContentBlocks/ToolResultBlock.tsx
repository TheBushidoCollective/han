/**
 * Tool Result Block Component
 *
 * Renders the result from a tool execution with error handling,
 * content preview, and image display.
 */

import type { CSSProperties, ReactElement } from 'react';
import { useState } from 'react';
import { AnsiText, containsAnsi } from '@/components/atoms/AnsiText.tsx';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import { colors, fonts, radii, spacing } from '@/theme.ts';

interface ToolResultBlockProps {
  toolCallId: string;
  content: string;
  isError: boolean;
  isLong: boolean;
  preview: string;
  hasImage: boolean;
}

const codeBlockStyle: CSSProperties = {
  backgroundColor: colors.bg.primary,
  borderRadius: radii.sm,
  padding: spacing.sm,
  fontFamily: fonts.mono,
  fontSize: 12,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  overflow: 'auto',
  maxHeight: 400,
};

export function ToolResultBlock({
  content,
  isError,
  isLong,
  preview,
  hasImage,
}: ToolResultBlockProps): ReactElement {
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

  const containerStyle: CSSProperties = {
    borderLeft: `3px solid ${isError ? colors.danger : colors.success}`,
    paddingLeft: spacing.sm,
  };

  return (
    <Box style={containerStyle}>
      <HStack gap="sm" align="center">
        <Text size="sm">{indicator.icon}</Text>
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
      <VStack gap="xs" style={{ marginTop: spacing.xs }}>
        {displayContent ? (
          <Box style={codeBlockStyle}>
            {hasAnsiCodes ? (
              <AnsiText>{displayContent}</AnsiText>
            ) : (
              <Text
                size="sm"
                style={{ fontFamily: fonts.mono, color: colors.text.primary }}
              >
                {displayContent}
              </Text>
            )}
          </Box>
        ) : (
          <Text size="xs" color="muted">
            (empty result)
          </Text>
        )}
      </VStack>
    </Box>
  );
}
