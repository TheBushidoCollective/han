/**
 * SummaryMessageCard Component
 *
 * Renders context summary messages with minimal UI.
 * Summary messages contain summarized context and don't have
 * tool use or thinking blocks.
 */

import type React from 'react';
import { graphql, useFragment } from 'react-relay';
import { VStack } from '@/components/atoms/VStack.tsx';
import { MarkdownContent } from '@/components/organisms/MarkdownContent.tsx';
import type { SummaryMessageCard_message$key } from './__generated__/SummaryMessageCard_message.graphql.ts';
import {
  MessageHeader,
  type MessageRoleInfo,
  MessageWrapper,
  RawJsonView,
  useRawJsonToggle,
} from './shared.tsx';

const SummaryMessageCardFragment = graphql`
  fragment SummaryMessageCard_message on SummaryMessage {
    id
    timestamp
    rawJson
    content
  }
`;

interface SummaryMessageCardProps {
  fragmentRef: SummaryMessageCard_message$key;
}

const SUMMARY_ROLE_INFO: MessageRoleInfo = {
  label: 'Summary',
  className: 'role-summary',
  icon: '📝',
};

export function SummaryMessageCard({
  fragmentRef,
}: SummaryMessageCardProps): React.ReactElement {
  const data = useFragment(SummaryMessageCardFragment, fragmentRef);
  const { showRawJson, toggleRawJson } = useRawJsonToggle();

  return (
    <MessageWrapper type="summary" showRawJson={showRawJson}>
      <MessageHeader
        roleInfo={SUMMARY_ROLE_INFO}
        timestamp={data.timestamp}
        showRawJson={showRawJson}
        onToggleRawJson={toggleRawJson}
      />

      {showRawJson ? (
        <RawJsonView rawJson={data.rawJson ?? null} />
      ) : (
        <VStack className="message-content" gap="sm" align="stretch">
          <MarkdownContent>{data.content ?? ''}</MarkdownContent>
        </VStack>
      )}
    </MessageWrapper>
  );
}
