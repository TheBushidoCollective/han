/**
 * Hook Check State Message Card
 *
 * Displays when hooks are checked to determine if validation is needed.
 */

import type React from 'react';
import { graphql, useFragment } from 'react-relay';
import { Box, HStack, Text, VStack } from '@/components/atoms';
import { Badge } from '@/components/atoms/Badge';
import type { HookCheckStateMessageCard_message$key } from './__generated__/HookCheckStateMessageCard_message.graphql';
import {
  MessageHeader,
  type MessageRoleInfo,
  MessageWrapper,
  RawJsonView,
  useRawJsonToggle,
} from './shared.tsx';

const HookCheckStateMessageFragment = graphql`
  fragment HookCheckStateMessageCard_message on HookCheckStateMessage {
    id
    timestamp
    rawJson
    hookType
    fingerprint
    hooksCount
  }
`;

interface HookCheckStateMessageCardProps {
  fragmentRef: HookCheckStateMessageCard_message$key;
}

/**
 * Get role info for hook check state message
 */
function getHookCheckStateRoleInfo(): MessageRoleInfo {
  return {
    label: 'Hook Check',
    color: '#58a6ff',
    icon: '🔍',
  };
}

export function HookCheckStateMessageCard({
  fragmentRef,
}: HookCheckStateMessageCardProps): React.ReactElement {
  const data = useFragment(HookCheckStateMessageFragment, fragmentRef);
  const { showRawJson, toggleRawJson } = useRawJsonToggle();

  const roleInfo = getHookCheckStateRoleInfo();

  const badges = (
    <HStack gap="xs">
      <Badge variant="info">{data.hooksCount} hook(s) pending</Badge>
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
                Hook Type:
              </Text>
              <Text size="sm" weight="medium">
                {data.hookType || 'Unknown'}
              </Text>
            </HStack>

            <HStack gap="sm">
              <Text size="sm" color="muted">
                Fingerprint:
              </Text>
              <Text
                size="xs"
                style={{
                  fontFamily: 'monospace',
                  color: '#8b949e',
                }}
              >
                {data.fingerprint?.substring(0, 16) ?? 'N/A'}...
              </Text>
            </HStack>

            <HStack gap="sm">
              <Text size="sm" color="muted">
                Hooks pending:
              </Text>
              <Text size="sm">{data.hooksCount}</Text>
            </HStack>
          </VStack>
        </Box>
      )}
    </MessageWrapper>
  );
}
