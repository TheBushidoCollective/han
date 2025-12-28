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
import { useMemo, useState } from 'react';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';

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
                style={{ fontFamily: 'monospace', color: '#58a6ff' }}
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
                style={{ fontFamily: 'monospace', color: '#f0883e' }}
              >
                {filePath}
              </Text>
            </HStack>
            {content && (
              <Box className="file-content-preview">
                <Text size="xs" color="muted">
                  Content: {content.length.toLocaleString()} chars
                </Text>
                {content.length <= 500 && (
                  <pre className="content-preview">
                    <code>{content}</code>
                  </pre>
                )}
              </Box>
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
                style={{ fontFamily: 'monospace', color: '#a371f7' }}
              >
                {filePath}
              </Text>
            </HStack>
            {oldString && newString && (
              <Box className="diff-preview">
                <VStack gap="xs">
                  <Box className="diff-old">
                    <Text size="xs" weight={600} style={{ color: '#f85149' }}>
                      - Remove:
                    </Text>
                    <pre>
                      <code>
                        {oldString.length > 200
                          ? `${oldString.slice(0, 200)}...`
                          : oldString}
                      </code>
                    </pre>
                  </Box>
                  <Box className="diff-new">
                    <Text size="xs" weight={600} style={{ color: '#3fb950' }}>
                      + Add:
                    </Text>
                    <pre>
                      <code>
                        {newString.length > 200
                          ? `${newString.slice(0, 200)}...`
                          : newString}
                      </code>
                    </pre>
                  </Box>
                </VStack>
              </Box>
            )}
          </VStack>
        );
      }

      case 'Bash': {
        const command = parsedInput.command as string;
        const description = parsedInput.description as string | undefined;
        return (
          <VStack gap="xs" align="stretch">
            {description && (
              <Text size="xs" color="muted">
                {description}
              </Text>
            )}
            <pre className="bash-command">
              <code
                className="hljs language-bash"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: syntax highlighting
                dangerouslySetInnerHTML={{
                  __html: hljs.highlight(command, { language: 'bash' }).value,
                }}
              />
            </pre>
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
                <Text size="sm" style={{ fontFamily: 'monospace' }}>
                  {pattern}
                </Text>
              </HStack>
              {path && (
                <HStack gap="xs">
                  <Text size="xs" color="muted">
                    Path:
                  </Text>
                  <Text size="sm" style={{ fontFamily: 'monospace' }}>
                    {path}
                  </Text>
                </HStack>
              )}
              {glob && (
                <HStack gap="xs">
                  <Text size="xs" color="muted">
                    Glob:
                  </Text>
                  <Text size="sm" style={{ fontFamily: 'monospace' }}>
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
                <Text size="sm" style={{ fontFamily: 'monospace' }}>
                  {pattern}
                </Text>
              </HStack>
              {path && (
                <HStack gap="xs">
                  <Text size="xs" color="muted">
                    Path:
                  </Text>
                  <Text size="sm" style={{ fontFamily: 'monospace' }}>
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
                  weight={600}
                  style={{ color: '#d29922', fontFamily: 'monospace' }}
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
                  maxHeight: '100px',
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
                  style={{ fontFamily: 'monospace', color: '#8b949e' }}
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
                  fontFamily: 'monospace',
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
            <Text size="sm" style={{ fontFamily: 'monospace' }}>
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
              <pre className="tool-input-preview">
                <code
                  className="hljs language-json"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: syntax highlighting
                  dangerouslySetInnerHTML={{
                    __html: showFullInput
                      ? hljs.highlight(inputStr, { language: 'json' }).value
                      : hljs
                          .highlight(inputStr.slice(0, 300), {
                            language: 'json',
                          })
                          .value.concat('...'),
                  }}
                />
              </pre>
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
          return (
            <pre className="tool-input-preview">
              <code
                className="hljs language-json"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: syntax highlighting
                dangerouslySetInnerHTML={{
                  __html: hljs.highlight(inputStr, { language: 'json' }).value,
                }}
              />
            </pre>
          );
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
        className={`tool-result-inline ${isError ? 'tool-result-error' : 'tool-result-success'}`}
        style={{
          marginTop: '0.5rem',
          padding: '0.5rem',
          borderRadius: '4px',
          backgroundColor: isError
            ? 'rgba(248, 81, 73, 0.1)'
            : 'rgba(63, 185, 80, 0.1)',
          borderLeft: `3px solid ${isError ? '#f85149' : '#3fb950'}`,
        }}
      >
        <HStack gap="xs" align="center" style={{ marginBottom: '0.25rem' }}>
          <Text size="xs" style={{ color: isError ? '#f85149' : '#3fb950' }}>
            {isError ? '✗ Error' : '✓ Result'}
          </Text>
        </HStack>
        <pre
          style={{
            margin: 0,
            padding: 0,
            fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: 'var(--color-text-muted)',
            maxHeight: isLong ? '200px' : undefined,
            overflow: isLong ? 'auto' : undefined,
          }}
        >
          <code>{isLong ? preview : content}</code>
        </pre>
      </Box>
    );
  };

  return (
    <Box className="content-block tool-use-block">
      <HStack className="tool-header" gap="sm" align="center">
        <Text className="tool-icon" size="md">
          {icon}
        </Text>
        <Text size="sm" weight={600} style={{ color }}>
          {displayName}
        </Text>
        {name.startsWith('mcp__') && (
          <Text size="xs" color="muted" style={{ fontFamily: 'monospace' }}>
            {name}
          </Text>
        )}
      </HStack>
      <Box className="tool-content">{renderToolContent()}</Box>
      {renderResult()}
    </Box>
  );
}
