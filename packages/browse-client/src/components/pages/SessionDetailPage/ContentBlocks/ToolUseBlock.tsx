/**
 * Tool Use Block Component
 *
 * Renders Claude's tool call request with rich visualization based on tool type.
 * Shows file paths, bash commands, search patterns, etc.
 */

import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import type React from 'react';
import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import { fonts } from '@/theme.ts';

// Register languages for syntax highlighting
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', json);

import type { ContentBlock } from '../types.ts';

interface ToolUseBlockProps {
  toolCallId: string;
  name: string;
  input: string;
  category: 'FILE' | 'SEARCH' | 'SHELL' | 'WEB' | 'TASK' | 'MCP' | 'OTHER';
  icon: string;
  displayName: string;
  color: string;
  result?: ContentBlock;
}

const codeBlockStyle: CSSProperties = {
  margin: 0,
  fontFamily: fonts.mono,
  fontSize: '0.8rem',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const terminalStyle: CSSProperties = {
  backgroundColor: '#1a1b26',
  borderRadius: 8,
  overflow: 'hidden',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
};

const terminalHeaderStyle: CSSProperties = {
  backgroundColor: '#24283b',
  padding: '8px 12px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  borderBottom: '1px solid #414868',
};

const terminalContentStyle: CSSProperties = {
  padding: '16px 20px',
};

const diffRemoveStyle: CSSProperties = {
  backgroundColor: 'rgba(248, 81, 73, 0.15)',
  borderLeftWidth: 3,
  borderLeftColor: '#f85149',
  borderRadius: 4,
  padding: '8px 12px',
};

const diffAddStyle: CSSProperties = {
  backgroundColor: 'rgba(63, 185, 80, 0.15)',
  borderLeftWidth: 3,
  borderLeftColor: '#3fb950',
  borderRadius: 4,
  padding: '8px 12px',
};

/**
 * Parse tool input from JSON string
 */
function parseInput(input: string): Record<string, unknown> {
  try {
    return JSON.parse(input);
  } catch {
    return {};
  }
}

/**
 * CodeBlock component for preformatted text
 */
function CodeBlock({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: CSSProperties;
}): React.ReactElement {
  return (
    <Box style={{ ...codeBlockStyle, ...style }}>
      <Text style={{ fontFamily: fonts.mono, fontSize: 12 }}>{children}</Text>
    </Box>
  );
}

/**
 * HighlightedCode for syntax-highlighted content
 * Note: Uses raw div since dangerouslySetInnerHTML is required for hljs output
 * and is not supported by React Native View components
 */
function HighlightedCode({
  code,
  language,
  style,
}: {
  code: string;
  language: string;
  style?: CSSProperties;
}): React.ReactElement {
  const highlighted = hljs.highlight(code, { language }).value;
  return (
    <div
      style={{ ...codeBlockStyle, ...style }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: syntax highlighting requires innerHTML
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}

export function ToolUseBlock({
  name,
  input,
  icon,
  displayName,
  color,
  result,
}: ToolUseBlockProps): React.ReactElement {
  const [showFullInput, setShowFullInput] = useState(false);
  const parsedInput = useMemo(() => parseInput(input), [input]);

  // Render tool-specific content
  const renderToolContent = () => {
    switch (name) {
      case 'Read': {
        const filePath = parsedInput.file_path as string;
        const offset = parsedInput.offset as number | undefined;
        const limit = parsedInput.limit as number | undefined;
        return (
          <VStack gap="xs" align="stretch">
            <HStack gap="xs" align="center">
              <Text size="xs" color="muted">
                File:
              </Text>
              <Text
                size="sm"
                style={{ fontFamily: fonts.mono, color: '#58a6ff' }}
              >
                {filePath}
              </Text>
            </HStack>
            {(offset !== undefined || limit !== undefined) && (
              <HStack gap="md">
                {offset !== undefined && (
                  <Text size="xs" color="muted">
                    Offset: {offset}
                  </Text>
                )}
                {limit !== undefined && (
                  <Text size="xs" color="muted">
                    Limit: {limit}
                  </Text>
                )}
              </HStack>
            )}
          </VStack>
        );
      }

      case 'Write': {
        const filePath = parsedInput.file_path as string;
        const content = parsedInput.content as string | undefined;
        return (
          <VStack gap="xs" align="stretch">
            <HStack gap="xs" align="center">
              <Text size="xs" color="muted">
                File:
              </Text>
              <Text
                size="sm"
                style={{ fontFamily: fonts.mono, color: '#f0883e' }}
              >
                {filePath}
              </Text>
            </HStack>
            {content && (
              <VStack gap="xs">
                <Text size="xs" color="muted">
                  Content: {content.length.toLocaleString()} chars
                </Text>
                {content.length <= 500 && <CodeBlock>{content}</CodeBlock>}
              </VStack>
            )}
          </VStack>
        );
      }

      case 'Edit': {
        const filePath = parsedInput.file_path as string;
        const oldString = parsedInput.old_string as string | undefined;
        const newString = parsedInput.new_string as string | undefined;
        return (
          <VStack gap="xs" align="stretch">
            <HStack gap="xs" align="center">
              <Text size="xs" color="muted">
                File:
              </Text>
              <Text
                size="sm"
                style={{ fontFamily: fonts.mono, color: '#a371f7' }}
              >
                {filePath}
              </Text>
            </HStack>
            {oldString && newString && (
              <VStack gap="xs" align="stretch">
                <Box style={diffRemoveStyle}>
                  <Text
                    size="xs"
                    weight="semibold"
                    style={{ color: '#f85149', marginBottom: 4 }}
                  >
                    - Remove:
                  </Text>
                  <CodeBlock>
                    {oldString.length > 200
                      ? `${oldString.slice(0, 200)}...`
                      : oldString}
                  </CodeBlock>
                </Box>
                <Box style={diffAddStyle}>
                  <Text
                    size="xs"
                    weight="semibold"
                    style={{ color: '#3fb950', marginBottom: 4 }}
                  >
                    + Add:
                  </Text>
                  <CodeBlock>
                    {newString.length > 200
                      ? `${newString.slice(0, 200)}...`
                      : newString}
                  </CodeBlock>
                </Box>
              </VStack>
            )}
          </VStack>
        );
      }

      case 'Bash': {
        const command = parsedInput.command as string;
        const description = parsedInput.description as string | undefined;
        const isBackground = parsedInput.run_in_background as
          | boolean
          | undefined;
        return (
          <VStack gap="xs" align="stretch">
            {description && (
              <Text size="xs" color="muted">
                {description}
              </Text>
            )}
            {/* Terminal-style container */}
            <Box style={terminalStyle}>
              {/* Terminal header */}
              <Box style={terminalHeaderStyle}>
                <Text
                  size="xs"
                  style={{
                    color: '#565f89',
                    fontFamily: fonts.mono,
                  }}
                >
                  bash {isBackground ? '(background)' : ''}
                </Text>
              </Box>
              {/* Terminal content */}
              <Box style={terminalContentStyle}>
                <HStack gap="xs" align="baseline">
                  <Text style={{ color: '#7aa2f7', fontFamily: fonts.mono }}>
                    $
                  </Text>
                  <HighlightedCode
                    code={command}
                    language="bash"
                    style={{
                      color: '#c0caf5',
                      lineHeight: 1.5,
                    }}
                  />
                </HStack>
              </Box>
            </Box>
          </VStack>
        );
      }

      case 'Grep': {
        const pattern = parsedInput.pattern as string;
        const path = parsedInput.path as string | undefined;
        const glob = parsedInput.glob as string | undefined;
        return (
          <VStack gap="xs" align="stretch">
            <HStack gap="md" align="baseline" style={{ flexWrap: 'wrap' }}>
              <HStack gap="xs">
                <Text size="xs" color="muted">
                  Pattern:
                </Text>
                <Text size="sm" style={{ fontFamily: fonts.mono }}>
                  {pattern}
                </Text>
              </HStack>
              {path && (
                <HStack gap="xs">
                  <Text size="xs" color="muted">
                    Path:
                  </Text>
                  <Text size="sm" style={{ fontFamily: fonts.mono }}>
                    {path}
                  </Text>
                </HStack>
              )}
              {glob && (
                <HStack gap="xs">
                  <Text size="xs" color="muted">
                    Glob:
                  </Text>
                  <Text size="sm" style={{ fontFamily: fonts.mono }}>
                    {glob}
                  </Text>
                </HStack>
              )}
            </HStack>
          </VStack>
        );
      }

      case 'Glob': {
        const pattern = parsedInput.pattern as string;
        const path = parsedInput.path as string | undefined;
        return (
          <VStack gap="xs" align="stretch">
            <HStack gap="md" align="baseline" style={{ flexWrap: 'wrap' }}>
              <HStack gap="xs">
                <Text size="xs" color="muted">
                  Pattern:
                </Text>
                <Text size="sm" style={{ fontFamily: fonts.mono }}>
                  {pattern}
                </Text>
              </HStack>
              {path && (
                <HStack gap="xs">
                  <Text size="xs" color="muted">
                    Path:
                  </Text>
                  <Text size="sm" style={{ fontFamily: fonts.mono }}>
                    {path}
                  </Text>
                </HStack>
              )}
            </HStack>
          </VStack>
        );
      }

      case 'Task': {
        const description = parsedInput.description as string | undefined;
        const prompt = parsedInput.prompt as string | undefined;
        const subagentType = parsedInput.subagent_type as string | undefined;
        // Parse agent ID from result if available
        const agentIdMatch = result?.content?.match(/agentId:\s*([a-f0-9-]+)/i);
        const agentId = agentIdMatch?.[1];
        return (
          <VStack gap="xs" align="stretch">
            {subagentType && (
              <HStack gap="xs">
                <Text size="xs" color="muted">
                  Agent:
                </Text>
                <Text
                  size="sm"
                  weight="semibold"
                  style={{ color: '#d29922', fontFamily: fonts.mono }}
                >
                  {subagentType}
                </Text>
              </HStack>
            )}
            {description && (
              <HStack gap="xs" align="baseline">
                <Text size="xs" color="muted">
                  Task:
                </Text>
                <Text size="sm">{description}</Text>
              </HStack>
            )}
            {prompt && !description && (
              <Text
                size="sm"
                style={{
                  maxHeight: 100,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {prompt.length > 150 ? `${prompt.slice(0, 150)}...` : prompt}
              </Text>
            )}
            {agentId && (
              <HStack gap="xs">
                <Text size="xs" color="muted">
                  Agent ID:
                </Text>
                <Text
                  size="xs"
                  style={{ fontFamily: fonts.mono, color: '#8b949e' }}
                >
                  {agentId}
                </Text>
              </HStack>
            )}
          </VStack>
        );
      }

      case 'WebFetch': {
        const url = parsedInput.url as string;
        const prompt = parsedInput.prompt as string | undefined;
        return (
          <VStack gap="xs" align="stretch">
            <HStack gap="xs" align="center">
              <Text size="xs" color="muted">
                URL:
              </Text>
              <Text
                size="sm"
                style={{
                  fontFamily: fonts.mono,
                  color: '#58a6ff',
                  wordBreak: 'break-all',
                }}
              >
                {url}
              </Text>
            </HStack>
            {prompt && (
              <Text size="xs" color="muted">
                Prompt: {prompt}
              </Text>
            )}
          </VStack>
        );
      }

      case 'WebSearch': {
        const query = parsedInput.query as string;
        return (
          <HStack gap="xs" align="center">
            <Text size="xs" color="muted">
              Query:
            </Text>
            <Text size="sm" style={{ fontFamily: fonts.mono }}>
              {query}
            </Text>
          </HStack>
        );
      }

      case 'TodoWrite': {
        const todos = parsedInput.todos as
          | Array<{ content: string; status: string }>
          | undefined;
        if (todos && todos.length > 0) {
          return (
            <VStack gap="xs" align="stretch">
              {todos.slice(0, 5).map((todo) => (
                <HStack key={todo.content} gap="xs" align="center">
                  <Text size="sm">
                    {todo.status === 'completed'
                      ? '✅'
                      : todo.status === 'in_progress'
                        ? '🔄'
                        : '⬜'}
                  </Text>
                  <Text size="sm">{todo.content}</Text>
                </HStack>
              ))}
              {todos.length > 5 && (
                <Text size="xs" color="muted">
                  +{todos.length - 5} more items
                </Text>
              )}
            </VStack>
          );
        }
        return null;
      }

      default: {
        // For unknown tools or MCP tools, show raw input
        const inputStr = JSON.stringify(parsedInput, null, 2);
        if (inputStr.length > 300) {
          return (
            <VStack gap="xs">
              <HighlightedCode
                code={showFullInput ? inputStr : `${inputStr.slice(0, 300)}...`}
                language="json"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFullInput(!showFullInput)}
              >
                {showFullInput ? 'Show less' : 'Show more'}
              </Button>
            </VStack>
          );
        }
        if (inputStr !== '{}') {
          return <HighlightedCode code={inputStr} language="json" />;
        }
        return null;
      }
    }
  };

  // Render the result inline
  const renderResult = () => {
    if (!result) return null;

    const content = result.content ?? '';
    const isError = result.isError ?? false;
    const isLong = result.isLong ?? false;
    const preview = result.preview ?? content;

    return (
      <Box
        style={{
          marginTop: 8,
          padding: 8,
          borderRadius: 4,
          backgroundColor: isError
            ? 'rgba(248, 81, 73, 0.1)'
            : 'rgba(63, 185, 80, 0.1)',
          borderLeftWidth: 3,
          borderLeftColor: isError ? '#f85149' : '#3fb950',
        }}
      >
        <HStack gap="xs" align="center" style={{ marginBottom: 4 }}>
          <Text size="xs" style={{ color: isError ? '#f85149' : '#3fb950' }}>
            {isError ? '✗ Error' : '✓ Result'}
          </Text>
        </HStack>
        <Box
          style={{
            ...codeBlockStyle,
            maxHeight: isLong ? 200 : undefined,
            overflow: isLong ? 'auto' : undefined,
          }}
        >
          <Text size="sm" color="muted" style={{ fontFamily: fonts.mono }}>
            {isLong ? preview : content}
          </Text>
        </Box>
      </Box>
    );
  };

  return (
    <Box>
      <HStack gap="sm" align="center">
        <Text size="md">{icon}</Text>
        <Text size="sm" weight="semibold" style={{ color }}>
          {displayName}
        </Text>
        {name.startsWith('mcp__') && (
          <Text size="xs" color="muted" style={{ fontFamily: fonts.mono }}>
            {name}
          </Text>
        )}
      </HStack>
      <Box style={{ marginTop: 8 }}>{renderToolContent()}</Box>
      {renderResult()}
    </Box>
  );
}
