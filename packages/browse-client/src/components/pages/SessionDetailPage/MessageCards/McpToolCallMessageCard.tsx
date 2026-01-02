/**
 * McpToolCallMessageCard Component
 *
 * Renders MCP tool call events with inline result display.
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
import type { McpToolCallMessageCard_message$key } from './__generated__/McpToolCallMessageCard_message.graphql.ts';
import {
  MessageHeader,
  type MessageRoleInfo,
  MessageWrapper,
  RawJsonView,
  useRawJsonToggle,
} from './shared.tsx';

const McpToolCallMessageCardFragment = graphql`
  fragment McpToolCallMessageCard_message on McpToolCallMessage {
    id
    timestamp
    rawJson
    tool
    server
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

interface McpToolCallMessageCardProps {
  fragmentRef: McpToolCallMessageCard_message$key;
}

/**
 * Get role info for MCP tool call message
 */
function getMcpToolCallRoleInfo(): MessageRoleInfo {
  return {
    label: 'MCP Tool Call',
    color: '#8b949e',
    icon: '🔧',
  };
}

export function McpToolCallMessageCard({
  fragmentRef,
}: McpToolCallMessageCardProps): React.ReactElement {
  const data = useFragment(McpToolCallMessageCardFragment, fragmentRef);
  const { showRawJson, toggleRawJson } = useRawJsonToggle();

  const roleInfo = getMcpToolCallRoleInfo();
  const result = data.result;

  const badges = (
    <HStack gap="xs">
      {data.server && <Badge variant="info">{data.server}</Badge>}
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
            borderLeft: `3px solid ${result && !result.success ? '#f85149' : '#58a6ff'}`,
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

            {data.server && (
              <HStack gap="sm">
                <Text size="sm" color="muted">
                  Server:
                </Text>
                <Text size="sm">{data.server}</Text>
              </HStack>
            )}

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
