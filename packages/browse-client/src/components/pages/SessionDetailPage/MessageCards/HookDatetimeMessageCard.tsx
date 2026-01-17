/**
 * HookDatetimeMessageCard Component
 *
 * Renders datetime injection events.
 */

import type React from 'react';
import { graphql, useFragment } from 'react-relay';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import type { HookDatetimeMessageCard_message$key } from './__generated__/HookDatetimeMessageCard_message.graphql.ts';
import {
  MessageHeader,
  type MessageRoleInfo,
  MessageWrapper,
  RawJsonView,
  useRawJsonToggle,
} from './shared.tsx';

const HookDatetimeMessageCardFragment = graphql`
  fragment HookDatetimeMessageCard_message on HookDatetimeMessage {
    id
    timestamp
    rawJson
    plugin
    datetime
    durationMs
  }
`;

interface HookDatetimeMessageCardProps {
  fragmentRef: HookDatetimeMessageCard_message$key;
}

/**
 * Get role info for hook datetime message
 */
function getHookDatetimeRoleInfo(): MessageRoleInfo {
  return {
    label: 'Datetime',
    color: '#f0883e',
    icon: '🕐',
  };
}

export function HookDatetimeMessageCard({
  fragmentRef,
}: HookDatetimeMessageCardProps): React.ReactElement {
  const data = useFragment(HookDatetimeMessageCardFragment, fragmentRef);
  const { showRawJson, toggleRawJson } = useRawJsonToggle();

  const roleInfo = getHookDatetimeRoleInfo();

  const badges = (
    <HStack gap="xs">
      {data.durationMs && <Badge variant="default">{data.durationMs}ms</Badge>}
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
            borderLeft: '3px solid #f0883e',
            paddingLeft: '12px',
            marginTop: '8px',
          }}
        >
          <HStack gap="sm">
            <Text size="sm" color="muted">
              Time:
            </Text>
            <Text size="sm" weight="medium" style={{ fontFamily: 'monospace' }}>
              {data.datetime ?? 'unknown'}
            </Text>
          </HStack>
        </Box>
      )}
    </MessageWrapper>
  );
}
