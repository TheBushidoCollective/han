/**
 * AssistantMessageCard Component
 *
 * Renders Claude assistant messages with support for:
 * - Rich content blocks (thinking, text, tool use, images)
 * - Token usage display
 * - Model indicator
 * - Tool-only message handling
 */

import type React from 'react';
import { graphql, useFragment } from 'react-relay';
import { Badge } from '@/components/atoms/Badge.tsx';
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
import type { AssistantMessageCard_message$key } from './__generated__/AssistantMessageCard_message.graphql.ts';
import {
  MessageHeader,
  type MessageRoleInfo,
  MessageWrapper,
  RawJsonView,
  useRawJsonToggle,
} from './shared.tsx';

const AssistantMessageCardFragment = graphql`
  fragment AssistantMessageCard_message on AssistantMessage {
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
    isToolOnly
    model
    hasThinking
    thinkingCount
    hasToolUse
    toolUseCount
    inputTokens
    outputTokens
    cachedTokens
  }
`;

interface AssistantMessageCardProps {
  fragmentRef: AssistantMessageCard_message$key;
  toolResultsMap?: Map<string, ContentBlockType>;
}

const ASSISTANT_ROLE_INFO: MessageRoleInfo = {
  label: 'Claude',
  color: '#3fb950', // success green
  icon: '🤖',
};

/**
 * Render content blocks for assistant messages
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
 * Badge components for assistant message metadata
 */
function AssistantBadges({
  hasThinking,
  thinkingCount,
  hasToolUse,
  toolUseCount,
  model,
  inputTokens,
  outputTokens,
  cachedTokens,
}: {
  hasThinking: boolean;
  thinkingCount: number;
  hasToolUse: boolean;
  toolUseCount: number;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
}): React.ReactElement {
  return (
    <>
      {hasThinking && (
        <span title={`${thinkingCount} thinking blocks`}>
          <Badge variant="info">🧠 {thinkingCount}</Badge>
        </span>
      )}
      {hasToolUse && (
        <span title={`${toolUseCount} tool calls`}>
          <Badge variant="warning">🔧 {toolUseCount}</Badge>
        </span>
      )}
      {model && (
        <span title={`Model: ${model}`}>
          <Badge variant="default">
            {model.includes('opus')
              ? '💎'
              : model.includes('sonnet')
                ? '✨'
                : '🎯'}
          </Badge>
        </span>
      )}
      {(inputTokens || outputTokens) && (
        <Text size="xs" color="muted" title="Token usage">
          {inputTokens?.toLocaleString() ?? 0}↓{' '}
          {outputTokens?.toLocaleString() ?? 0}↑
          {cachedTokens ? ` (${cachedTokens.toLocaleString()} cached)` : ''}
        </Text>
      )}
    </>
  );
}

export function AssistantMessageCard({
  fragmentRef,
  toolResultsMap,
}: AssistantMessageCardProps): React.ReactElement {
  const data = useFragment(AssistantMessageCardFragment, fragmentRef);
  const { showRawJson, toggleRawJson } = useRawJsonToggle();

  const hasContentBlocks = data.contentBlocks && data.contentBlocks.length > 0;
  const contentBlocks = data.contentBlocks ?? [];

  return (
    <MessageWrapper
      type="assistant"
      isToolOnly={data.isToolOnly ?? false}
      showRawJson={showRawJson}
    >
      <MessageHeader
        roleInfo={ASSISTANT_ROLE_INFO}
        timestamp={data.timestamp}
        showRawJson={showRawJson}
        onToggleRawJson={toggleRawJson}
        badges={
          <AssistantBadges
            hasThinking={data.hasThinking ?? false}
            thinkingCount={data.thinkingCount ?? 0}
            hasToolUse={data.hasToolUse ?? false}
            toolUseCount={data.toolUseCount ?? 0}
            model={data.model ?? null}
            inputTokens={data.inputTokens ?? null}
            outputTokens={data.outputTokens ?? null}
            cachedTokens={data.cachedTokens ?? null}
          />
        }
      />

      {showRawJson ? (
        <RawJsonView rawJson={data.rawJson ?? null} />
      ) : (
        <VStack gap="md" align="stretch">
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
        </VStack>
      )}
    </MessageWrapper>
  );
}
