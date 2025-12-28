/**
 * McpToolResultMessageCard Component
 *
 * Renders MCP tool result events with success/failure status.
 */

import type React from 'react';
import { graphql, useFragment } from 'react-relay';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import type { McpToolResultMessageCard_message$key } from './__generated__/McpToolResultMessageCard_message.graphql.ts';
import {
  MessageHeader,
  type MessageRoleInfo,
  MessageWrapper,
  RawJsonView,
  useRawJsonToggle,
} from './shared.tsx';

const McpToolResultMessageCardFragment = graphql`
  fragment McpToolResultMessageCard_message on McpToolResultMessage {
    id
    timestamp
    rawJson
    tool
    server
    prefixedName
    durationMs
    success
    output
    error
  }
`;

interface McpToolResultMessageCardProps {
  fragmentRef: McpToolResultMessageCard_message$key;
}

/**
 * Get role info for MCP tool result message
 */
function getMcpToolResultRoleInfo(success: boolean): MessageRoleInfo {
  return {
    label: 'MCP Tool Result',
    className: 'role-mcp-tool-result',
    icon: success ? '✅' : '❌',
  };
}

export function McpToolResultMessageCard({
  fragmentRef,
}: McpToolResultMessageCardProps): React.ReactElement {
  const data = useFragment(McpToolResultMessageCardFragment, fragmentRef);
  const { showRawJson, toggleRawJson } = useRawJsonToggle();

  const roleInfo = getMcpToolResultRoleInfo(data.success ?? false);

  const badges = (
    <HStack gap="xs">
      <Badge variant={data.success ? 'success' : 'danger'}>
        {data.success ? 'Success' : 'Failed'}
      </Badge>
      {data.server && <Badge variant="info">{data.server}</Badge>}
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
            borderLeft: `3px solid ${data.success ? '#3fb950' : '#f85149'}`,
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

            {data.error && (
              <VStack gap="xs" align="stretch">
                <Text size="sm" color="muted">
                  Error:
                </Text>
                <Text size="sm" style={{ color: '#f85149' }}>
                  {data.error}
                </Text>
              </VStack>
            )}

            {data.output && (
              <VStack gap="xs" align="stretch">
                <Text size="sm" color="muted">
                  Output:
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
                  <code>{data.output}</code>
                </pre>
              </VStack>
            )}
          </VStack>
        </Box>
      )}
    </MessageWrapper>
  );
}
