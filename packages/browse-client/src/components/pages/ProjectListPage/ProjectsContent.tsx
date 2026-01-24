/**
 * Projects Content Component
 *
 * Displays projects grid with filtering and sorting.
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
import type { ProjectListPageQuery as ProjectListPageQueryType } from './__generated__/ProjectListPageQuery.graphql.ts';
import { ProjectCard, type SortOption } from './components.ts';
import { ProjectListPageQuery } from './index.tsx';

// Define Project type for internal use
interface Project {
  id: string;
  projectId: string;
  repoId: string;
  name: string;
  totalSessions: number;
  lastActivity: string | null;
  worktrees: Array<{
    name: string;
    path: string;
    sessionCount: number;
    isWorktree: boolean;
    subdirs: Array<{
      relativePath: string;
      path: string;
      sessionCount: number;
    }>;
  }>;
}

interface ProjectsContentProps {
  queryRef: PreloadedQuery<ProjectListPageQueryType>;
}

export function ProjectsContent({
  queryRef,
}: ProjectsContentProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('activity');

  const data = usePreloadedQuery<ProjectListPageQueryType>(
    ProjectListPageQuery,
    queryRef
  );

  const projects: Project[] = useMemo(() => {
    return (data.projects ?? [])
      .filter((p): p is typeof p & { id: string } => !!p.id)
      .map((p) => ({
        id: p.id,
        projectId: p.projectId ?? '',
        repoId: p.repoId ?? '',
        name: p.name ?? 'Unknown',
        totalSessions: p.totalSessions ?? 0,
        lastActivity: p.lastActivity ?? null,
        worktrees: (p.worktrees ?? []).map((wt) => ({
          name: wt.name ?? 'Unknown',
          path: wt.path ?? '',
          sessionCount: wt.sessionCount ?? 0,
          isWorktree: wt.isWorktree ?? false,
          subdirs: (wt.subdirs ?? []).map((sd) => ({
            relativePath: sd.relativePath ?? '',
            path: sd.path ?? '',
            sessionCount: sd.sessionCount ?? 0,
          })),
        })),
      }));
  }, [data.projects]);

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let result = projects;

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.projectId.toLowerCase().includes(q)
      );
    }

    // Sort projects
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
  }, [projects, searchQuery, sortBy]);

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
          <Heading size="lg">Projects</Heading>
          <Text color="secondary">{projects.length} projects</Text>
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
              placeholder="Search projects..."
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
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </Box>

        {filteredProjects.length === 0 && projects.length > 0 && (
          <VStack
            gap="sm"
            align="center"
            justify="center"
            style={{ padding: theme.spacing.xxl }}
          >
            <Text color="secondary">No projects match your search.</Text>
          </VStack>
        )}

        {projects.length === 0 && (
          <VStack
            gap="sm"
            align="center"
            justify="center"
            style={{ padding: theme.spacing.xxl }}
          >
            <Text color="secondary">
              No projects found. Start using Claude Code to create sessions!
            </Text>
          </VStack>
        )}
      </Box>
    </VStack>
  );
}
