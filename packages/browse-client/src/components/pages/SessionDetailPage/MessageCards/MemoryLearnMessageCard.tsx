/**
 * MemoryLearnMessageCard Component
 *
 * Renders memory learn events.
 */

import type React from 'react';
import { graphql, useFragment } from 'react-relay';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import type { MemoryLearnMessageCard_message$key } from './__generated__/MemoryLearnMessageCard_message.graphql.ts';
import {
  MessageHeader,
  type MessageRoleInfo,
  MessageWrapper,
  RawJsonView,
  useRawJsonToggle,
} from './shared.tsx';

const MemoryLearnMessageCardFragment = graphql`
  fragment MemoryLearnMessageCard_message on MemoryLearnMessage {
    id
    timestamp
    rawJson
    domain
    scope
    paths
    append
  }
`;

interface MemoryLearnMessageCardProps {
  fragmentRef: MemoryLearnMessageCard_message$key;
}

/**
 * Get role info for memory learn message
 */
function getMemoryLearnRoleInfo(): MessageRoleInfo {
  return {
    label: 'Memory Learn',
    color: '#3fb950',
    icon: '📝',
  };
}

export function MemoryLearnMessageCard({
  fragmentRef,
}: MemoryLearnMessageCardProps): React.ReactElement {
  const data = useFragment(MemoryLearnMessageCardFragment, fragmentRef);
  const { showRawJson, toggleRawJson } = useRawJsonToggle();

  const roleInfo = getMemoryLearnRoleInfo();

  const badges = (
    <HStack gap="xs">
      {data.scope && <Badge variant="info">{data.scope}</Badge>}
      {data.append !== null && (
        <Badge variant="default">{data.append ? 'Append' : 'Replace'}</Badge>
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
            {data.domain && (
              <HStack gap="sm">
                <Text size="sm" color="muted">
                  Domain:
                </Text>
                <Text size="sm" weight="medium">
                  {data.domain}
                </Text>
              </HStack>
            )}

            {data.scope && (
              <HStack gap="sm">
                <Text size="sm" color="muted">
                  Scope:
                </Text>
                <Text size="sm">{data.scope}</Text>
              </HStack>
            )}

            {data.paths && data.paths.length > 0 && (
              <VStack gap="xs" align="stretch">
                <Text size="sm" color="muted">
                  Paths:
                </Text>
                <Text
                  size="xs"
                  style={{
                    fontFamily: 'monospace',
                    color: '#8b949e',
                  }}
                >
                  {data.paths.join(', ')}
                </Text>
              </VStack>
            )}
          </VStack>
        </Box>
      )}
    </MessageWrapper>
  );
}
