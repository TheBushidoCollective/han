/**
 * Repo Detail Page
 *
 * Shows details for a single repository with links to sub-pages.
 * Uses Relay for data fetching with Suspense for loading states.
 *
 * Repos are identified by git remote-based IDs (e.g., github-com-org-repo)
 */

import type React from 'react';
import { Suspense } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import { useNavigate, useParams } from 'react-router-dom';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Spinner } from '@/components/atoms/Spinner.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { theme } from '@/components/atoms/theme.ts';
import { VStack } from '@/components/atoms/VStack.tsx';
import { formatRelativeTime } from '../Shared/utils.ts';
import type { RepoDetailPageQuery as RepoDetailPageQueryType } from './__generated__/RepoDetailPageQuery.graphql.ts';

const RepoDetailPageQueryDef = graphql`
  query RepoDetailPageQuery($id: String!) {
    repo(id: $id) {
      id
      repoId
      name
      path
      totalSessions
      lastActivity
    }
  }
`;

/**
 * Navigation card component
 */
function NavCard({
  title,
  description,
  icon,
  href,
}: {
  title: string;
  description: string;
  icon: string;
  href: string;
}): React.ReactElement {
  const navigate = useNavigate();

  return (
    <Box
      onClick={() => navigate(href)}
      style={{
        padding: theme.spacing.lg,
        backgroundColor: theme.colors.background.secondary,
        borderRadius: theme.borderRadius.lg,
        border: `1px solid ${theme.colors.border.default}`,
        cursor: 'pointer',
      }}
    >
      <HStack gap="md" align="center">
        <Text style={{ fontSize: '24px' }}>{icon}</Text>
        <VStack gap="xs">
          <Text weight={600}>{title}</Text>
          <Text size="sm" color="muted">
            {description}
          </Text>
        </VStack>
      </HStack>
    </Box>
  );
}

/**
 * Stat card component
 */
function StatCard({
  value,
  label,
}: {
  value: string | number;
  label: string;
}): React.ReactElement {
  return (
    <Box
      style={{
        padding: theme.spacing.lg,
        backgroundColor: theme.colors.background.secondary,
        borderRadius: theme.borderRadius.lg,
        border: `1px solid ${theme.colors.border.default}`,
        textAlign: 'center',
      }}
    >
      <VStack gap="xs" align="center">
        <Text size="xl" weight={600}>
          {value}
        </Text>
        <Text size="sm" color="muted">
          {label}
        </Text>
      </VStack>
    </Box>
  );
}

/**
 * Inner repo detail content component that uses Relay hooks
 */
function RepoDetailContent({ repoId }: { repoId: string }): React.ReactElement {
  const navigate = useNavigate();

  const data = useLazyLoadQuery<RepoDetailPageQueryType>(
    RepoDetailPageQueryDef,
    { id: repoId },
    { fetchPolicy: 'store-and-network' }
  );

  const repo = data.repo;

  if (!repo) {
    return (
      <VStack gap="md" style={{ padding: theme.spacing.xl }}>
        <Heading size="md">Not Found</Heading>
        <Text color="secondary">Repository not found: {repoId}</Text>
        <Button onClick={() => navigate('/repos')}>Back to Repos</Button>
      </VStack>
    );
  }

  return (
    <VStack gap="xl" style={{ padding: theme.spacing.xl }}>
      {/* Header */}
      <HStack justify="space-between" align="center">
        <VStack gap="xs">
          <HStack gap="sm" align="center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/repos')}
            >
              Repos
            </Button>
            <Text color="muted">/</Text>
            <Text weight={600}>{repo.name}</Text>
          </HStack>
          <Text size="sm" color="muted">
            {repo.path}
          </Text>
        </VStack>
        <HStack gap="sm">
          <Text color="muted">{repo.totalSessions ?? 0} sessions</Text>
        </HStack>
      </HStack>

      {/* Quick Stats */}
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: theme.spacing.md,
        }}
      >
        <StatCard value={repo.totalSessions ?? 0} label="Sessions" />
        <StatCard
          value={formatRelativeTime(repo.lastActivity ?? '')}
          label="Last Activity"
        />
      </Box>

      {/* Navigation Cards */}
      <VStack gap="md">
        <Heading size="sm" as="h3">
          Quick Access
        </Heading>
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: theme.spacing.md,
          }}
        >
          <NavCard
            title="Sessions"
            description="Browse all sessions for this repository"
            icon="📋"
            href={`/repos/${repo.repoId}/sessions`}
          />
          <NavCard
            title="Memory"
            description="Repository-specific rules and knowledge"
            icon="🧠"
            href={`/repos/${repo.repoId}/memory`}
          />
          <NavCard
            title="Cache"
            description="Cached hooks and files for this repository"
            icon="💾"
            href={`/repos/${repo.repoId}/cache`}
          />
          <NavCard
            title="Settings"
            description="Repository-specific configuration"
            icon="⚙️"
            href={`/repos/${repo.repoId}/settings`}
          />
        </Box>
      </VStack>
    </VStack>
  );
}

/**
 * Repo detail page with Suspense boundary
 */
export default function RepoDetailPage(): React.ReactElement {
  const navigate = useNavigate();
  const params = useParams<{ repoId: string }>();
  const repoId = params.repoId;

  if (!repoId) {
    return (
      <VStack gap="md" style={{ padding: theme.spacing.xl }}>
        <Heading size="md">Not Found</Heading>
        <Text color="secondary">No repository ID provided</Text>
        <Button onClick={() => navigate('/repos')}>Back to Repos</Button>
      </VStack>
    );
  }

  return (
    <Suspense
      fallback={
        <VStack
          gap="md"
          align="center"
          justify="center"
          style={{ minHeight: '200px' }}
        >
          <Spinner size="lg" />
          <Text color="secondary">Loading repository...</Text>
        </VStack>
      }
    >
      <RepoDetailContent repoId={repoId} />
    </Suspense>
  );
}
