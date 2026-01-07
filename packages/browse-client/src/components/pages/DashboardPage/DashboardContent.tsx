/**
 * Dashboard Content Component
 *
 * Main content for dashboard page using usePreloadedQuery.
 */

import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import type { PreloadedQuery } from 'react-relay';
import { graphql, usePreloadedQuery, useSubscription } from 'react-relay';
import { useNavigate } from 'react-router-dom';
import type { GraphQLSubscriptionConfig } from 'relay-runtime';
import { theme } from '@/components/atoms';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import { SessionListItem } from '@/components/organisms/SessionListItem.tsx';
import type { DashboardContentSubscription } from './__generated__/DashboardContentSubscription.graphql.ts';
import type { DashboardPageQuery } from './__generated__/DashboardPageQuery.graphql.ts';
import { ActivityHeatmap } from './ActivityHeatmap.tsx';
import {
  getFrustrationLabel,
  getFrustrationVariant,
  SectionCard,
  StatCard,
  StatusItem,
} from './components.ts';
import { DashboardPageQuery as DashboardPageQueryDef } from './index.tsx';
import { LineChangesChart } from './LineChangesChart.tsx';
import { ModelUsageChart } from './ModelUsageChart.tsx';
import { TimeOfDayChart } from './TimeOfDayChart.tsx';
import { TokenUsageCard } from './TokenUsageCard.tsx';

/**
 * Subscription for live dashboard updates
 */
const DashboardContentSubscriptionDef = graphql`
  subscription DashboardContentSubscription {
    memoryUpdated {
      type
      action
      path
      timestamp
    }
  }
`;

interface DashboardContentProps {
  queryRef: PreloadedQuery<DashboardPageQuery>;
  /**
   * Optional repo ID for project-specific dashboard.
   */
  repoId?: string;
}

export function DashboardContent({
  queryRef,
  repoId,
}: DashboardContentProps): React.ReactElement {
  const navigate = useNavigate();
  const [isLive, setIsLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [, setRefreshKey] = useState(0);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const data = usePreloadedQuery<DashboardPageQuery>(
    DashboardPageQueryDef,
    queryRef
  );

  // Determine if we're viewing a project-specific dashboard
  const isProjectView = !!repoId;
  // Format the repoId for display (e.g., 'github-com-org-repo' -> 'org/repo')
  const repoDisplayName =
    repoId?.replace(/^[^-]+-[^-]+-/, '').replace(/-/g, '/') || repoId;

  // Subscription config for live updates
  const subscriptionConfig = useMemo<
    GraphQLSubscriptionConfig<DashboardContentSubscription>
  >(
    () => ({
      subscription: DashboardContentSubscriptionDef,
      variables: {},
      onNext: (response) => {
        if (response?.memoryUpdated?.type === 'SESSION') {
          // Debounce: wait for rapid updates to settle
          if (fetchTimeoutRef.current) {
            clearTimeout(fetchTimeoutRef.current);
          }
          fetchTimeoutRef.current = setTimeout(() => {
            setRefreshKey((k) => k + 1);
            setLastUpdate(new Date());
          }, 500);
        }
      },
      onError: (err) => {
        console.warn('Subscription error:', err);
        setIsLive(false);
      },
    }),
    []
  );

  useSubscription<DashboardContentSubscription>(subscriptionConfig);

  // Safe accessors with defaults
  const metrics = data.metrics ?? {
    totalTasks: 0,
    completedTasks: 0,
    successRate: 0,
    averageConfidence: 0,
    calibrationScore: null,
    significantFrustrations: 0,
    significantFrustrationRate: 0,
  };
  const pluginStats = data.pluginStats ?? {
    totalPlugins: 0,
    userPlugins: 0,
    projectPlugins: 0,
    localPlugins: 0,
    enabledPlugins: 0,
  };
  const projects = data.projects ?? [];
  // Extract sessions from connection edges (filter for valid id)
  const sessions = (data.sessions?.edges ?? [])
    .map((e) => e?.node)
    .filter(
      (s): s is NonNullable<typeof s> & { id: string } =>
        s !== null && s !== undefined && typeof s.id === 'string'
    );
  const pluginCategories = data.pluginCategories ?? [];
  const frustrationRate = metrics.significantFrustrationRate ?? 0;

  // Normalize activity data with defaults for nullable fields from GraphQL
  const rawActivity = data.activity;
  const activity = {
    dailyActivity: (rawActivity?.dailyActivity ?? []).map((d) => ({
      date: d?.date ?? '',
      sessionCount: d?.sessionCount ?? 0,
      messageCount: d?.messageCount ?? 0,
      inputTokens: d?.inputTokens ?? 0,
      outputTokens: d?.outputTokens ?? 0,
      cachedTokens: d?.cachedTokens ?? 0,
      linesAdded: d?.linesAdded ?? 0,
      linesRemoved: d?.linesRemoved ?? 0,
      filesChanged: d?.filesChanged ?? 0,
    })),
    hourlyActivity: (rawActivity?.hourlyActivity ?? []).map((h) => ({
      hour: h?.hour ?? 0,
      sessionCount: h?.sessionCount ?? 0,
      messageCount: h?.messageCount ?? 0,
    })),
    tokenUsage: {
      totalInputTokens: rawActivity?.tokenUsage?.totalInputTokens ?? 0,
      totalOutputTokens: rawActivity?.tokenUsage?.totalOutputTokens ?? 0,
      totalCachedTokens: rawActivity?.tokenUsage?.totalCachedTokens ?? 0,
      totalTokens: rawActivity?.tokenUsage?.totalTokens ?? 0,
      estimatedCostUsd: rawActivity?.tokenUsage?.estimatedCostUsd ?? 0,
      messageCount: rawActivity?.tokenUsage?.messageCount ?? 0,
      sessionCount: rawActivity?.tokenUsage?.sessionCount ?? 0,
    },
    dailyModelTokens: (rawActivity?.dailyModelTokens ?? []).map((d) => ({
      date: d?.date ?? '',
      models: (d?.models ?? []).map((m) => ({
        model: m?.model ?? '',
        displayName: m?.displayName ?? '',
        tokens: Number(m?.tokens ?? 0),
      })),
      totalTokens: Number(d?.totalTokens ?? 0),
    })),
    modelUsage: (rawActivity?.modelUsage ?? []).map((m) => ({
      model: m?.model ?? '',
      displayName: m?.displayName ?? '',
      inputTokens: Number(m?.inputTokens ?? 0),
      outputTokens: Number(m?.outputTokens ?? 0),
      cacheReadTokens: Number(m?.cacheReadTokens ?? 0),
      cacheCreationTokens: Number(m?.cacheCreationTokens ?? 0),
      totalTokens: Number(m?.totalTokens ?? 0),
    })),
    totalSessions: rawActivity?.totalSessions ?? 0,
    totalMessages: rawActivity?.totalMessages ?? 0,
    firstSessionDate: rawActivity?.firstSessionDate ?? null,
    streakDays: rawActivity?.streakDays ?? 0,
    totalActiveDays: rawActivity?.totalActiveDays ?? 0,
  };

  return (
    <VStack gap="xl" style={{ padding: theme.spacing.xl }}>
      {/* Header */}
      <HStack justify="space-between" align="center">
        <VStack gap="xs">
          {isProjectView ? (
            <>
              <HStack gap="sm" align="center">
                <Box
                  onClick={() => navigate('/repos')}
                  style={{ cursor: 'pointer' }}
                >
                  <Text color="secondary">Repos</Text>
                </Box>
                <Text color="muted">/</Text>
                <Heading size="lg">{repoDisplayName}</Heading>
              </HStack>
              <Text color="secondary" size="sm">
                Project Dashboard
              </Text>
            </>
          ) : (
            <>
              <Heading size="lg">Dashboard</Heading>
              <Text color="secondary">Han Development Environment</Text>
            </>
          )}
        </VStack>
        <HStack gap="sm" align="center">
          {isLive && (
            <Badge variant="success">
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  marginRight: '6px',
                  animation: 'pulse 2s infinite',
                }}
              />
              Live
            </Badge>
          )}
          <Text color="muted" size="xs">
            Updated {lastUpdate.toLocaleTimeString()}
          </Text>
        </HStack>
      </HStack>

      {/* Stats grid - 5 columns */}
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: theme.spacing.lg,
        }}
      >
        {isProjectView ? (
          <StatCard
            label="Sessions"
            value={sessions.length}
            onClick={() => navigate(`/repos/${repoId}/sessions`)}
          />
        ) : (
          <StatCard
            label="Projects"
            value={projects.length}
            onClick={() => navigate('/repos')}
          />
        )}
        <StatCard
          label="Total Tasks"
          value={metrics.totalTasks ?? 0}
          subValue={`${metrics.completedTasks ?? 0} completed`}
          onClick={() => navigate('/metrics')}
        />
        <StatCard
          label="Success Rate"
          value={`${Math.round((metrics.successRate ?? 0) * 100)}%`}
          subValue={`${Math.round((metrics.averageConfidence ?? 0) * 100)}% confidence`}
        />
        <StatCard
          label="Calibration"
          value={
            metrics.calibrationScore
              ? `${Math.round(metrics.calibrationScore * 100)}%`
              : '—'
          }
          subValue="Prediction accuracy"
        />
        <StatCard
          label={isProjectView ? 'Project Plugins' : 'User Plugins'}
          value={
            isProjectView
              ? (pluginStats.projectPlugins ?? 0) +
                (pluginStats.localPlugins ?? 0)
              : (pluginStats.userPlugins ?? 0)
          }
          subValue={`${pluginStats.enabledPlugins ?? 0} enabled`}
          onClick={() =>
            navigate(isProjectView ? `/repos/${repoId}/plugins` : '/plugins')
          }
        />
      </Box>

      {/* Activity Heatmap - full width */}
      <SectionCard title="Activity">
        <ActivityHeatmap
          dailyActivity={activity.dailyActivity}
          streakDays={activity.streakDays}
          totalActiveDays={activity.totalActiveDays}
        />
      </SectionCard>

      {/* Line Changes Chart - full width */}
      <SectionCard title="Code Changes">
        <LineChangesChart dailyActivity={activity.dailyActivity} />
      </SectionCard>

      {/* Model Usage Chart - full width */}
      <SectionCard title="Model Usage (from Claude Code stats)">
        <ModelUsageChart
          dailyModelTokens={activity.dailyModelTokens}
          modelUsage={activity.modelUsage}
        />
      </SectionCard>

      {/* Token Usage and Time of Day - side by side */}
      <HStack gap="lg" style={{ alignItems: 'flex-start' }}>
        <Box style={{ flex: 1 }}>
          <SectionCard title="Token Usage (30 days)">
            <TokenUsageCard tokenUsage={activity.tokenUsage} />
          </SectionCard>
        </Box>
        <Box style={{ flex: 1 }}>
          <SectionCard title="Time of Day">
            <TimeOfDayChart hourlyActivity={activity.hourlyActivity} />
          </SectionCard>
        </Box>
      </HStack>

      {/* Recent Sessions - full width */}
      <SectionCard
        title={isProjectView ? 'Project Sessions' : 'Recent Sessions'}
        onViewAll={() =>
          navigate(isProjectView ? `/repos/${repoId}/sessions` : '/sessions')
        }
      >
        {sessions.length > 0 ? (
          <VStack style={{ gap: 0 }}>
            {sessions.map((session) => (
              <SessionListItem
                key={session.id}
                session={session}
                connectionId={data.sessions?.__id}
              />
            ))}
          </VStack>
        ) : (
          <Text color="muted" size="sm">
            No recent sessions
          </Text>
        )}
      </SectionCard>

      {/* Bottom row - Agent Health and Plugin Categories side by side */}
      <HStack gap="lg" style={{ alignItems: 'flex-start' }}>
        {/* Agent Health */}
        <Box style={{ flex: 1 }}>
          <SectionCard title="Agent Health">
            <VStack gap="md">
              <VStack gap="xs">
                <Text color="secondary" size="xs">
                  Frustration Level
                </Text>
                <HStack gap="sm" align="center">
                  <Badge variant={getFrustrationVariant(frustrationRate)}>
                    {getFrustrationLabel(frustrationRate)}
                  </Badge>
                  {(metrics.significantFrustrations ?? 0) > 0 && (
                    <Text color="muted" size="xs">
                      {metrics.significantFrustrations} events
                    </Text>
                  )}
                </HStack>
              </VStack>
              <VStack gap="sm">
                <StatusItem
                  label="Total Tasks"
                  value={metrics.totalTasks ?? 0}
                />
                <StatusItem
                  label="Success Rate"
                  value={`${Math.round((metrics.successRate ?? 0) * 100)}%`}
                />
                <StatusItem
                  label="Avg Confidence"
                  value={`${Math.round((metrics.averageConfidence ?? 0) * 100)}%`}
                />
              </VStack>
            </VStack>
          </SectionCard>
        </Box>

        {/* Plugin Categories */}
        <Box style={{ flex: 1 }}>
          <SectionCard
            title="Plugin Categories"
            onViewAll={() =>
              navigate(isProjectView ? `/repos/${repoId}/plugins` : '/plugins')
            }
          >
            {pluginCategories.length > 0 ? (
              <VStack gap="sm">
                {pluginCategories.map((cat) => (
                  <HStack key={cat.category} justify="space-between">
                    <Text color="secondary" size="sm">
                      {cat.category}
                    </Text>
                    <Badge>{cat.count}</Badge>
                  </HStack>
                ))}
              </VStack>
            ) : (
              <Text color="muted" size="sm">
                No plugins installed
              </Text>
            )}
          </SectionCard>
        </Box>
      </HStack>

      {/* Project Quick Access - only shown in project view */}
      {isProjectView && (
        <SectionCard title="Project Resources">
          <Box
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: theme.spacing.md,
            }}
          >
            <Box
              onClick={() => navigate(`/repos/${repoId}/memory`)}
              style={{
                padding: theme.spacing.md,
                backgroundColor: theme.colors.bg.tertiary,
                borderRadius: theme.borderRadius.md,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <VStack gap="xs" align="center">
                <Text style={{ fontSize: '24px' }}>🧠</Text>
                <Text size="sm" weight="semibold">
                  Memory
                </Text>
              </VStack>
            </Box>
            <Box
              onClick={() => navigate(`/repos/${repoId}/cache`)}
              style={{
                padding: theme.spacing.md,
                backgroundColor: theme.colors.bg.tertiary,
                borderRadius: theme.borderRadius.md,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <VStack gap="xs" align="center">
                <Text style={{ fontSize: '24px' }}>💾</Text>
                <Text size="sm" weight="semibold">
                  Cache
                </Text>
              </VStack>
            </Box>
            <Box
              onClick={() => navigate(`/repos/${repoId}/plugins`)}
              style={{
                padding: theme.spacing.md,
                backgroundColor: theme.colors.bg.tertiary,
                borderRadius: theme.borderRadius.md,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <VStack gap="xs" align="center">
                <Text style={{ fontSize: '24px' }}>🔌</Text>
                <Text size="sm" weight="semibold">
                  Plugins
                </Text>
              </VStack>
            </Box>
            <Box
              onClick={() => navigate(`/repos/${repoId}/settings`)}
              style={{
                padding: theme.spacing.md,
                backgroundColor: theme.colors.bg.tertiary,
                borderRadius: theme.borderRadius.md,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <VStack gap="xs" align="center">
                <Text style={{ fontSize: '24px' }}>⚙️</Text>
                <Text size="sm" weight="semibold">
                  Settings
                </Text>
              </VStack>
            </Box>
          </Box>
        </SectionCard>
      )}
    </VStack>
  );
}
