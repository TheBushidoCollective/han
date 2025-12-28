/**
 * UserMessageCard Component
 *
 * Renders user messages with support for:
 * - Regular user input
 * - System/meta messages
 * - Slash commands
 * - Interrupts
 * - Inline sentiment analysis display
 */

import type React from 'react';
import { graphql, useFragment } from 'react-relay';
import { Badge } from '@/components/atoms/Badge.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import { MarkdownContent } from '@/components/organisms/MarkdownContent.tsx';
import {
  ImageBlock,
  TextBlock,
  ThinkingBlock,
  ToolUseBlock,
} from '../ContentBlocks/index.tsx';
import type { ContentBlock as ContentBlockType } from '../types.ts';
import type { UserMessageCard_message$key } from './__generated__/UserMessageCard_message.graphql.ts';
import {
  MessageHeader,
  type MessageRoleInfo,
  MessageWrapper,
  RawJsonView,
  useRawJsonToggle,
} from './shared.tsx';

const UserMessageCardFragment = graphql`
  fragment UserMessageCard_message on UserMessage {
    id
    timestamp
    rawJson
    content
    contentBlocks {
      type
      ... on ThinkingBlock {
        thinking
        preview
        signature
      }
      ... on TextBlock {
        text
      }
      ... on ToolUseBlock {
        toolCallId
        name
        input
        category
        icon
        displayName
        color
      }
      ... on ToolResultBlock {
        toolCallId
        content
        isError
        isLong
        preview
        hasImage
      }
      ... on ImageBlock {
        mediaType
        dataUrl
      }
    }
    isMeta
    isInterrupt
    isCommand
    commandName
    sentimentAnalysis {
      sentimentScore
      sentimentLevel
      frustrationScore
      frustrationLevel
      signals
    }
  }
`;

interface UserMessageCardProps {
  fragmentRef: UserMessageCard_message$key;
  toolResultsMap?: Map<string, ContentBlockType>;
}

/**
 * Get role info for user message variants
 */
function getUserRoleInfo(
  isMeta: boolean | null,
  isCommand: boolean | null,
  isInterrupt: boolean | null,
  commandName: string | null
): MessageRoleInfo {
  if (isMeta) {
    return { label: 'System', className: 'role-system', icon: '⚙️' };
  }
  if (isCommand) {
    return {
      label: commandName ? `/${commandName}` : 'Command',
      className: 'role-command',
      icon: '⚡',
    };
  }
  if (isInterrupt) {
    return { label: 'Interrupt', className: 'role-interrupt', icon: '⏸️' };
  }
  return { label: 'User', className: 'role-user', icon: '👤' };
}

/**
 * Render content blocks for user messages
 */
function renderContentBlock(
  block: ContentBlockType,
  index: number,
  toolResultsMap?: Map<string, ContentBlockType>
): React.ReactElement | null {
  switch (block.type) {
    case 'THINKING':
      return (
        <ThinkingBlock
          key={`thinking-${index}`}
          thinking={block.thinking ?? ''}
          preview={block.preview ?? ''}
          signature={block.signature}
        />
      );
    case 'TEXT':
      return <TextBlock key={`text-${index}`} text={block.text ?? ''} />;
    case 'TOOL_USE': {
      const category = block.category as
        | 'FILE'
        | 'SEARCH'
        | 'SHELL'
        | 'WEB'
        | 'TASK'
        | 'MCP'
        | 'OTHER'
        | null;
      const validCategory =
        category &&
        ['FILE', 'SEARCH', 'SHELL', 'WEB', 'TASK', 'MCP', 'OTHER'].includes(
          category
        )
          ? category
          : 'OTHER';
      const result = toolResultsMap?.get(block.toolCallId ?? '');
      return (
        <ToolUseBlock
          key={`tool-use-${index}`}
          toolCallId={block.toolCallId ?? ''}
          name={block.name ?? ''}
          input={block.input ?? '{}'}
          category={validCategory}
          icon={block.icon ?? '🔧'}
          displayName={block.displayName ?? block.name ?? 'Tool'}
          color={block.color ?? '#8b949e'}
          result={result}
        />
      );
    }
    case 'TOOL_RESULT':
      return null;
    case 'IMAGE':
      return (
        <ImageBlock
          key={`image-${index}`}
          mediaType={block.mediaType ?? 'image/png'}
          dataUrl={block.dataUrl ?? ''}
        />
      );
    default:
      return null;
  }
}

/**
 * Inline sentiment indicator for user messages
 */
function InlineSentiment({
  sentimentLevel,
  sentimentScore,
  signals,
}: {
  sentimentLevel: string;
  sentimentScore: number;
  signals: readonly string[];
}): React.ReactElement {
  const levelColor =
    sentimentLevel === 'positive'
      ? '#3fb950'
      : sentimentLevel === 'negative'
        ? '#f85149'
        : '#8b949e';

  const badgeVariant =
    sentimentLevel === 'positive'
      ? 'success'
      : sentimentLevel === 'negative'
        ? 'danger'
        : ('default' as const);

  return (
    <HStack
      className="inline-sentiment"
      gap="sm"
      align="center"
      style={{
        marginTop: '4px',
        padding: '4px 8px',
        backgroundColor: 'rgba(139, 148, 158, 0.1)',
        borderRadius: '4px',
        borderLeft: `3px solid ${levelColor}`,
      }}
    >
      <Text size="xs" color="muted">
        💭
      </Text>
      <Badge variant={badgeVariant}>
        {sentimentLevel.charAt(0).toUpperCase() + sentimentLevel.slice(1)}
      </Badge>
      <Text size="xs" style={{ color: levelColor }}>
        ({sentimentScore > 0 ? '+' : ''}
        {sentimentScore.toFixed(1)})
      </Text>
      {signals.length > 0 && (
        <HStack gap="xs" style={{ marginLeft: '4px' }}>
          {signals.slice(0, 3).map((signal) => (
            <Badge key={signal} variant="info" style={{ fontSize: '10px' }}>
              {signal}
            </Badge>
          ))}
          {signals.length > 3 && (
            <Text size="xs" color="muted">
              +{signals.length - 3} more
            </Text>
          )}
        </HStack>
      )}
    </HStack>
  );
}

export function UserMessageCard({
  fragmentRef,
  toolResultsMap,
}: UserMessageCardProps): React.ReactElement {
  const data = useFragment(UserMessageCardFragment, fragmentRef);
  const { showRawJson, toggleRawJson } = useRawJsonToggle();

  const roleInfo = getUserRoleInfo(
    data.isMeta ?? false,
    data.isCommand ?? false,
    data.isInterrupt ?? false,
    data.commandName ?? null
  );

  const hasContentBlocks = data.contentBlocks && data.contentBlocks.length > 0;
  const contentBlocks = data.contentBlocks ?? [];

  return (
    <MessageWrapper type="user" showRawJson={showRawJson}>
      <MessageHeader
        roleInfo={roleInfo}
        timestamp={data.timestamp}
        showRawJson={showRawJson}
        onToggleRawJson={toggleRawJson}
      />

      {showRawJson ? (
        <RawJsonView rawJson={data.rawJson ?? null} />
      ) : (
        <VStack className="message-content" gap="sm" align="stretch">
          {hasContentBlocks ? (
            contentBlocks.map((block, index) =>
              renderContentBlock(
                block as ContentBlockType,
                index,
                toolResultsMap
              )
            )
          ) : (
            <MarkdownContent>{data.content ?? ''}</MarkdownContent>
          )}

          {data.sentimentAnalysis && (
            <InlineSentiment
              sentimentLevel={
                data.sentimentAnalysis.sentimentLevel ?? 'neutral'
              }
              sentimentScore={data.sentimentAnalysis.sentimentScore ?? 0}
              signals={data.sentimentAnalysis.signals ?? []}
            />
          )}
        </VStack>
      )}
    </MessageWrapper>
  );
}
