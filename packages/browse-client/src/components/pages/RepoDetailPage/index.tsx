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
import { theme } from '@/components/atoms';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Spinner } from '@/components/atoms/Spinner.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import { NavCard } from '@/components/organisms/NavCard.tsx';
import { StatCard } from '@/components/organisms/StatCard.tsx';
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
      projects {
        id
        projectId
        name
        totalSessions
        lastActivity
        worktrees {
          name
          path
          isWorktree
          sessionCount
        }
      }
    }
  }
`;

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
            <Text weight="semibold">{repo.name}</Text>
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
        <StatCard
          value={repo.totalSessions ?? 0}
          label="Sessions"
          variant="value-first"
          centered
        />
        <StatCard
          value={formatRelativeTime(repo.lastActivity ?? '')}
          label="Last Activity"
          variant="value-first"
          centered
        />
      </Box>

      {/* Projects List */}
      {repo.projects && repo.projects.length > 0 && (
        <VStack gap="md">
          <Heading size="sm" as="h3">
            Projects
          </Heading>
          <VStack gap="sm">
            {repo.projects.map((project) => (
              <Box
                key={project.id}
                onClick={() => navigate(`/projects/${project.projectId}`)}
                style={{
                  padding: theme.spacing.md,
                  backgroundColor: theme.colors.bg.secondary,
                  borderRadius: theme.radii.md,
                  cursor: 'pointer',
                  border: `1px solid ${theme.colors.border.default}`,
                }}
              >
                <VStack gap="xs">
                  <HStack justify="space-between" align="center">
                    <Text weight="semibold">{project.name}</Text>
                    <Text size="sm" color="muted">
                      {project.totalSessions ?? 0} sessions
                    </Text>
                  </HStack>
                  {project.worktrees && project.worktrees.length > 0 && (
                    <Text size="sm" color="muted">
                      {project.worktrees[0].path}
                    </Text>
                  )}
                  {project.lastActivity && (
                    <Text size="sm" color="muted">
                      Last: {formatRelativeTime(project.lastActivity)}
                    </Text>
                  )}
                </VStack>
              </Box>
            ))}
          </VStack>
        </VStack>
      )}

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
            title="Plugins"
            description="Project and local scope plugins"
            icon="🔌"
            href={`/repos/${repo.repoId}/plugins`}
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
