/**
 * ExposedToolCallMessageCard Component
 *
 * Renders exposed tool call events.
 */

import type React from 'react';
import { graphql, useFragment } from 'react-relay';
import { Box } from '@/components/atoms/Box.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import type { ExposedToolCallMessageCard_message$key } from './__generated__/ExposedToolCallMessageCard_message.graphql.ts';
import {
  MessageHeader,
  type MessageRoleInfo,
  MessageWrapper,
  RawJsonView,
  useRawJsonToggle,
} from './shared.tsx';

const ExposedToolCallMessageCardFragment = graphql`
  fragment ExposedToolCallMessageCard_message on ExposedToolCallMessage {
    id
    timestamp
    rawJson
    tool
    prefixedName
    input
  }
`;

interface ExposedToolCallMessageCardProps {
  fragmentRef: ExposedToolCallMessageCard_message$key;
}

/**
 * Get role info for exposed tool call message
 */
function getExposedToolCallRoleInfo(): MessageRoleInfo {
  return {
    label: 'Exposed Tool Call',
    className: 'role-exposed-tool-call',
    icon: '🔌',
  };
}

export function ExposedToolCallMessageCard({
  fragmentRef,
}: ExposedToolCallMessageCardProps): React.ReactElement {
  const data = useFragment(ExposedToolCallMessageCardFragment, fragmentRef);
  const { showRawJson, toggleRawJson } = useRawJsonToggle();

  const roleInfo = getExposedToolCallRoleInfo();

  return (
    <MessageWrapper type="han_event" showRawJson={showRawJson}>
      <MessageHeader
        roleInfo={roleInfo}
        timestamp={data.timestamp}
        showRawJson={showRawJson}
        onToggleRawJson={toggleRawJson}
      />

      {showRawJson ? (
        <RawJsonView rawJson={data.rawJson ?? null} />
      ) : (
        <Box
          style={{
            borderLeft: '3px solid #a371f7',
            paddingLeft: '12px',
            marginTop: '8px',
          }}
        >
          <VStack gap="xs" align="stretch">
            <HStack gap="sm">
              <Text size="sm" color="muted">
                Tool:
              </Text>
              <Text size="sm" weight={500}>
                {data.tool ?? data.prefixedName ?? 'unknown'}
              </Text>
            </HStack>

            {data.input && (
              <VStack gap="xs" align="stretch">
                <Text size="sm" color="muted">
                  Input:
                </Text>
                <pre
                  style={{
                    fontSize: '12px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    backgroundColor: '#161b22',
                    padding: '8px',
                    borderRadius: '6px',
                    margin: 0,
                  }}
                >
                  <code>{data.input}</code>
                </pre>
              </VStack>
            )}
          </VStack>
        </Box>
      )}
    </MessageWrapper>
  );
}
