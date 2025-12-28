/**
 * HookResultMessageCard Component
 *
 * Renders hook execution result events with success/failure status.
 */

import type React from 'react';
import { graphql, useFragment } from 'react-relay';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import type { HookResultMessageCard_message$key } from './__generated__/HookResultMessageCard_message.graphql.ts';
import {
  MessageHeader,
  type MessageRoleInfo,
  MessageWrapper,
  RawJsonView,
  useRawJsonToggle,
} from './shared.tsx';

const HookResultMessageCardFragment = graphql`
  fragment HookResultMessageCard_message on HookResultMessage {
    id
    timestamp
    rawJson
    plugin
    hook
    directory
    cached
    durationMs
    exitCode
    success
    output
    error
  }
`;

interface HookResultMessageCardProps {
  fragmentRef: HookResultMessageCard_message$key;
}

/**
 * Get role info for hook result message
 */
function getHookResultRoleInfo(success: boolean): MessageRoleInfo {
  return {
    label: 'Hook Result',
    className: 'role-hook-result',
    icon: success ? '✅' : '❌',
  };
}

export function HookResultMessageCard({
  fragmentRef,
}: HookResultMessageCardProps): React.ReactElement {
  const data = useFragment(HookResultMessageCardFragment, fragmentRef);
  const { showRawJson, toggleRawJson } = useRawJsonToggle();

  const roleInfo = getHookResultRoleInfo(data.success ?? false);

  const badges = (
    <HStack gap="xs">
      <Badge variant={data.success ? 'success' : 'danger'}>
        {data.success ? 'Success' : 'Failed'}
      </Badge>
      {data.cached && <Badge variant="info">Cached</Badge>}
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
                Plugin:
              </Text>
              <Text size="sm" weight={500}>
                {data.plugin ?? 'unknown'}
              </Text>
            </HStack>

            <HStack gap="sm">
              <Text size="sm" color="muted">
                Hook:
              </Text>
              <Text size="sm" weight={500}>
                {data.hook ?? 'unknown'}
              </Text>
            </HStack>

            {data.directory && (
              <HStack gap="sm">
                <Text size="sm" color="muted">
                  Directory:
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
                  {data.directory}
                </Text>
              </HStack>
            )}

            {data.exitCode != null && data.exitCode !== 0 && (
              <HStack gap="sm">
                <Text size="sm" color="muted">
                  Exit code:
                </Text>
                <Text size="sm" style={{ color: '#f85149' }}>
                  {data.exitCode}
                </Text>
              </HStack>
            )}

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
