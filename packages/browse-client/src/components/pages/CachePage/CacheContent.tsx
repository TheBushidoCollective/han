/**
 * Cache Content Component
 *
 * Displays cache entries using Relay.
 */

import type React from 'react';
import { useMemo, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import { theme } from '@/components/atoms';
import { Box } from '@/components/atoms/Box.tsx';
import { Card } from '@/components/atoms/Card.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Input } from '@/components/atoms/Input.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import { StatCard } from '@/components/organisms/StatCard.tsx';
import type { CacheContentQuery as CacheContentQueryType } from './__generated__/CacheContentQuery.graphql.ts';
import { CacheEntryCard } from './CacheEntryCard.tsx';

const CacheContentQueryDef = graphql`
  query CacheContentQuery {
    cacheEntries {
      id
      pluginName
      hookName
      fileCount
      lastModified
    }
    cacheStats {
      totalEntries
      totalFiles
      oldestEntry
      newestEntry
    }
  }
`;

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

export function CacheContent(): React.ReactElement {
  const [filter, setFilter] = useState('');

  const data = useLazyLoadQuery<CacheContentQueryType>(
    CacheContentQueryDef,
    {},
    { fetchPolicy: 'store-and-network' }
  );

  const cacheEntries = data.cacheEntries ?? [];
  const cacheStats = data.cacheStats ?? {
    totalEntries: 0,
    totalFiles: 0,
    oldestEntry: null,
    newestEntry: null,
  };

  // Filter entries by search - must be called before any early returns
  const filteredEntries = useMemo(() => {
    if (!filter) return cacheEntries;
    const searchLower = filter.toLowerCase();
    return cacheEntries.filter(
      (e) =>
        (e.pluginName?.toLowerCase().includes(searchLower) ?? false) ||
        (e.hookName?.toLowerCase().includes(searchLower) ?? false)
    );
  }, [cacheEntries, filter]);

  return (
    <VStack gap="lg" style={{ padding: theme.spacing.xl }}>
      {/* Header */}
      <HStack justify="space-between" align="center">
        <HStack gap="md" align="center">
          <Heading>Hook Cache</Heading>
          <Text color="secondary" size="sm">
            {cacheStats.totalEntries ?? 0} cached hooks |{' '}
            {cacheStats.totalFiles ?? 0} files
          </Text>
        </HStack>
      </HStack>

      {/* Stats Grid */}
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: theme.spacing.md,
        }}
      >
        <StatCard label="Cached Hooks" value={cacheStats.totalEntries ?? 0} />
        <StatCard label="Tracked Files" value={cacheStats.totalFiles ?? 0} />
        <StatCard
          label="Last Updated"
          value={formatRelativeTime(cacheStats.newestEntry)}
        />
        <StatCard
          label="Oldest Cache"
          value={formatRelativeTime(cacheStats.oldestEntry)}
        />
      </Box>

      {/* Search filter */}
      <Input
        placeholder="Filter by plugin or hook name..."
        value={filter}
        onChange={setFilter}
        style={{ width: '100%', maxWidth: '400px' }}
      />

      {/* Cache entries grid */}
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: theme.spacing.md,
        }}
      >
        {filteredEntries
          .filter((entry): entry is typeof entry & { id: string } => !!entry.id)
          .map((entry) => (
            <CacheEntryCard
              key={entry.id}
              entry={{
                id: entry.id,
                pluginName: entry.pluginName,
                hookName: entry.hookName,
                fileCount: entry.fileCount,
                lastModified: entry.lastModified,
              }}
            />
          ))}
      </Box>
      {filteredEntries.length === 0 && (
        <VStack gap="md" align="center" style={{ padding: theme.spacing.xl }}>
          <Text color="secondary">
            {filter
              ? 'No cache entries match your filter.'
              : 'No cached hook runs yet.'}
          </Text>
        </VStack>
      )}

      {/* Info hint */}
      <Card
        style={{
          backgroundColor: theme.colors.bg.tertiary,
        }}
      >
        <Text size="sm" color="secondary">
          The hook cache stores file hashes to skip unchanged hooks. Run{' '}
          <code
            style={{
              backgroundColor: theme.colors.bg.secondary,
              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
              borderRadius: theme.borderRadius.sm,
            }}
          >
            han hook run &lt;plugin&gt; &lt;hook&gt; --cache=false
          </code>{' '}
          to force re-run.
        </Text>
      </Card>
    </VStack>
  );
}
