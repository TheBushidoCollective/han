/**
 * McpToolCallMessageCard Component
 *
 * Renders MCP tool call events.
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
    className: 'role-mcp-tool-call',
    icon: '🔧',
  };
}

export function McpToolCallMessageCard({
  fragmentRef,
}: McpToolCallMessageCardProps): React.ReactElement {
  const data = useFragment(McpToolCallMessageCardFragment, fragmentRef);
  const { showRawJson, toggleRawJson } = useRawJsonToggle();

  const roleInfo = getMcpToolCallRoleInfo();

  const badges = (
    <HStack gap="xs">
      {data.server && <Badge variant="info">{data.server}</Badge>}
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
            borderLeft: '3px solid #58a6ff',
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
          </VStack>
        </Box>
      )}
    </MessageWrapper>
  );
}
