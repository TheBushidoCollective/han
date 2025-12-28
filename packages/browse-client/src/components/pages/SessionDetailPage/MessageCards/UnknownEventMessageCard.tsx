/**
 * UnknownEventMessageCard Component
 *
 * Fallback component for unknown or future event types.
 */

import type React from 'react';
import { graphql, useFragment } from 'react-relay';
import { Badge } from '@/components/atoms/Badge.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import type { UnknownEventMessageCard_message$key } from './__generated__/UnknownEventMessageCard_message.graphql.ts';
import {
  MessageHeader,
  type MessageRoleInfo,
  MessageWrapper,
  RawJsonView,
  useRawJsonToggle,
} from './shared.tsx';

const UnknownEventMessageCardFragment = graphql`
  fragment UnknownEventMessageCard_message on UnknownEventMessage {
    id
    timestamp
    rawJson
    messageType
    eventType
  }
`;

interface UnknownEventMessageCardProps {
  fragmentRef: UnknownEventMessageCard_message$key;
}

/**
 * Get role info for unknown event message
 */
function getUnknownEventRoleInfo(): MessageRoleInfo {
  return {
    label: 'Unknown Event',
    className: 'role-unknown-event',
    icon: '❓',
  };
}

export function UnknownEventMessageCard({
  fragmentRef,
}: UnknownEventMessageCardProps): React.ReactElement {
  const data = useFragment(UnknownEventMessageCardFragment, fragmentRef);
  const { showRawJson, toggleRawJson } = useRawJsonToggle();

  const roleInfo = getUnknownEventRoleInfo();

  const badges = (
    <HStack gap="xs">
      {data.messageType && <Badge variant="default">{data.messageType}</Badge>}
      {data.eventType && <Badge variant="info">{data.eventType}</Badge>}
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

      {/* Always show raw JSON for unknown events since we don't know the structure */}
      <RawJsonView rawJson={data.rawJson ?? null} />
    </MessageWrapper>
  );
}
