/**
 * Project Card Component
 *
 * Displays a project with its worktrees and session counts.
 */

import type React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Card } from '@/components/atoms/Card.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Link } from '@/components/atoms/Link.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { theme } from '@/components/atoms/theme.ts';
import { VStack } from '@/components/atoms/VStack.tsx';
import { formatRepoUrl } from '../RepoListPage/utils.ts';
import { formatRelativeTime } from '../Shared/utils.ts';
import type { Project } from './types.ts';
import { countSubdirs } from './utils.ts';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps): React.ReactElement {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const handleCardClick = () => {
    // Navigate to project detail using folder-based projectId
    navigate(`/projects/${project.projectId}`);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const subdirCount = countSubdirs(project);
  const worktreeCount = project.worktrees.filter((w) => w.isWorktree).length;
  const hasExpandableContent =
    worktreeCount > 0 || subdirCount > 0 || project.worktrees.length > 1;

  return (
    <Card onClick={handleCardClick} hoverable style={{ height: '100%' }}>
      <VStack gap="sm" style={{ height: '100%' }}>
        {/* Header with name and activity time */}
        <HStack justify="space-between" align="flex-start" gap="sm">
          <VStack gap="xs" style={{ flex: 1, minWidth: 0 }}>
            <Heading size="sm">{project.name}</Heading>
            <Text
              size="xs"
              color="muted"
              truncate
              style={{ fontFamily: 'monospace' }}
            >
              {formatRepoUrl(project.repoId)}
            </Text>
          </VStack>
          <Text size="xs" color="secondary">
            {formatRelativeTime(project.lastActivity)}
          </Text>
        </HStack>

        {/* Stats badges */}
        <HStack gap="sm" wrap style={{ marginTop: 'auto' }}>
          <Badge variant="default">{project.totalSessions} sessions</Badge>
          {subdirCount > 0 && (
            <Badge variant="success">{subdirCount} subdirs</Badge>
          )}
        </HStack>

        {/* Expandable details section */}
        {hasExpandableContent && (
          <VStack gap="sm" style={{ width: '100%' }}>
            <Link
              onClick={handleExpandClick}
              style={{ fontSize: theme.fontSize.xs }}
            >
              {expanded ? 'Hide details' : 'Show details'}
            </Link>

            {expanded && (
              <VStack
                gap="xs"
                style={{
                  borderTop: `1px solid ${theme.colors.border.subtle}`,
                  paddingTop: theme.spacing.sm,
                  width: '100%',
                }}
              >
                {project.worktrees.map((wt) => (
                  <VStack key={wt.path} gap="xs">
                    <HStack gap="sm" align="center">
                      <Text size="xs" color="muted">
                        {wt.isWorktree ? 'W' : 'M'}
                      </Text>
                      <Text size="sm" style={{ flex: 1 }}>
                        {wt.name}
                      </Text>
                      <Text size="xs" color="secondary">
                        {wt.sessionCount} sessions
                      </Text>
                    </HStack>
                    {wt.subdirs && wt.subdirs.length > 0 && (
                      <VStack
                        gap="xs"
                        style={{ paddingLeft: theme.spacing.lg }}
                      >
                        {wt.subdirs.map((subdir) => (
                          <HStack key={subdir.path} gap="sm" align="center">
                            <Text size="xs" color="muted">
                              D
                            </Text>
                            <Text
                              size="xs"
                              color="secondary"
                              style={{ flex: 1 }}
                            >
                              {subdir.relativePath}
                            </Text>
                            <Text size="xs" color="muted">
                              {subdir.sessionCount} sessions
                            </Text>
                          </HStack>
                        ))}
                      </VStack>
                    )}
                  </VStack>
                ))}
              </VStack>
            )}
          </VStack>
        )}
      </VStack>
    </Card>
  );
}
