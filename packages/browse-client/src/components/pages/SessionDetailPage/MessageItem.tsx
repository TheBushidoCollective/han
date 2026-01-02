/**
 * Message Item Component
 *
 * Displays a single message with markdown rendering and tool content formatting.
 * Uses MarkdownContent organism for centralized content rendering.
 */

import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import type React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnsiText, containsAnsi } from '@/components/atoms/AnsiText.tsx';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Link } from '@/components/atoms/Link.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import { MarkdownContent } from '@/components/organisms/MarkdownContent.tsx';
import { formatDate } from './utils.ts';

/**
 * Simplified message type for list rendering
 * Only includes fields actually used by MessageItem
 */
export interface MessageItemMessage {
  id: string;
  type: 'USER' | 'ASSISTANT' | 'SUMMARY';
  content: string | null;
  timestamp: string | null;
  isToolOnly: boolean;
}

// Register bash language for syntax highlighting (used in tool content)
hljs.registerLanguage('bash', bash);

/**
 * Tool metadata for enhanced display
 */
const TOOL_METADATA: Record<
  string,
  { icon: string; label: string; description: string; color: string }
> = {
  Read: {
    icon: '📄',
    label: 'Read File',
    description: 'Reading file contents',
    color: '#58a6ff',
  },
  Write: {
    icon: '✍️',
    label: 'Write File',
    description: 'Creating or overwriting file',
    color: '#f0883e',
  },
  Edit: {
    icon: '✏️',
    label: 'Edit File',
    description: 'Modifying existing file',
    color: '#a371f7',
  },
  Bash: {
    icon: '💻',
    label: 'Shell Command',
    description: 'Executing terminal command',
    color: '#7ee787',
  },
  Task: {
    icon: '🤖',
    label: 'Subagent',
    description: 'Spawning autonomous agent',
    color: '#d29922',
  },
  Grep: {
    icon: '🔍',
    label: 'Search Content',
    description: 'Searching file contents',
    color: '#79c0ff',
  },
  Glob: {
    icon: '📁',
    label: 'Find Files',
    description: 'Finding files by pattern',
    color: '#79c0ff',
  },
  TodoWrite: {
    icon: '☑️',
    label: 'Update Todos',
    description: 'Managing task list',
    color: '#22c55e',
  },
  WebFetch: {
    icon: '🌐',
    label: 'Web Fetch',
    description: 'Fetching web content',
    color: '#58a6ff',
  },
  WebSearch: {
    icon: '🔎',
    label: 'Web Search',
    description: 'Searching the web',
    color: '#58a6ff',
  },
  LSP: {
    icon: '🔗',
    label: 'Language Server',
    description: 'Using code intelligence',
    color: '#a371f7',
  },
  NotebookEdit: {
    icon: '📓',
    label: 'Notebook Edit',
    description: 'Editing Jupyter notebook',
    color: '#f0883e',
  },
  Skill: {
    icon: '⚡',
    label: 'Skill',
    description: 'Executing skill command',
    color: '#d29922',
  },
  AskUserQuestion: {
    icon: '❓',
    label: 'User Question',
    description: 'Asking user for input',
    color: '#f778ba',
  },
  EnterPlanMode: {
    icon: '📝',
    label: 'Plan Mode',
    description: 'Entering planning mode',
    color: '#a371f7',
  },
  ExitPlanMode: {
    icon: '✅',
    label: 'Exit Plan',
    description: 'Completing plan',
    color: '#22c55e',
  },
  KillShell: {
    icon: '⏹️',
    label: 'Kill Shell',
    description: 'Terminating background process',
    color: '#f85149',
  },
  TaskOutput: {
    icon: '📤',
    label: 'Task Output',
    description: 'Reading subagent output',
    color: '#d29922',
  },
};

/**
 * Get tool metadata with fallback for unknown tools
 */
function getToolMetadata(toolName: string): {
  icon: string;
  label: string;
  description: string;
  color: string;
} {
  // Check for MCP tools (prefixed with mcp__)
  if (toolName.startsWith('mcp__')) {
    const parts = toolName.split('__');
    const serverName = parts[1] || 'mcp';
    return {
      icon: '🔌',
      label: `MCP: ${serverName}`,
      description: `External MCP server tool`,
      color: '#8b949e',
    };
  }

  return (
    TOOL_METADATA[toolName] || {
      icon: '🔧',
      label: toolName,
      description: 'Tool execution',
      color: '#8b949e',
    }
  );
}

/**
 * Format tool content with bolded tool names and enhanced metadata
 * Tool content format: "ToolName: detail" or just "ToolName" per line
 * Task tool calls link to their agent task view
 * Bash tool calls render command in code block (multi-line supported)
 * Read tool shows clickable file path
 * Edit tool shows diff view
 */
function formatToolContent(
  content: string,
  sessionId: string,
  navigate: (path: string) => void,
  onOpenModal?: (
    title: string,
    content: string,
    type: 'raw' | 'file' | 'diff'
  ) => void
): React.ReactElement[] {
  const lines = content.split('\n');
  const elements: React.ReactElement[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const colonIndex = line.indexOf(':');

    if (colonIndex > 0) {
      const toolName = line.slice(0, colonIndex);
      const detail = line.slice(colonIndex + 1).trim();
      const meta = getToolMetadata(toolName);

      // Check if this is a Task tool call - the detail might contain agent ID
      if (toolName === 'Task') {
        const agentIdMatch = detail.match(
          /agent[_-]?id[:\s=]*['"]?([a-f0-9-]+)/i
        );
        if (agentIdMatch) {
          const agentId = agentIdMatch[1];
          elements.push(
            <HStack
              key={i}
              className="tool-line tool-task"
              gap="xs"
              align="baseline"
            >
              <Text className="tool-icon">{meta.icon}</Text>
              <Text
                weight="semibold"
                className="tool-name"
                style={{ color: meta.color }}
              >
                {meta.label}
              </Text>
              <Text className="tool-detail" size="xs" color="muted">
                {meta.description}
              </Text>
              <Link
                href={`/sessions/${sessionId}/tasks/${agentId}`}
                className="task-link"
                onClick={(e) => {
                  e.preventDefault();
                  navigate(`/sessions/${sessionId}/tasks/${agentId}`);
                }}
              >
                {detail}
              </Link>
            </HStack>
          );
          i++;
          continue;
        }
        // Task without agent ID
        elements.push(
          <HStack
            key={i}
            className="tool-line tool-task"
            gap="xs"
            align="baseline"
          >
            <Text className="tool-icon">{meta.icon}</Text>
            <Text
              weight="semibold"
              className="tool-name"
              style={{ color: meta.color }}
            >
              {meta.label}
            </Text>
            <Text className="tool-detail" size="xs" color="muted">
              {meta.description}
            </Text>
            <Text className="tool-value">{detail}</Text>
          </HStack>
        );
        i++;
        continue;
      }

      // Read tool - clickable file path
      if (toolName === 'Read') {
        const filePath = detail;
        elements.push(
          <HStack
            key={i}
            className="tool-line tool-read"
            gap="xs"
            align="baseline"
          >
            <Text className="tool-icon">{meta.icon}</Text>
            <Text
              weight="semibold"
              className="tool-name"
              style={{ color: meta.color }}
            >
              {meta.label}
            </Text>
            {onOpenModal ? (
              <Button
                variant="ghost"
                size="sm"
                className="file-link"
                onClick={() => {
                  if (!onOpenModal) {
                    return;
                  }
                  onOpenModal(`File: ${filePath}`, filePath, 'file');
                }}
              >
                {filePath}
              </Button>
            ) : (
              <Text className="file-path" style={{ fontFamily: 'monospace' }}>
                {filePath}
              </Text>
            )}
          </HStack>
        );
        i++;
        continue;
      }

      // Write tool - file creation
      if (toolName === 'Write') {
        const filePath = detail;
        elements.push(
          <HStack
            key={i}
            className="tool-line tool-write"
            gap="xs"
            align="baseline"
          >
            <Text className="tool-icon">{meta.icon}</Text>
            <Text
              weight="semibold"
              className="tool-name"
              style={{ color: meta.color }}
            >
              {meta.label}
            </Text>
            <Text className="file-path" style={{ fontFamily: 'monospace' }}>
              {filePath}
            </Text>
          </HStack>
        );
        i++;
        continue;
      }

      // Edit tool - show file being edited
      if (toolName === 'Edit') {
        const filePath = detail;
        elements.push(
          <HStack
            key={i}
            className="tool-line tool-edit"
            gap="xs"
            align="baseline"
          >
            <Text className="tool-icon">{meta.icon}</Text>
            <Text
              weight="semibold"
              className="tool-name"
              style={{ color: meta.color }}
            >
              {meta.label}
            </Text>
            <Text className="file-path" style={{ fontFamily: 'monospace' }}>
              {filePath}
            </Text>
          </HStack>
        );
        i++;
        continue;
      }

      // Grep tool - search pattern
      if (toolName === 'Grep') {
        elements.push(
          <HStack
            key={i}
            className="tool-line tool-grep"
            gap="xs"
            align="baseline"
          >
            <Text className="tool-icon">{meta.icon}</Text>
            <Text
              weight="semibold"
              className="tool-name"
              style={{ color: meta.color }}
            >
              {meta.label}
            </Text>
            <Text className="tool-detail" size="xs" color="muted">
              Pattern:
            </Text>
            <Text
              className="search-pattern"
              style={{ fontFamily: 'monospace' }}
            >
              {detail}
            </Text>
          </HStack>
        );
        i++;
        continue;
      }

      // Glob tool - file pattern
      if (toolName === 'Glob') {
        elements.push(
          <HStack
            key={i}
            className="tool-line tool-glob"
            gap="xs"
            align="baseline"
          >
            <Text className="tool-icon">{meta.icon}</Text>
            <Text
              weight="semibold"
              className="tool-name"
              style={{ color: meta.color }}
            >
              {meta.label}
            </Text>
            <Text className="tool-detail" size="xs" color="muted">
              Pattern:
            </Text>
            <Text className="file-pattern" style={{ fontFamily: 'monospace' }}>
              {detail}
            </Text>
          </HStack>
        );
        i++;
        continue;
      }

      // TodoWrite tool
      if (toolName === 'TodoWrite') {
        elements.push(
          <HStack
            key={i}
            className="tool-line tool-todo"
            gap="xs"
            align="baseline"
          >
            <Text className="tool-icon">{meta.icon}</Text>
            <Text
              weight="semibold"
              className="tool-name"
              style={{ color: meta.color }}
            >
              {meta.label}
            </Text>
            <Text className="tool-detail" size="xs" color="muted">
              {meta.description}
            </Text>
          </HStack>
        );
        i++;
        continue;
      }

      // Bash tool calls render in code block - collect all following lines until next tool
      if (toolName === 'Bash') {
        const commandLines = [detail];
        // Collect subsequent lines that are part of the same command
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j];
          const nextColonIdx = nextLine.indexOf(':');
          if (nextColonIdx > 0 && nextColonIdx < 20) {
            const possibleTool = nextLine.slice(0, nextColonIdx);
            if (/^[A-Z][a-zA-Z]+$/.test(possibleTool)) {
              break;
            }
          }
          commandLines.push(nextLine);
          j++;
        }

        const code = commandLines.join('\n');
        const hasAnsiCodes = containsAnsi(code);

        elements.push(
          <VStack
            key={i}
            className="tool-line tool-bash"
            gap="xs"
            align="stretch"
          >
            <HStack gap="xs" align="center">
              <Text className="tool-icon">{meta.icon}</Text>
              <Text
                weight="semibold"
                className="tool-name"
                style={{ color: meta.color }}
              >
                {meta.label}
              </Text>
            </HStack>
            <pre className="bash-command">
              {hasAnsiCodes ? (
                // Render ANSI codes with proper colors
                <AnsiText className="hljs">{code}</AnsiText>
              ) : (
                // Apply syntax highlighting for plain bash commands
                <code
                  className="hljs language-bash"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: syntax highlighting
                  dangerouslySetInnerHTML={{
                    __html: hljs.highlight(code, { language: 'bash' }).value,
                  }}
                />
              )}
            </pre>
          </VStack>
        );
        i = j;
        continue;
      }

      // Default tool rendering with metadata
      elements.push(
        <HStack key={i} className="tool-line" gap="xs" align="baseline">
          <Text className="tool-icon">{meta.icon}</Text>
          <Text
            weight="semibold"
            className="tool-name"
            style={{ color: meta.color }}
          >
            {meta.label}
          </Text>
          {detail && <Text className="tool-value">{detail}</Text>}
        </HStack>
      );
    } else if (line.trim()) {
      elements.push(
        <Box key={i} className="tool-line">
          <Text weight="semibold" className="tool-name">
            {line}
          </Text>
        </Box>
      );
    }
    i++;
  }

  return elements;
}

interface MessageItemProps {
  message: MessageItemMessage;
  sessionId: string;
}

export function MessageItem({
  message,
  sessionId,
}: MessageItemProps): React.ReactElement {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const isUser = message.type === 'USER';
  const isSummary = message.type === 'SUMMARY';
  const content = message.content || '';
  const isLong = content.length > 500;
  const displayContent =
    isLong && !expanded ? `${content.slice(0, 500)}...` : content;

  return (
    <Box
      className={`message message-${message.type.toLowerCase()} ${message.isToolOnly ? 'message-tool-only' : ''}`}
    >
      <HStack className="message-header" gap="md" align="center">
        <Text
          className={`message-role ${isUser ? 'role-user' : isSummary ? 'role-summary' : 'role-claude'}`}
          size="sm"
          weight="semibold"
        >
          {isUser ? 'User' : isSummary ? 'Summary' : 'Claude'}
        </Text>
        <Text className="message-time" size="sm" color="muted">
          {formatDate(message.timestamp)}
        </Text>
        {message.isToolOnly && <Badge>Tool</Badge>}
      </HStack>
      <Box
        className={`message-content ${isLong && !expanded ? 'truncated' : ''}`}
      >
        {message.isToolOnly ? (
          formatToolContent(displayContent, sessionId, navigate)
        ) : (
          <MarkdownContent>{displayContent}</MarkdownContent>
        )}
      </Box>
      {isLong && (
        <Button
          variant="secondary"
          size="sm"
          className="expand-btn"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show Less' : 'Show More'}
        </Button>
      )}
    </Box>
  );
}
