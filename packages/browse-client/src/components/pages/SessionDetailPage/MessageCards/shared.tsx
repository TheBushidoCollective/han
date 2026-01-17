/**
 * Shared components for MessageCards
 *
 * Contains MessageHeader, MessageWrapper, and utility functions
 * used across all message type card components.
 */

import type React from 'react';
import {
  type CSSProperties,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { ViewStyle } from 'react-native-web';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { colors, createStyles, fonts, radii, spacing } from '@/theme.ts';

// =============================================================================
// Message Context - Provides shared message metadata to child components
// =============================================================================

interface MessageContextValue {
  /** Global message ID for linking to detail page */
  messageId: string | null;
}

const MessageContext = createContext<MessageContextValue>({ messageId: null });

/**
 * Provider for message context - wraps message cards to provide shared metadata
 */
export function MessageContextProvider({
  messageId,
  children,
}: {
  messageId: string | null;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <MessageContext.Provider value={{ messageId }}>
      {children}
    </MessageContext.Provider>
  );
}

/**
 * Hook to access message context
 */
export function useMessageContext(): MessageContextValue {
  return useContext(MessageContext);
}

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
 * - Shows relative time (e.g., "2 minutes ago") if within the same day
 * - Shows full date/time (e.g., "Dec 30, 2025 2:15:30 PM") otherwise
 */
export function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();

    // Check if same day
    const isSameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    if (isSameDay) {
      // Show relative time for today
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);

      if (diffSecs < 60) {
        return diffSecs <= 1 ? 'just now' : `${diffSecs}s ago`;
      }
      if (diffMins < 60) {
        return diffMins === 1 ? '1m ago' : `${diffMins}m ago`;
      }
      return diffHours === 1 ? '1h ago' : `${diffHours}h ago`;
    }

    // Show full date/time for other days
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return timestamp;
  }
}

/**
 * Calculate the appropriate update interval based on how old a timestamp is.
 * - Less than 60 seconds: update every 1 second
 * - 1-10 minutes: update every 10 seconds
 * - 10-60 minutes: update every 30 seconds
 * - More than 1 hour: update every minute
 */
function getUpdateInterval(diffMs: number): number {
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);

  if (diffSecs < 60) return 1000; // 1 second
  if (diffMins < 10) return 10000; // 10 seconds
  if (diffMins < 60) return 30000; // 30 seconds
  return 60000; // 1 minute
}

/**
 * Hook that provides a ticking relative time display.
 * Updates at variable intervals based on how old the timestamp is:
 * - Every 1s for times < 1 minute old
 * - Every 10s for times 1-10 minutes old
 * - Every 30s for times 10-60 minutes old
 * - Every 1m for times > 1 hour old
 */
export function useRelativeTime(timestamp: string | null | undefined): string {
  const getFormattedTime = useCallback(() => {
    if (!timestamp) return '-';
    return formatTimestamp(timestamp);
  }, [timestamp]);

  const [displayTime, setDisplayTime] = useState(getFormattedTime);

  useEffect(() => {
    if (!timestamp) return;

    // Update display immediately
    setDisplayTime(getFormattedTime());

    // Calculate initial interval
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // Don't tick for timestamps in the future or from other days
    const isSameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    if (!isSameDay || diffMs < 0) return;

    let currentInterval = getUpdateInterval(diffMs);
    let timerId: ReturnType<typeof setTimeout>;

    const tick = () => {
      const now = new Date();
      const newDiffMs = now.getTime() - date.getTime();
      const newInterval = getUpdateInterval(newDiffMs);

      setDisplayTime(formatTimestamp(timestamp));

      // Schedule next tick with potentially different interval
      if (newInterval !== currentInterval) {
        currentInterval = newInterval;
      }
      timerId = setTimeout(tick, currentInterval);
    };

    timerId = setTimeout(tick, currentInterval);

    return () => clearTimeout(timerId);
  }, [timestamp, getFormattedTime]);

  return displayTime;
}

/**
 * Component that displays a ticking relative time.
 * Uses useRelativeTime hook internally.
 */
interface RelativeTimeProps {
  timestamp: string | null | undefined;
  className?: string;
}

export function RelativeTime({
  timestamp,
}: RelativeTimeProps): React.ReactElement {
  const displayTime = useRelativeTime(timestamp);
  return (
    <Text size="sm" color="muted">
      {displayTime}
    </Text>
  );
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

const messageTypeStyles: Record<string, ViewStyle> = {
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
  /** Override message ID (uses context if not provided) */
  messageId?: string | null;
}

/**
 * Shared message header component
 * Automatically gets messageId from MessageContext if not explicitly provided
 */
export function MessageHeader({
  roleInfo,
  timestamp,
  badges,
  showRawJson,
  onToggleRawJson,
  messageId: messageIdProp,
}: MessageHeaderProps): React.ReactElement {
  // Use prop if provided, otherwise get from context
  const { messageId: contextMessageId } = useMessageContext();
  const messageId = (messageIdProp ?? contextMessageId)?.split(':', 2)[1];

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
      <RelativeTime timestamp={timestamp} />

      {/* Message metadata badges */}
      <HStack gap="xs" align="center" style={{ marginLeft: 'auto' }}>
        {badges}
        {showRawJson && <Badge variant="info">RAW</Badge>}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleRawJson}
          style={{ padding: '2px 6px', fontSize: '11px' }}
        >
          {'{ }'}
        </Button>
        {messageId && <MessageDetailLink messageId={messageId} />}
      </HStack>
    </HStack>
  );
}

/**
 * Link to message detail page using react-router-dom Link
 * Extracted to avoid inline HTML/DOM manipulation
 */
function MessageDetailLink({
  messageId,
}: {
  messageId: string;
}): React.ReactElement {
  const [hovered, setHovered] = useState(false);

  // Use CSSProperties for react-router-dom Link which renders a native anchor element
  const linkStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '2px 6px',
    fontSize: '11px',
    color: colors.text.secondary,
    textDecoration: 'none',
    borderRadius: radii.sm,
    backgroundColor: hovered ? colors.bg.tertiary : 'transparent',
  };

  return (
    <Link
      to={`/messages/${encodeURIComponent(messageId)}`}
      style={linkStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="View message details"
    >
      <Text size="xs">🔗</Text>
    </Link>
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
  const baseStyle: ViewStyle = {
    padding: spacing.md,
    borderRadius: radii.md,
    border: `1px solid ${colors.border.subtle}`,
    ...(isToolOnly && { opacity: 0.9 }),
  };

  return (
    <Box style={{ ...baseStyle, ...messageTypeStyles[type] }}>{children}</Box>
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
    <Box style={styles.rawJsonContent}>
      <Text
        size="sm"
        style={{ fontFamily: fonts.mono, color: colors.text.primary }}
      >
        {formatRawJson(rawJson)}
      </Text>
    </Box>
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
