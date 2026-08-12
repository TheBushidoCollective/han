/**
 * Session Detail Header
 *
 * Sticky banner with session identity, stats, and resume command.
 */

import type React from 'react';
import { useCallback, useState } from 'react';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Pressable } from '@/components/atoms/Pressable.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import {
  cleanSessionSummary,
  formatDuration,
  formatWholeNumber,
  pluralize,
  stripXmlTags,
} from '@/components/helpers/formatters.ts';
import { HarnessBadge } from '@/components/molecules/HarnessBadge.tsx';
import { colors, fonts, radii, spacing } from '@/theme.ts';

interface SessionDetailHeaderProps {
  name: string | null | undefined;
  summary: string | null | undefined;
  sessionId: string;
  projectName: string | null | undefined;
  gitBranch: string | null | undefined;
  prNumber: number | null | undefined;
  prUrl: string | null | undefined;
  teamName: string | null | undefined;
  harness: string | null | undefined;
  messageCount: number;
  turnCount: number | null | undefined;
  duration: number | null | undefined;
  estimatedCostUsd: number | null | undefined;
  compactionCount: number | null | undefined;
  status: string | null | undefined;
  isAgentTask?: boolean;
  onBack: () => void;
}

export function SessionDetailHeader({
  name,
  summary,
  sessionId,
  projectName,
  gitBranch,
  prNumber,
  prUrl,
  teamName,
  harness,
  messageCount,
  turnCount,
  duration,
  estimatedCostUsd,
  compactionCount,
  status,
  isAgentTask = false,
  onBack,
}: SessionDetailHeaderProps): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const resumeCommand = `claude --resume ${sessionId}`;

  // Prefer slug (name) for heading, but fall back to cleaned summary or truncated session ID
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const displayName =
    name && !isUuid.test(name)
      ? stripXmlTags(name)
      : (cleanSessionSummary(summary) ?? `Session ${sessionId.slice(0, 8)}`);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(resumeCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for restricted environments
    }
  }, [resumeCommand]);

  const statusColor =
    status === 'active'
      ? colors.success
      : status === 'completed'
        ? colors.text.muted
        : colors.warning;

  const statusLabel =
    status === 'active'
      ? 'Active'
      : status === 'completed'
        ? 'Completed'
        : (status ?? 'Unknown');

  return (
    <Box
      style={{
        flexShrink: 0,
        backgroundColor: colors.bg.primary,
        paddingTop: spacing.md,
        paddingBottom: spacing.md,
        paddingLeft: spacing.lg,
        paddingRight: spacing.lg,
        borderBottom: `1px solid ${colors.border.default}`,
      }}
    >
      <VStack gap="sm">
        {/* Row 1: Back + slug + status */}
        <HStack justify="space-between" align="center">
          <HStack gap="sm" align="center" style={{ flex: 1, minWidth: 0 }}>
            <Pressable onPress={onBack}>
              <Text size="sm" color="secondary" style={{ cursor: 'pointer' }}>
                {isAgentTask ? '< Parent' : '< Back'}
              </Text>
            </Pressable>
            <Heading size="sm" style={{ flex: 1, minWidth: 0 }}>
              {displayName}
            </Heading>
            {isAgentTask && <Badge variant="purple">Agent Task</Badge>}
          </HStack>
          <HStack gap="xs" align="center">
            <Box
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: statusColor,
                boxShadow: `0 0 0 2px ${statusColor}33`,
              }}
            />
            <Text size="xs" style={{ color: statusColor }}>
              {statusLabel}
            </Text>
          </HStack>
        </HStack>

        {/* Row 2: Summary (if different from displayed heading) */}
        {cleanSessionSummary(summary) &&
          cleanSessionSummary(summary) !== displayName && (
            <Text size="sm" color="secondary" truncate>
              {cleanSessionSummary(summary)}
            </Text>
          )}

        {/* Row 3: Stats line */}
        <HStack gap="sm" align="center" style={{ flexWrap: 'wrap' }}>
          {projectName && (
            <Text size="xs" color="muted">
              {projectName}
            </Text>
          )}
          {gitBranch && <Badge variant="info">{gitBranch}</Badge>}
          {prNumber != null &&
            (prUrl ? (
              <Pressable
                onPress={() => {
                  window.open(prUrl, '_blank', 'noopener,noreferrer');
                }}
              >
                <Badge variant="success">PR #{prNumber}</Badge>
              </Pressable>
            ) : (
              <Badge variant="success">PR #{prNumber}</Badge>
            ))}
          {teamName && <Badge variant="purple">{teamName}</Badge>}
          <HarnessBadge harness={harness} />
          {duration != null && duration > 0 && (
            <Text size="xs" color="muted">
              {formatDuration(duration)}
            </Text>
          )}
          {estimatedCostUsd != null && estimatedCostUsd >= 0.01 && (
            <Text size="xs" color="muted">
              ${estimatedCostUsd.toFixed(2)}
            </Text>
          )}
          {turnCount != null && turnCount > 0 && (
            <Text size="xs" color="muted">
              {turnCount} turns
            </Text>
          )}
          <Text size="xs" color="muted">
            {formatWholeNumber(messageCount)} msgs
          </Text>
          {compactionCount != null && compactionCount > 0 && (
            <Badge variant="warning">
              {pluralize(compactionCount, 'compaction')}
            </Badge>
          )}
        </HStack>

        {/* Row 4: Resume command */}
        <HStack gap="sm" align="center">
          <Box
            style={{
              flex: 1,
              backgroundColor: colors.bg.tertiary,
              borderRadius: radii.sm,
              padding: `${spacing.xs}px ${spacing.sm}px`,
              fontFamily: fonts.mono,
              overflow: 'hidden',
            }}
          >
            <Text
              size="xs"
              style={{
                fontFamily: fonts.mono,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                padding: spacing.sm,
              }}
            >
              {resumeCommand}
            </Text>
          </Box>
          <Button variant="secondary" size="sm" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
}
