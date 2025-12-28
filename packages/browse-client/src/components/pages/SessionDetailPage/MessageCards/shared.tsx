/**
 * Shared components for MessageCards
 *
 * Contains MessageHeader, MessageWrapper, and utility functions
 * used across all message type card components.
 */

import type React from 'react';
import { useState } from 'react';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';

/**
 * Message role display info
 */
export interface MessageRoleInfo {
  label: string;
  className: string;
  icon: string;
}

/**
 * Format a timestamp for display
 */
export function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return timestamp;
  }
}

/**
 * Format raw JSON for display
 */
export function formatRawJson(rawJson: string | null): string {
  if (!rawJson) return 'No raw JSON available';
  try {
    const parsed = JSON.parse(rawJson);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return rawJson;
  }
}

interface MessageHeaderProps {
  roleInfo: MessageRoleInfo;
  timestamp: string;
  badges?: React.ReactNode;
  showRawJson: boolean;
  onToggleRawJson: () => void;
}

/**
 * Shared message header component
 */
export function MessageHeader({
  roleInfo,
  timestamp,
  badges,
  showRawJson,
  onToggleRawJson,
}: MessageHeaderProps): React.ReactElement {
  return (
    <HStack className="message-header" gap="md" align="center">
      <Text size="sm">{roleInfo.icon}</Text>
      <Text
        className={`message-role ${roleInfo.className}`}
        size="sm"
        weight={600}
      >
        {roleInfo.label}
      </Text>
      <Text className="message-time" size="sm" color="muted">
        {formatTimestamp(timestamp)}
      </Text>

      {/* Message metadata badges */}
      <HStack gap="xs" style={{ marginLeft: 'auto' }}>
        {badges}
        {showRawJson && <Badge variant="info">RAW</Badge>}
        <span title={showRawJson ? 'Show formatted' : 'Show raw JSON'}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleRawJson}
            style={{ padding: '2px 6px', fontSize: '11px' }}
          >
            {'{ }'}
          </Button>
        </span>
      </HStack>
    </HStack>
  );
}

interface MessageWrapperProps {
  type: 'user' | 'assistant' | 'summary' | 'han_event';
  isToolOnly?: boolean;
  showRawJson?: boolean;
  children: React.ReactNode;
}

/**
 * Shared message wrapper component with appropriate styling
 */
export function MessageWrapper({
  type,
  isToolOnly = false,
  showRawJson = false,
  children,
}: MessageWrapperProps): React.ReactElement {
  return (
    <Box
      className={`message message-${type} ${isToolOnly ? 'message-tool-only' : ''} ${showRawJson ? 'message-raw' : ''}`}
    >
      {children}
    </Box>
  );
}

interface RawJsonViewProps {
  rawJson: string | null;
}

/**
 * Raw JSON view component
 */
export function RawJsonView({ rawJson }: RawJsonViewProps): React.ReactElement {
  return (
    <pre className="raw-json-content">
      <code>{formatRawJson(rawJson)}</code>
    </pre>
  );
}

/**
 * Hook to manage raw JSON toggle state
 */
export function useRawJsonToggle(): {
  showRawJson: boolean;
  toggleRawJson: () => void;
} {
  const [showRawJson, setShowRawJson] = useState(false);
  const toggleRawJson = () => setShowRawJson((prev) => !prev);
  return { showRawJson, toggleRawJson };
}
