/**
 * Project Detail Page
 *
 * Shows details for a single project/repo with links to sub-pages.
 * Uses Relay for data fetching with Suspense for loading states.
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
import type { ProjectDetailPageQuery as ProjectDetailPageQueryType } from './__generated__/ProjectDetailPageQuery.graphql.ts';
import { NavCard, PluginItem, StatCard, WorktreeItem } from './components.ts';

const ProjectDetailPageQueryDef = graphql`
  query ProjectDetailPageQuery($id: String!) {
    project(id: $id) {
      id
      projectId
      name
      totalSessions
      lastActivity
      worktrees {
        name
        path
        sessionCount
        isWorktree
        subdirs {
          relativePath
          path
          sessionCount
        }
      }
      plugins {
        id
        name
        marketplace
        scope
        enabled
        category
      }
    }
  }
`;

/**
 * Inner repo detail content component that uses Relay hooks
 */
function RepoDetailContent({
  projectId,
}: {
  projectId: string;
}): React.ReactElement {
  const navigate = useNavigate();

  const data = useLazyLoadQuery<ProjectDetailPageQueryType>(
    ProjectDetailPageQueryDef,
    { id: projectId },
    { fetchPolicy: 'store-and-network' }
  );

  const project = data.project;

  if (!project) {
    return (
      <VStack gap="md" style={{ padding: theme.spacing.xl }}>
        <Heading size="md">Not Found</Heading>
        <Text color="secondary">Project not found: {projectId}</Text>
        <Button onClick={() => navigate('/projects')}>Back to Projects</Button>
      </VStack>
    );
  }

  const worktrees = project.worktrees ?? [];
  const plugins = project.plugins ?? [];
  const repoId = project.projectId ?? projectId;

  return (
    <VStack gap="xl" style={{ padding: theme.spacing.xl }}>
      {/* Header */}
      <HStack justify="space-between" align="center">
        <VStack gap="xs">
          <HStack gap="sm" align="center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/projects')}
            >
              Projects
            </Button>
            <Text color="muted">/</Text>
            <Text weight={600}>{project.name}</Text>
          </HStack>
        </VStack>
        <HStack gap="sm">
          <Text color="muted">{project.totalSessions ?? 0} sessions</Text>
          <Text color="muted">|</Text>
          <Text color="muted">{worktrees.length} worktrees</Text>
        </HStack>
      </HStack>

      {/* Quick Stats */}
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: theme.spacing.md,
        }}
      >
        <StatCard value={project.totalSessions ?? 0} label="Sessions" />
        <StatCard value={worktrees.length} label="Worktrees" />
        <StatCard
          value={formatRelativeTime(project.lastActivity ?? '')}
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
            description="Browse all sessions for this project"
            icon="📋"
            href={`/projects/${repoId}/sessions`}
          />
          <NavCard
            title="Memory"
            description="Project-specific rules and knowledge"
            icon="🧠"
            href={`/projects/${repoId}/memory`}
          />
          <NavCard
            title="Cache"
            description="Cached hooks and files for this project"
            icon="💾"
            href={`/projects/${repoId}/cache`}
          />
          <NavCard
            title="Settings"
            description="Project-specific configuration"
            icon="⚙️"
            href={`/projects/${repoId}/settings`}
          />
        </Box>
      </VStack>

      {/* Project Plugins */}
      {plugins.length > 0 && (
        <VStack gap="md">
          <Heading size="sm" as="h3">
            Project Plugins
          </Heading>
          <Text color="muted" size="sm">
            Plugins installed at project or local scope for this repository
          </Text>
          <VStack gap="sm">
            {plugins
              .filter(
                (plugin): plugin is typeof plugin & { id: string } =>
                  !!plugin.id
              )
              .map((plugin) => (
                <PluginItem
                  key={plugin.id}
                  plugin={{
                    id: plugin.id,
                    name: plugin.name ?? 'Unknown',
                    marketplace: plugin.marketplace ?? '',
                    scope:
                      (plugin.scope as 'USER' | 'PROJECT' | 'LOCAL') ?? 'USER',
                    enabled: plugin.enabled ?? false,
                    category: plugin.category ?? 'Unknown',
                  }}
                />
              ))}
          </VStack>
        </VStack>
      )}

      {/* Worktrees */}
      {worktrees.length > 0 && (
        <VStack gap="md">
          <Heading size="sm" as="h3">
            Worktrees
          </Heading>
          <VStack gap="sm">
            {worktrees.map((wt) => (
              <WorktreeItem
                key={wt.path}
                worktree={{
                  name: wt.name ?? 'Unknown',
                  path: wt.path ?? '',
                  sessionCount: wt.sessionCount ?? 0,
                }}
                projectId={project.projectId ?? projectId}
              />
            ))}
          </VStack>
        </VStack>
      )}
    </VStack>
  );
}

/**
 * Project detail page with Suspense boundary
 */
export default function ProjectDetailPage(): React.ReactElement {
  const navigate = useNavigate();
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  if (!projectId) {
    return (
      <VStack gap="md" style={{ padding: theme.spacing.xl }}>
        <Heading size="md">Not Found</Heading>
        <Text color="secondary">No project ID provided</Text>
        <Button onClick={() => navigate('/projects')}>Back to Projects</Button>
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
          <Text color="secondary">Loading project...</Text>
        </VStack>
      }
    >
      <RepoDetailContent projectId={projectId} />
    </Suspense>
  );
}
