/**
 * MemoryQueryMessageCard Component
 *
 * Renders memory query events.
 */

import type React from 'react';
import { graphql, useFragment } from 'react-relay';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import type { MemoryQueryMessageCard_message$key } from './__generated__/MemoryQueryMessageCard_message.graphql.ts';
import {
  MessageHeader,
  type MessageRoleInfo,
  MessageWrapper,
  RawJsonView,
  useRawJsonToggle,
} from './shared.tsx';

const MemoryQueryMessageCardFragment = graphql`
  fragment MemoryQueryMessageCard_message on MemoryQueryMessage {
    id
    timestamp
    rawJson
    question
    route
    durationMs
    resultCount
  }
`;

interface MemoryQueryMessageCardProps {
  fragmentRef: MemoryQueryMessageCard_message$key;
}

/**
 * Get role info for memory query message
 */
function getMemoryQueryRoleInfo(): MessageRoleInfo {
  return {
    label: 'Memory Query',
    className: 'role-memory-query',
    icon: '🧠',
  };
}

export function MemoryQueryMessageCard({
  fragmentRef,
}: MemoryQueryMessageCardProps): React.ReactElement {
  const data = useFragment(MemoryQueryMessageCardFragment, fragmentRef);
  const { showRawJson, toggleRawJson } = useRawJsonToggle();

  const roleInfo = getMemoryQueryRoleInfo();

  const badges = (
    <HStack gap="xs">
      {data.route && <Badge variant="info">{data.route}</Badge>}
      {data.resultCount != null && (
        <Badge variant="default">{data.resultCount} results</Badge>
      )}
      {data.durationMs != null && (
        <Badge variant="default">{data.durationMs}ms</Badge>
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
            borderLeft: '3px solid #7ee787',
            paddingLeft: '12px',
            marginTop: '8px',
          }}
        >
          <VStack gap="xs" align="stretch">
            {data.question && (
              <VStack gap="xs" align="stretch">
                <Text size="sm" color="muted">
                  Question:
                </Text>
                <Text size="sm" style={{ fontStyle: 'italic' }}>
                  {data.question}
                </Text>
              </VStack>
            )}

            {data.route && (
              <HStack gap="sm">
                <Text size="sm" color="muted">
                  Route:
                </Text>
                <Text size="sm">{data.route}</Text>
              </HStack>
            )}
          </VStack>
        </Box>
      )}
    </MessageWrapper>
  );
}
