/**
 * Cache Entry Card Component
 *
 * Displays a single cache entry with plugin/hook info.
 */

import type React from 'react';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Card } from '@/components/atoms/Card.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';

/**
 * Format relative time
 */
function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export interface CacheEntry {
  id: string;
  pluginName: string | null | undefined;
  hookName: string | null | undefined;
  fileCount: number | null | undefined;
  lastModified: string | null | undefined;
}

interface CacheEntryCardProps {
  entry: CacheEntry;
}

export function CacheEntryCard({
  entry,
}: CacheEntryCardProps): React.ReactElement {
  return (
    <Card>
      <VStack gap="sm">
        <HStack justify="space-between" align="center">
          <Text weight="semibold">{entry.pluginName ?? 'Unknown'}</Text>
          <Badge>{entry.hookName ?? 'unknown'}</Badge>
        </HStack>
        <HStack justify="space-between" align="center">
          <Text size="sm" color="secondary">
            <Text weight="semibold" size="sm">
              {entry.fileCount ?? 0}
            </Text>{' '}
            tracked files
          </Text>
          <Text size="sm" color="muted">
            {formatRelativeTime(entry.lastModified)}
          </Text>
        </HStack>
      </VStack>
    </Card>
  );
}
