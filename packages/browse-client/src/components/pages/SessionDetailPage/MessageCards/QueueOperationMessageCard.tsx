/**
 * QueueOperationMessageCard Component
 *
 * Renders queue state change operations.
 */

import type React from 'react';
import { graphql, useFragment } from 'react-relay';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import type { QueueOperationMessageCard_message$key } from './__generated__/QueueOperationMessageCard_message.graphql.ts';
import {
  MessageHeader,
  type MessageRoleInfo,
  MessageWrapper,
  RawJsonView,
  useRawJsonToggle,
} from './shared.tsx';

const QueueOperationMessageCardFragment = graphql`
  fragment QueueOperationMessageCard_message on QueueOperationMessage {
    id
    timestamp
    rawJson
    operation
    queueSessionId
  }
`;

interface QueueOperationMessageCardProps {
  fragmentRef: QueueOperationMessageCard_message$key;
}

/**
 * Get display info for queue operations
 */
function getOperationInfo(operation: string | null): {
  icon: string;
  color: string;
  variant: 'default' | 'info' | 'success' | 'warning' | 'danger';
} {
  switch (operation) {
    case 'enqueue':
      return { icon: '📥', color: '#3fb950', variant: 'success' };
    case 'dequeue':
      return { icon: '📤', color: '#1f6feb', variant: 'info' };
    case 'clear':
      return { icon: '🗑️', color: '#f0883e', variant: 'warning' };
    default:
      return { icon: '📋', color: '#8b949e', variant: 'default' };
  }
}

/**
 * Get role info for queue operation message
 */
function getQueueOperationRoleInfo(operation: string | null): MessageRoleInfo {
  const opInfo = getOperationInfo(operation);
  return {
    label: 'Queue',
    color: '#d29922',
    icon: opInfo.icon,
  };
}

export function QueueOperationMessageCard({
  fragmentRef,
}: QueueOperationMessageCardProps): React.ReactElement {
  const data = useFragment(QueueOperationMessageCardFragment, fragmentRef);
  const { showRawJson, toggleRawJson } = useRawJsonToggle();

  const roleInfo = getQueueOperationRoleInfo(data.operation ?? null);
  const opInfo = getOperationInfo(data.operation ?? null);

  const badges = (
    <HStack gap="xs">
      {data.operation && (
        <Badge variant={opInfo.variant}>
          {data.operation.charAt(0).toUpperCase() + data.operation.slice(1)}
        </Badge>
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
            borderLeft: `3px solid ${opInfo.color}`,
            paddingLeft: '12px',
            marginTop: '8px',
          }}
        >
          <VStack gap="xs" align="stretch">
            <HStack gap="sm">
              <Text size="sm" color="muted">
                Operation:
              </Text>
              <Text size="sm" weight="medium">
                {data.operation ?? 'unknown'}
              </Text>
            </HStack>

            {data.queueSessionId && (
              <HStack gap="sm">
                <Text size="sm" color="muted">
                  Session:
                </Text>
                <Text
                  size="xs"
                  style={{
                    fontFamily: 'monospace',
                    color: '#8b949e',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {data.queueSessionId.length > 30
                    ? `${data.queueSessionId.slice(0, 30)}...`
                    : data.queueSessionId}
                </Text>
              </HStack>
            )}
          </VStack>
        </Box>
      )}
    </MessageWrapper>
  );
}
