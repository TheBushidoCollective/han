/**
 * Shared components for MessageCards
 *
 * Contains MessageHeader, MessageWrapper, and utility functions
 * used across all message type card components.
 */

import type React from 'react';
import { useState } from 'react';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { colors, createStyles, fonts, radii, spacing } from '@/theme.ts';

/**
 * Message role display info
 */
export interface MessageRoleInfo {
  label: string;
  color: string;
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

const styles = createStyles({
  messageHeader: {
    marginBottom: spacing.md,
  },
  rawJsonContent: {
    backgroundColor: colors.bg.primary,
    border: `1px solid ${colors.border}`,
    borderRadius: radii.md,
    padding: spacing.md,
    fontFamily: fonts.mono,
    fontSize: 12,
    overflow: 'auto' as const,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    color: colors.text.primary,
    margin: 0,
  },
});

const messageTypeStyles: Record<string, React.CSSProperties> = {
  user: {
    backgroundColor: colors.bg.tertiary,
    borderLeft: `3px solid ${colors.primary}`,
  },
  assistant: {
    backgroundColor: colors.bg.secondary,
    borderLeft: `3px solid ${colors.success}`,
  },
  summary: {
    backgroundColor: colors.bg.secondary,
    borderLeft: `3px solid ${colors.purple}`,
  },
  han_event: {
    backgroundColor: colors.bg.secondary,
    borderLeft: `3px solid ${colors.warning}`,
  },
};

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
    <HStack style={styles.messageHeader} gap="md" align="center">
      <Text size="sm">{roleInfo.icon}</Text>
      <Text
        size="sm"
        weight="semibold"
        style={roleInfo.color ? { color: roleInfo.color } : undefined}
      >
        {roleInfo.label}
      </Text>
      <Text size="sm" color="muted">
        {formatTimestamp(timestamp)}
      </Text>

      {/* Message metadata badges */}
      <HStack gap="xs" align="center" style={{ marginLeft: 'auto' }}>
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
 * Shared message wrapper component with card styling
 */
export function MessageWrapper({
  type,
  isToolOnly = false,
  children,
}: MessageWrapperProps): React.ReactElement {
  const baseStyle: React.CSSProperties = {
    padding: spacing.md,
    borderRadius: radii.md,
    border: `1px solid ${colors.border.subtle}`,
    ...(isToolOnly && { opacity: 0.9 }),
  };

  return (
    <div style={{ ...baseStyle, ...messageTypeStyles[type] }}>{children}</div>
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
    <pre style={styles.rawJsonContent}>
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
