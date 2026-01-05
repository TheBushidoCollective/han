/**
 * MessageCards Registry and Exports
 *
 * Provides a component registry pattern for type-safe rendering
 * of message types based on __typename discrimination.
 *
 * Uses MessageContext to provide shared metadata (like messageId)
 * to all child components without prop drilling.
 */

import type React from 'react';
import { graphql, useFragment } from 'react-relay';
import type { ContentBlock } from '../types.ts';
import type { MessageCards_message$key } from './__generated__/MessageCards_message.graphql.ts';
import { AssistantMessageCard } from './AssistantMessageCard.tsx';
import { ExposedToolCallMessageCard } from './ExposedToolCallMessageCard.tsx';
import { ExposedToolResultMessageCard } from './ExposedToolResultMessageCard.tsx';
import { FileHistorySnapshotMessageCard } from './FileHistorySnapshotMessageCard.tsx';
import { HookDatetimeMessageCard } from './HookDatetimeMessageCard.tsx';
import { HookFileChangeMessageCard } from './HookFileChangeMessageCard.tsx';
import { HookReferenceMessageCard } from './HookReferenceMessageCard.tsx';
import { HookResultMessageCard } from './HookResultMessageCard.tsx';
import { HookRunMessageCard } from './HookRunMessageCard.tsx';
import { HookScriptMessageCard } from './HookScriptMessageCard.tsx';
import { HookValidationCacheMessageCard } from './HookValidationCacheMessageCard.tsx';
import { HookValidationMessageCard } from './HookValidationMessageCard.tsx';
import { McpToolCallMessageCard } from './McpToolCallMessageCard.tsx';
import { McpToolResultMessageCard } from './McpToolResultMessageCard.tsx';
import { MemoryLearnMessageCard } from './MemoryLearnMessageCard.tsx';
import { MemoryQueryMessageCard } from './MemoryQueryMessageCard.tsx';
import { QueueOperationMessageCard } from './QueueOperationMessageCard.tsx';
import { SentimentAnalysisMessageCard } from './SentimentAnalysisMessageCard.tsx';
import { SummaryMessageCard } from './SummaryMessageCard.tsx';
import { SystemMessageCard } from './SystemMessageCard.tsx';
import { MessageContextProvider } from './shared.tsx';
import { UnknownEventMessageCard } from './UnknownEventMessageCard.tsx';
import { UserMessageCard } from './UserMessageCard.tsx';

// Re-export individual cards for direct use
export { AssistantMessageCard } from './AssistantMessageCard.tsx';
export { ExposedToolCallMessageCard } from './ExposedToolCallMessageCard.tsx';
export { ExposedToolResultMessageCard } from './ExposedToolResultMessageCard.tsx';
export { FileHistorySnapshotMessageCard } from './FileHistorySnapshotMessageCard.tsx';
export { HookDatetimeMessageCard } from './HookDatetimeMessageCard.tsx';
export { HookFileChangeMessageCard } from './HookFileChangeMessageCard.tsx';
export { HookReferenceMessageCard } from './HookReferenceMessageCard.tsx';
export { HookResultMessageCard } from './HookResultMessageCard.tsx';
export { HookRunMessageCard } from './HookRunMessageCard.tsx';
export { HookScriptMessageCard } from './HookScriptMessageCard.tsx';
export { HookValidationCacheMessageCard } from './HookValidationCacheMessageCard.tsx';
export { HookValidationMessageCard } from './HookValidationMessageCard.tsx';
export { McpToolCallMessageCard } from './McpToolCallMessageCard.tsx';
export { McpToolResultMessageCard } from './McpToolResultMessageCard.tsx';
export { MemoryLearnMessageCard } from './MemoryLearnMessageCard.tsx';
export { MemoryQueryMessageCard } from './MemoryQueryMessageCard.tsx';
export { QueueOperationMessageCard } from './QueueOperationMessageCard.tsx';
export { SentimentAnalysisMessageCard } from './SentimentAnalysisMessageCard.tsx';
export { SummaryMessageCard } from './SummaryMessageCard.tsx';
export { SystemMessageCard } from './SystemMessageCard.tsx';
// Re-export shared utilities
export {
  formatRawJson,
  formatTimestamp,
  MessageContextProvider,
  MessageHeader,
  type MessageRoleInfo,
  MessageWrapper,
  RawJsonView,
  useMessageContext,
  useRawJsonToggle,
} from './shared.tsx';
export { UnknownEventMessageCard } from './UnknownEventMessageCard.tsx';
export { UserMessageCard } from './UserMessageCard.tsx';

/**
 * Fragment to determine message type for registry dispatch
 * Includes `id` at the interface level for MessageContext
 */
const MessageCardsFragment = graphql`
  fragment MessageCards_message on Message {
    __typename
    id
    ...UserMessageCard_message
    ...AssistantMessageCard_message
    ...SummaryMessageCard_message
    ...SystemMessageCard_message
    ...FileHistorySnapshotMessageCard_message
    ...HookRunMessageCard_message
    ...HookResultMessageCard_message
    ...HookReferenceMessageCard_message
    ...HookValidationMessageCard_message
    ...HookValidationCacheMessageCard_message
    ...HookScriptMessageCard_message
    ...HookDatetimeMessageCard_message
    ...HookFileChangeMessageCard_message
    ...QueueOperationMessageCard_message
    ...McpToolCallMessageCard_message
    ...McpToolResultMessageCard_message
    ...ExposedToolCallMessageCard_message
    ...ExposedToolResultMessageCard_message
    ...MemoryQueryMessageCard_message
    ...MemoryLearnMessageCard_message
    ...SentimentAnalysisMessageCard_message
    ...UnknownEventMessageCard_message
  }
`;

interface MessageCardProps {
  fragmentRef: MessageCards_message$key;
  toolResultsMap?: Map<string, ContentBlock>;
}

/**
 * MessageCard - Unified component that dispatches to the appropriate
 * card component based on __typename discrimination.
 *
 * Uses the component registry pattern for type-safe rendering.
 * Wraps all cards with MessageContextProvider to share metadata.
 */
export function MessageCard({
  fragmentRef,
  toolResultsMap,
}: MessageCardProps): React.ReactElement | null {
  const data = useFragment(MessageCardsFragment, fragmentRef);

  // Get the card component based on typename
  const cardElement = (() => {
    switch (data.__typename) {
      case 'UserMessage':
        return (
          <UserMessageCard fragmentRef={data} toolResultsMap={toolResultsMap} />
        );

      case 'AssistantMessage':
        return (
          <AssistantMessageCard
            fragmentRef={data}
            toolResultsMap={toolResultsMap}
          />
        );

      case 'SummaryMessage':
        return <SummaryMessageCard fragmentRef={data} />;

      case 'SystemMessage':
        return <SystemMessageCard fragmentRef={data} />;

      case 'FileHistorySnapshotMessage':
        return <FileHistorySnapshotMessageCard fragmentRef={data} />;

      case 'HookRunMessage':
        return <HookRunMessageCard fragmentRef={data} />;

      case 'HookResultMessage':
        return <HookResultMessageCard fragmentRef={data} />;

      case 'HookReferenceMessage':
        return <HookReferenceMessageCard fragmentRef={data} />;

      case 'HookValidationMessage':
        return <HookValidationMessageCard fragmentRef={data} />;

      case 'HookValidationCacheMessage':
        return <HookValidationCacheMessageCard fragmentRef={data} />;

      case 'HookScriptMessage':
        return <HookScriptMessageCard fragmentRef={data} />;

      case 'HookDatetimeMessage':
        return <HookDatetimeMessageCard fragmentRef={data} />;

      case 'HookFileChangeMessage':
        return <HookFileChangeMessageCard fragmentRef={data} />;

      case 'QueueOperationMessage':
        return <QueueOperationMessageCard fragmentRef={data} />;

      case 'McpToolCallMessage':
        return <McpToolCallMessageCard fragmentRef={data} />;

      case 'McpToolResultMessage':
        return <McpToolResultMessageCard fragmentRef={data} />;

      case 'ExposedToolCallMessage':
        return <ExposedToolCallMessageCard fragmentRef={data} />;

      case 'ExposedToolResultMessage':
        return <ExposedToolResultMessageCard fragmentRef={data} />;

      case 'MemoryQueryMessage':
        return <MemoryQueryMessageCard fragmentRef={data} />;

      case 'MemoryLearnMessage':
        return <MemoryLearnMessageCard fragmentRef={data} />;

      case 'SentimentAnalysisMessage':
        return <SentimentAnalysisMessageCard fragmentRef={data} />;

      case 'UnknownEventMessage':
        return <UnknownEventMessageCard fragmentRef={data} />;

      default:
        // Handle %other (future types) gracefully
        console.warn(`Unknown message type: ${data.__typename}`);
        return null;
    }
  })();

  // Return null for unknown types
  if (!cardElement) {
    return null;
  }

  // Wrap with context provider to share messageId with all children
  return (
    <MessageContextProvider messageId={data.id ?? null}>
      {cardElement}
    </MessageContextProvider>
  );
}

/**
 * Message type enum for external use
 */
export type MessageTypename =
  | 'UserMessage'
  | 'AssistantMessage'
  | 'SummaryMessage'
  | 'SystemMessage'
  | 'FileHistorySnapshotMessage'
  | 'HookRunMessage'
  | 'HookResultMessage'
  | 'HookReferenceMessage'
  | 'HookValidationMessage'
  | 'HookValidationCacheMessage'
  | 'HookScriptMessage'
  | 'HookDatetimeMessage'
  | 'HookFileChangeMessage'
  | 'QueueOperationMessage'
  | 'McpToolCallMessage'
  | 'McpToolResultMessage'
  | 'ExposedToolCallMessage'
  | 'ExposedToolResultMessage'
  | 'MemoryQueryMessage'
  | 'MemoryLearnMessage'
  | 'SentimentAnalysisMessage'
  | 'UnknownEventMessage';

/**
 * Check if a typename is a known message type
 */
export function isKnownMessageType(
  typename: string
): typename is MessageTypename {
  return [
    'UserMessage',
    'AssistantMessage',
    'SummaryMessage',
    'SystemMessage',
    'FileHistorySnapshotMessage',
    'HookRunMessage',
    'HookResultMessage',
    'HookReferenceMessage',
    'HookValidationMessage',
    'HookValidationCacheMessage',
    'HookScriptMessage',
    'HookDatetimeMessage',
    'HookFileChangeMessage',
    'QueueOperationMessage',
    'McpToolCallMessage',
    'McpToolResultMessage',
    'ExposedToolCallMessage',
    'ExposedToolResultMessage',
    'MemoryQueryMessage',
    'MemoryLearnMessage',
    'SentimentAnalysisMessage',
    'UnknownEventMessage',
  ].includes(typename);
}
