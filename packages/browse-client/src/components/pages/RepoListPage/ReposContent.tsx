/**
 * Repos Content Component
 *
 * Displays repos grid with filtering and sorting.
 * Uses usePreloadedQuery to read from the preloaded query reference.
 */

import type React from 'react';
import { useMemo, useState } from 'react';
import type { PreloadedQuery } from 'react-relay';
import { usePreloadedQuery } from 'react-relay';
import { theme } from '@/components/atoms';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Input } from '@/components/atoms/Input.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import type { RepoListPageQuery as RepoListPageQueryType } from './__generated__/RepoListPageQuery.graphql.ts';
import { RepoCard, type SortOption } from './components.ts';
import { RepoListPageQuery } from './index.tsx';

// Define Repo type for internal use
interface Repo {
  id: string;
  repoId: string;
  name: string;
  path: string;
  totalSessions: number;
  lastActivity: string | null;
}

interface ReposContentProps {
  queryRef: PreloadedQuery<RepoListPageQueryType>;
}

export function ReposContent({
  queryRef,
}: ReposContentProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('activity');

  const data = usePreloadedQuery<RepoListPageQueryType>(
    RepoListPageQuery,
    queryRef
  );

  const repos: Repo[] = useMemo(() => {
    return (data.repos ?? [])
      .filter((r): r is typeof r & { id: string } => !!r.id)
      .map((r) => ({
        id: r.id,
        repoId: r.repoId ?? '',
        name: r.name ?? 'Unknown',
        path: r.path ?? '',
        totalSessions: r.totalSessions ?? 0,
        lastActivity: r.lastActivity ?? null,
      }));
  }, [data.repos]);

  // Filter and sort repos
  const filteredRepos = useMemo(() => {
    let result = repos;

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.repoId.toLowerCase().includes(q) ||
          r.path.toLowerCase().includes(q)
      );
    }

    // Sort repos
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'activity':
          if (!a.lastActivity) return 1;
          if (!b.lastActivity) return -1;
          return (
            new Date(b.lastActivity).getTime() -
            new Date(a.lastActivity).getTime()
          );
        case 'sessions':
          return b.totalSessions - a.totalSessions;
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return result;
  }, [repos, searchQuery, sortBy]);

  return (
    <VStack style={{ height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <HStack
        justify="space-between"
        align="center"
        style={{
          padding: theme.spacing.lg,
          borderBottom: `1px solid ${theme.colors.border.default}`,
          flexShrink: 0,
        }}
      >
        <HStack gap="md" align="center">
          <Heading size="lg">Repositories</Heading>
          <Text color="secondary">{repos.length} repos</Text>
        </HStack>
        <HStack gap="md" align="center">
          {/* Search input */}
          <Box
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Input
              placeholder="Search repos..."
              value={searchQuery}
              onChange={setSearchQuery}
              style={{ minWidth: '200px' }}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: theme.spacing.xs,
                  padding: theme.spacing.xs,
                }}
              >
                x
              </Button>
            )}
          </Box>
          {/* Sort select */}
          <HStack gap="sm" align="center">
            <Text size="sm" color="secondary">
              Sort by:
            </Text>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              style={{
                backgroundColor: theme.colors.bg.tertiary,
                border: `1px solid ${theme.colors.border.default}`,
                borderRadius: theme.borderRadius.md,
                color: theme.colors.text.primary,
                fontSize: theme.fontSize.sm,
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="activity">Recent Activity</option>
              <option value="sessions">Session Count</option>
              <option value="name">Name</option>
            </select>
          </HStack>
        </HStack>
      </HStack>

      {/* Grid of cards */}
      <Box
        style={{
          flex: 1,
          overflow: 'auto',
          padding: theme.spacing.lg,
        }}
      >
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: theme.spacing.lg,
          }}
        >
          {filteredRepos.map((repo) => (
            <RepoCard key={repo.id} repo={repo} />
          ))}
        </Box>

        {filteredRepos.length === 0 && repos.length > 0 && (
          <VStack
            gap="sm"
            align="center"
            justify="center"
            style={{ padding: theme.spacing.xxl }}
          >
            <Text color="secondary">No repos match your search.</Text>
          </VStack>
        )}

        {repos.length === 0 && (
          <VStack
            gap="sm"
            align="center"
            justify="center"
            style={{ padding: theme.spacing.xxl }}
          >
            <Text color="secondary">
              No repositories found. Start using Claude Code to create sessions!
            </Text>
          </VStack>
        )}
      </Box>
    </VStack>
  );
}
