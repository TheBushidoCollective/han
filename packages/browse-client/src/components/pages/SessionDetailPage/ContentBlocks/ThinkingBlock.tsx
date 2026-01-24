/**
 * Thinking Block Component
 *
 * Renders Claude's internal reasoning/thinking with collapsible view.
 * Shows brain emoji and preview, expands to full thinking content.
 */

import type React from 'react';
import { useState } from 'react';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import { MarkdownContent } from '@/components/organisms/MarkdownContent.tsx';

interface ThinkingBlockProps {
  thinking: string;
  preview: string;
  signature?: string | null;
}

export function ThinkingBlock({
  thinking,
  preview,
  signature,
}: ThinkingBlockProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const isLong = thinking.length > 200;

  return (
    <Box className="content-block thinking-block">
      <HStack className="thinking-header" gap="sm" align="center">
        <Text className="thinking-icon" size="md">
          🧠
        </Text>
        <Text size="sm" weight="semibold" color="muted">
          Thinking
        </Text>
        {signature && (
          <Text size="xs" color="muted" style={{ fontFamily: 'monospace' }}>
            ✓ signed
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
      <VStack className="thinking-content" gap="xs">
        {expanded || !isLong ? (
          <MarkdownContent>{thinking}</MarkdownContent>
        ) : (
          <Text className="thinking-preview" color="muted" size="sm">
            {preview}
          </Text>
        )}
      </VStack>
    </Box>
  );
}
