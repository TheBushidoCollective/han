/**
 * SentimentAnalysisMessageCard Component
 *
 * Renders sentiment analysis events.
 */

import type React from 'react';
import { graphql, useFragment } from 'react-relay';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import type { SentimentAnalysisMessageCard_message$key } from './__generated__/SentimentAnalysisMessageCard_message.graphql.ts';
import {
  MessageHeader,
  type MessageRoleInfo,
  MessageWrapper,
  RawJsonView,
  useRawJsonToggle,
} from './shared.tsx';

const SentimentAnalysisMessageCardFragment = graphql`
  fragment SentimentAnalysisMessageCard_message on SentimentAnalysisMessage {
    id
    timestamp
    rawJson
    sentimentScore
    sentimentLevel
    frustrationScore
    frustrationLevel
    signals
    analyzedMessageId
  }
`;

interface SentimentAnalysisMessageCardProps {
  fragmentRef: SentimentAnalysisMessageCard_message$key;
}

/**
 * Get role info for sentiment analysis message
 */
function getSentimentRoleInfo(level: string): MessageRoleInfo {
  const icons: Record<string, string> = {
    positive: '😊',
    neutral: '😐',
    negative: '😟',
  };
  return {
    label: 'Sentiment',
    className: 'role-sentiment-analysis',
    icon: icons[level] ?? '📊',
  };
}

/**
 * Get color for sentiment level
 */
function getSentimentColor(level: string): string {
  switch (level) {
    case 'positive':
      return '#3fb950';
    case 'negative':
      return '#f85149';
    default:
      return '#8b949e';
  }
}

export function SentimentAnalysisMessageCard({
  fragmentRef,
}: SentimentAnalysisMessageCardProps): React.ReactElement {
  const data = useFragment(SentimentAnalysisMessageCardFragment, fragmentRef);
  const { showRawJson, toggleRawJson } = useRawJsonToggle();

  const roleInfo = getSentimentRoleInfo(data.sentimentLevel ?? 'neutral');
  const sentimentColor = getSentimentColor(data.sentimentLevel ?? 'neutral');

  const badges = (
    <HStack gap="xs">
      <Badge
        variant={
          data.sentimentLevel === 'positive'
            ? 'success'
            : data.sentimentLevel === 'negative'
              ? 'danger'
              : 'default'
        }
      >
        {data.sentimentLevel ?? 'neutral'}
      </Badge>
      {data.frustrationLevel && (
        <Badge variant="warning">{data.frustrationLevel} frustration</Badge>
      )}
    </HStack>
  );

  return (
    <MessageWrapper type="han_event" showRawJson={showRawJson}>
      <MessageHeader
        roleInfo={roleInfo}
        timestamp={data.timestamp}
        badges={badges}
        showRawJson={showRawJson}
        onToggleRawJson={toggleRawJson}
      />

      {showRawJson ? (
        <RawJsonView rawJson={data.rawJson ?? null} />
      ) : (
        <Box
          style={{
            borderLeft: `3px solid ${sentimentColor}`,
            paddingLeft: '12px',
            marginTop: '8px',
          }}
        >
          <VStack gap="xs" align="stretch">
            <HStack gap="sm">
              <Text size="sm" color="muted">
                Score:
              </Text>
              <Text size="sm" weight={500} style={{ color: sentimentColor }}>
                {data.sentimentScore?.toFixed(2) ?? 'N/A'}
              </Text>
            </HStack>

            {data.frustrationScore != null && (
              <HStack gap="sm">
                <Text size="sm" color="muted">
                  Frustration:
                </Text>
                <Text size="sm" style={{ color: '#f0883e' }}>
                  {data.frustrationScore.toFixed(1)}/10
                </Text>
              </HStack>
            )}

            {data.signals && data.signals.length > 0 && (
              <VStack gap="xs" align="stretch">
                <Text size="sm" color="muted">
                  Signals:
                </Text>
                <HStack gap="xs" style={{ flexWrap: 'wrap' }}>
                  {data.signals.map((signal) => (
                    <Badge key={signal} variant="default">
                      {signal}
                    </Badge>
                  ))}
                </HStack>
              </VStack>
            )}
          </VStack>
        </Box>
      )}
    </MessageWrapper>
  );
}
