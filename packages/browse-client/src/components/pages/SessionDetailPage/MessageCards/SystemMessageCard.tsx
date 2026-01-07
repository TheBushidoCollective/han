/**
 * SystemMessageCard Component
 *
 * Renders system notification messages with subtype and level information.
 */

import type React from 'react';
import { graphql, useFragment } from 'react-relay';
import { Badge } from '@/components/atoms/Badge.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import { MarkdownContent } from '@/components/organisms/MarkdownContent.tsx';
import type { SystemMessageCard_message$key } from './__generated__/SystemMessageCard_message.graphql.ts';
import {
  MessageHeader,
  type MessageRoleInfo,
  MessageWrapper,
  RawJsonView,
  useRawJsonToggle,
} from './shared.tsx';

const SystemMessageCardFragment = graphql`
  fragment SystemMessageCard_message on SystemMessage {
    id
    timestamp
    rawJson
    content
    subtype
    level
    isMeta
  }
`;

interface SystemMessageCardProps {
  fragmentRef: SystemMessageCard_message$key;
}

/**
 * Get display info for system message levels
 */
function getLevelInfo(level: string | null): {
  variant: 'default' | 'info' | 'success' | 'warning' | 'danger';
  icon: string;
} {
  switch (level) {
    case 'error':
      return { variant: 'danger', icon: '❌' };
    case 'warning':
      return { variant: 'warning', icon: '⚠️' };
    case 'success':
      return { variant: 'success', icon: '✅' };
    case 'info':
      return { variant: 'info', icon: 'ℹ️' };
    default:
      return { variant: 'default', icon: '💻' };
  }
}

/**
 * Get role info for system message
 */
function getSystemRoleInfo(level: string | null): MessageRoleInfo {
  const levelInfo = getLevelInfo(level);
  return {
    label: 'System',
    color: '#8b949e',
    icon: levelInfo.icon,
  };
}

export function SystemMessageCard({
  fragmentRef,
}: SystemMessageCardProps): React.ReactElement {
  const data = useFragment(SystemMessageCardFragment, fragmentRef);
  const { showRawJson, toggleRawJson } = useRawJsonToggle();

  const roleInfo = getSystemRoleInfo(data.level ?? null);
  const levelInfo = getLevelInfo(data.level ?? null);

  const badges = (
    <HStack gap="xs">
      {data.subtype && <Badge variant="default">{data.subtype}</Badge>}
      {data.level && <Badge variant={levelInfo.variant}>{data.level}</Badge>}
      {data.isMeta && <Badge variant="info">Meta</Badge>}
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
        <VStack gap="sm" align="stretch" style={{ marginTop: '8px' }}>
          {data.content ? (
            <MarkdownContent>{data.content}</MarkdownContent>
          ) : (
            <Text size="sm" color="muted">
              No content
            </Text>
          )}
        </VStack>
      )}
    </MessageWrapper>
  );
}
