/**
 * SummaryMessageCard Component
 *
 * Renders context summary messages with minimal UI.
 * Summary messages contain summarized context and don't have
 * tool use or thinking blocks.
 *
 * Compact summaries (auto-compaction) are displayed with a collapsed view.
 */

import type React from 'react';
import { useState } from 'react';
import { graphql, useFragment } from 'react-relay';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Pressable } from '@/components/atoms/Pressable.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import { MarkdownContent } from '@/components/organisms/MarkdownContent.tsx';
import { colors, spacing } from '@/theme.ts';
import type { SummaryMessageCard_message$key } from './__generated__/SummaryMessageCard_message.graphql.ts';
import {
  MessageHeader,
  type MessageRoleInfo,
  MessageWrapper,
  RawJsonView,
  useRawJsonToggle,
} from './shared.tsx';

const SummaryMessageCardFragment = graphql`
  fragment SummaryMessageCard_message on SummaryMessage {
    id
    timestamp
    rawJson
    content
    isCompactSummary
  }
`;

interface SummaryMessageCardProps {
  fragmentRef: SummaryMessageCard_message$key;
}

const SUMMARY_ROLE_INFO: MessageRoleInfo = {
  label: 'Summary',
  color: '#a371f7',
  icon: '📝',
};

const COMPACT_SUMMARY_ROLE_INFO: MessageRoleInfo = {
  label: 'Auto-compacted',
  color: '#8b949e',
  icon: '📦',
};

export function SummaryMessageCard({
  fragmentRef,
}: SummaryMessageCardProps): React.ReactElement {
  const data = useFragment(SummaryMessageCardFragment, fragmentRef);
  const { showRawJson, toggleRawJson } = useRawJsonToggle();
  const [isExpanded, setIsExpanded] = useState(false);

  const isCompact = data.isCompactSummary ?? false;
  const roleInfo = isCompact ? COMPACT_SUMMARY_ROLE_INFO : SUMMARY_ROLE_INFO;

  // For compact summaries, show a collapsed view by default
  if (isCompact && !isExpanded && !showRawJson) {
    return (
      <Pressable onPress={() => setIsExpanded(true)}>
        <Box
          style={{
            padding: spacing.sm,
            paddingLeft: spacing.md,
            paddingRight: spacing.md,
            backgroundColor: colors.bg.tertiary,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: colors.border.subtle,
            opacity: 0.8,
            width: '100%',
          }}
        >
          <HStack gap="sm" align="center">
            <Text size="sm" color="muted">
              📦
            </Text>
            <Text size="sm" color="muted">
              Context auto-compacted
            </Text>
            <Badge variant="default">Click to expand</Badge>
          </HStack>
        </Box>
      </Pressable>
    );
  }

  return (
    <MessageWrapper type="summary" showRawJson={showRawJson}>
      <MessageHeader
        roleInfo={roleInfo}
        timestamp={data.timestamp}
        showRawJson={showRawJson}
        onToggleRawJson={toggleRawJson}
        badges={
          isCompact && isExpanded ? (
            <Pressable onPress={() => setIsExpanded(false)}>
              <Badge variant="default">Collapse</Badge>
            </Pressable>
          ) : undefined
        }
      />

      {showRawJson ? (
        <RawJsonView rawJson={data.rawJson ?? null} />
      ) : (
        <VStack gap="sm" align="stretch">
          <MarkdownContent>{data.content ?? ''}</MarkdownContent>
        </VStack>
      )}
    </MessageWrapper>
  );
}
