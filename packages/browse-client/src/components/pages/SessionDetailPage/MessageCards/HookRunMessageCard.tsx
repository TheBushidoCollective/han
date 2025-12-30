/**
 * HookRunMessageCard Component
 *
 * Renders hook execution start events.
 */

import type React from 'react';
import { graphql, useFragment } from 'react-relay';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import type { HookRunMessageCard_message$key } from './__generated__/HookRunMessageCard_message.graphql.ts';
import {
  MessageHeader,
  type MessageRoleInfo,
  MessageWrapper,
  RawJsonView,
  useRawJsonToggle,
} from './shared.tsx';

const HookRunMessageCardFragment = graphql`
  fragment HookRunMessageCard_message on HookRunMessage {
    id
    timestamp
    rawJson
    plugin
    hook
    directory
    cached
  }
`;

interface HookRunMessageCardProps {
  fragmentRef: HookRunMessageCard_message$key;
}

/**
 * Get role info for hook run message
 */
function getHookRunRoleInfo(): MessageRoleInfo {
  return {
    label: 'Hook Run',
    color: '#a371f7',
    icon: '🎣',
  };
}

export function HookRunMessageCard({
  fragmentRef,
}: HookRunMessageCardProps): React.ReactElement {
  const data = useFragment(HookRunMessageCardFragment, fragmentRef);
  const { showRawJson, toggleRawJson } = useRawJsonToggle();

  const roleInfo = getHookRunRoleInfo();

  const badges = (
    <HStack gap="xs">
      {data.cached && <Badge variant="info">Cached</Badge>}
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
            borderLeft: '3px solid #6e40c9',
            paddingLeft: '12px',
            marginTop: '8px',
          }}
        >
          <VStack gap="xs" align="stretch">
            <HStack gap="sm">
              <Text size="sm" color="muted">
                Plugin:
              </Text>
              <Text size="sm" weight="medium">
                {data.plugin ?? 'unknown'}
              </Text>
            </HStack>

            <HStack gap="sm">
              <Text size="sm" color="muted">
                Hook:
              </Text>
              <Text size="sm" weight="medium">
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
          </VStack>
        </Box>
      )}
    </MessageWrapper>
  );
}
