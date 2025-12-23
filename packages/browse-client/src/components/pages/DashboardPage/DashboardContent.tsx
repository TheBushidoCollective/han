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
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { theme } from '@/components/atoms/theme.ts';
import { VStack } from '@/components/atoms/VStack.tsx';
import { SessionListItem } from '@/components/organisms/SessionListItem.tsx';
import type { DashboardContentSubscription } from './__generated__/DashboardContentSubscription.graphql.ts';
import type { DashboardPageQuery } from './__generated__/DashboardPageQuery.graphql.ts';
import {
  getFrustrationLabel,
  getFrustrationVariant,
  SectionCard,
  StatCard,
  StatusItem,
} from './components.ts';
import { DashboardPageQuery as DashboardPageQueryDef } from './index.tsx';

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
}

export function DashboardContent({
  queryRef,
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
  const checkpointStats = data.checkpointStats ?? {
    totalCheckpoints: 0,
    sessionCheckpoints: 0,
    agentCheckpoints: 0,
  };
  const pluginStats = data.pluginStats ?? {
    totalPlugins: 0,
    userPlugins: 0,
    projectPlugins: 0,
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

  return (
    <VStack gap="xl" style={{ padding: theme.spacing.xl }}>
      {/* Header */}
      <HStack justify="space-between" align="center">
        <VStack gap="xs">
          <Heading size="lg">Dashboard</Heading>
          <Text color="secondary">Han Development Environment</Text>
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
        <StatCard
          label="Projects"
          value={projects.length}
          onClick={() => navigate('/repos')}
        />
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
          label="User Plugins"
          value={pluginStats.userPlugins ?? 0}
          subValue={`${pluginStats.enabledPlugins ?? 0} enabled`}
          onClick={() => navigate('/plugins')}
        />
      </Box>

      {/* Recent Sessions - full width */}
      <SectionCard
        title="Recent Sessions"
        onViewAll={() => navigate('/sessions')}
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
                  label="Checkpoints"
                  value={checkpointStats.totalCheckpoints ?? 0}
                />
                <StatusItem
                  label="Session"
                  value={checkpointStats.sessionCheckpoints ?? 0}
                />
                <StatusItem
                  label="Agent"
                  value={checkpointStats.agentCheckpoints ?? 0}
                />
              </VStack>
            </VStack>
          </SectionCard>
        </Box>

        {/* Plugin Categories */}
        <Box style={{ flex: 1 }}>
          <SectionCard
            title="Plugin Categories"
            onViewAll={() => navigate('/plugins')}
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
    </VStack>
  );
}
