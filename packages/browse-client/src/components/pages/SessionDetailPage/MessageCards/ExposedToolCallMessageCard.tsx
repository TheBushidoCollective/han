/**
 * ExposedToolCallMessageCard Component
 *
 * Renders exposed tool call events with inline result display.
 * The result is loaded via DataLoader on the backend.
 * Results update when the parent SessionMessages refetches.
 */

import type React from 'react';
import { graphql, useFragment } from 'react-relay';
import { Badge } from '@/components/atoms/Badge.tsx';
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
    callId
    result {
      id
      success
      durationMs
      result
      error
    }
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
    color: '#d29922',
    icon: '🔌',
  };
}

export function ExposedToolCallMessageCard({
  fragmentRef,
}: ExposedToolCallMessageCardProps): React.ReactElement {
  const data = useFragment(ExposedToolCallMessageCardFragment, fragmentRef);
  const { showRawJson, toggleRawJson } = useRawJsonToggle();

  const roleInfo = getExposedToolCallRoleInfo();
  const result = data.result;

  const badges = (
    <HStack gap="xs">
      {result &&
        (result.success ? (
          <Badge variant="success">{result.durationMs}ms</Badge>
        ) : (
          <Badge variant="danger">Failed</Badge>
        ))}
      {!result && <Badge variant="warning">Pending</Badge>}
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
            borderLeft: `3px solid ${result && !result.success ? '#f85149' : '#a371f7'}`,
            paddingLeft: '12px',
            marginTop: '8px',
          }}
        >
          <VStack gap="xs" align="stretch">
            <HStack gap="sm">
              <Text size="sm" color="muted">
                Tool:
              </Text>
              <Text size="sm" weight="medium">
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

            {/* Show result inline if available */}
            {result && (
              <>
                <HStack gap="sm" style={{ marginTop: '8px' }}>
                  <Text size="sm" color="muted">
                    Status:
                  </Text>
                  <Text
                    size="sm"
                    style={{
                      color: result.success ? '#3fb950' : '#f85149',
                    }}
                  >
                    {result.success ? 'Success' : 'Failed'}
                  </Text>
                  {result.durationMs != null && result.durationMs > 0 && (
                    <Text size="xs" color="muted">
                      ({result.durationMs}ms)
                    </Text>
                  )}
                </HStack>

                {result.error && (
                  <VStack gap="xs" align="stretch">
                    <Text size="sm" color="muted">
                      Error:
                    </Text>
                    <pre
                      style={{
                        fontSize: '12px',
                        overflow: 'auto',
                        maxHeight: '200px',
                        backgroundColor: '#2d1f1f',
                        padding: '8px',
                        borderRadius: '6px',
                        margin: 0,
                        color: '#f85149',
                      }}
                    >
                      <code>{result.error}</code>
                    </pre>
                  </VStack>
                )}

                {result.result && !result.error && (
                  <VStack gap="xs" align="stretch">
                    <Text size="sm" color="muted">
                      Result:
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
                      <code>{result.result}</code>
                    </pre>
                  </VStack>
                )}
              </>
            )}
          </VStack>
        </Box>
      )}
    </MessageWrapper>
  );
}
