/**
 * Plugin List Page
 *
 * Displays installed plugins and manages plugin installation.
 * Uses Relay for data fetching with Suspense for loading states.
 */

import type React from 'react';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { graphql, useLazyLoadQuery, useMutation } from 'react-relay';
import { theme } from '@/components/atoms';
import { Box } from '@/components/atoms/Box.tsx';
import { Button } from '@/components/atoms/Button.tsx';
import { Card } from '@/components/atoms/Card.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Input } from '@/components/atoms/Input.tsx';
import { Spinner } from '@/components/atoms/Spinner.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import type { PluginListPageQuery as PluginListPageQueryType } from './__generated__/PluginListPageQuery.graphql.ts';
import type { PluginListPageRemoveMutation } from './__generated__/PluginListPageRemoveMutation.graphql.ts';
import type { PluginListPageToggleMutation } from './__generated__/PluginListPageToggleMutation.graphql.ts';
import { PluginCard, StatCard } from './components.ts';

// Define Plugin type based on what we expect from query
interface Plugin {
  id: string;
  name: string | null | undefined;
  marketplace: string | null | undefined;
  scope: string | null | undefined;
  enabled: boolean | null | undefined;
  category: string | null | undefined;
}

const PluginListPageQueryDef = graphql`
  query PluginListPageQuery {
    plugins {
      id
      name
      marketplace
      scope
      enabled
      category
    }
    pluginStats {
      totalPlugins
      userPlugins
      projectPlugins
      localPlugins
      enabledPlugins
    }
    pluginCategories {
      category
      count
    }
  }
`;

const PluginListPageToggleMutationDef = graphql`
  mutation PluginListPageToggleMutation(
    $name: String!
    $marketplace: String!
    $scope: PluginScope!
    $enabled: Boolean!
  ) {
    togglePlugin(
      name: $name
      marketplace: $marketplace
      scope: $scope
      enabled: $enabled
    ) {
      success
      message
    }
  }
`;

const PluginListPageRemoveMutationDef = graphql`
  mutation PluginListPageRemoveMutation(
    $name: String!
    $marketplace: String!
    $scope: PluginScope!
  ) {
    removePlugin(name: $name, marketplace: $marketplace, scope: $scope) {
      success
      message
    }
  }
`;

interface PluginsContentProps {
  /**
   * Filter to only show plugins of certain scopes.
   * - 'user': Only show USER scope plugins (for global /plugins page)
   * - 'project': Only show PROJECT and LOCAL scope plugins (for project plugins page)
   * - undefined: Show all plugins
   */
  scopeMode?: 'user' | 'project';
}

/**
 * Inner plugins content component that uses Relay hooks
 */
function PluginsContent({
  scopeMode,
}: PluginsContentProps): React.ReactElement {
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const data = useLazyLoadQuery<PluginListPageQueryType>(
    PluginListPageQueryDef,
    {},
    { fetchKey: refreshKey, fetchPolicy: 'store-and-network' }
  );

  const [commitToggle] = useMutation<PluginListPageToggleMutation>(
    PluginListPageToggleMutationDef
  );
  const [commitRemove] = useMutation<PluginListPageRemoveMutation>(
    PluginListPageRemoveMutationDef
  );

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleToggle = useCallback(
    (plugin: Plugin) => {
      if (!plugin.name || !plugin.marketplace || !plugin.scope) return;

      setActionLoading(plugin.id);
      commitToggle({
        variables: {
          name: plugin.name,
          marketplace: plugin.marketplace,
          scope: plugin.scope as 'USER' | 'PROJECT' | 'LOCAL',
          enabled: !plugin.enabled,
        },
        onCompleted: (response) => {
          if (response.togglePlugin?.success) {
            setToast({
              message: response.togglePlugin.message ?? 'Plugin toggled',
              type: 'success',
            });
            setRefreshKey((k) => k + 1);
          } else {
            setToast({
              message:
                response.togglePlugin?.message ?? 'Failed to toggle plugin',
              type: 'error',
            });
          }
          setActionLoading(null);
        },
        onError: (err) => {
          setToast({
            message: err.message || 'Failed to toggle plugin',
            type: 'error',
          });
          setActionLoading(null);
        },
      });
    },
    [commitToggle]
  );

  const handleRemove = useCallback(
    (plugin: Plugin) => {
      if (!plugin.name || !plugin.marketplace || !plugin.scope) return;

      if (!confirm(`Are you sure you want to remove ${plugin.name}?`)) {
        return;
      }

      setActionLoading(plugin.id);
      commitRemove({
        variables: {
          name: plugin.name,
          marketplace: plugin.marketplace,
          scope: plugin.scope as 'USER' | 'PROJECT' | 'LOCAL',
        },
        onCompleted: (response) => {
          if (response.removePlugin?.success) {
            setToast({
              message: response.removePlugin.message ?? 'Plugin removed',
              type: 'success',
            });
            setRefreshKey((k) => k + 1);
          } else {
            setToast({
              message:
                response.removePlugin?.message ?? 'Failed to remove plugin',
              type: 'error',
            });
          }
          setActionLoading(null);
        },
        onError: (err) => {
          setToast({
            message: err.message || 'Failed to remove plugin',
            type: 'error',
          });
          setActionLoading(null);
        },
      });
    },
    [commitRemove]
  );

  const plugins = data.plugins ?? [];
  const pluginStats = data.pluginStats ?? {
    totalPlugins: 0,
    userPlugins: 0,
    projectPlugins: 0,
    localPlugins: 0,
    enabledPlugins: 0,
  };
  const pluginCategories = data.pluginCategories ?? [];

  // Filter plugins by scopeMode first
  let filteredPlugins = [...plugins];

  // Apply scopeMode filter (restricts which scopes are visible)
  if (scopeMode === 'user') {
    filteredPlugins = filteredPlugins.filter((p) => p.scope === 'USER');
  } else if (scopeMode === 'project') {
    filteredPlugins = filteredPlugins.filter(
      (p) => p.scope === 'PROJECT' || p.scope === 'LOCAL'
    );
  }

  // Apply user-selected filter
  if (filter !== 'all') {
    if (['USER', 'PROJECT', 'LOCAL'].includes(filter)) {
      filteredPlugins = filteredPlugins.filter((p) => p.scope === filter);
    } else {
      filteredPlugins = filteredPlugins.filter((p) => p.category === filter);
    }
  }

  if (search) {
    const searchLower = search.toLowerCase();
    filteredPlugins = filteredPlugins.filter(
      (p) =>
        (p.name?.toLowerCase().includes(searchLower) ?? false) ||
        (p.category?.toLowerCase().includes(searchLower) ?? false)
    );
  }

  return (
    <VStack gap="lg">
      {/* Toast notification */}
      {toast && (
        <Box
          borderRadius="md"
          style={{
            position: 'fixed',
            top: theme.spacing.lg,
            right: theme.spacing.lg,
            padding: `${theme.spacing.md} ${theme.spacing.lg}`,
            backgroundColor:
              toast.type === 'success'
                ? theme.colors.accent.success
                : theme.colors.accent.danger,
            color: theme.colors.bg.primary,
            zIndex: 1000,
            fontSize: theme.fontSize.sm,
          }}
        >
          {toast.message}
        </Box>
      )}

      {/* Header */}
      <HStack justify="space-between" align="center">
        <HStack gap="md" align="center">
          <Heading>
            {scopeMode === 'user'
              ? 'User Plugins'
              : scopeMode === 'project'
                ? 'Project Plugins'
                : 'Plugins'}
          </Heading>
          <Text color="secondary" size="sm">
            {filteredPlugins.length} plugins
          </Text>
        </HStack>
      </HStack>

      {/* Stats Grid - show relevant stats based on scopeMode */}
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: theme.spacing.md,
        }}
      >
        {(!scopeMode || scopeMode === 'user') && (
          <StatCard label="User Scope" value={pluginStats.userPlugins ?? 0} />
        )}
        {(!scopeMode || scopeMode === 'project') && (
          <>
            <StatCard
              label="Project Scope"
              value={pluginStats.projectPlugins ?? 0}
            />
            <StatCard
              label="Local Scope"
              value={pluginStats.localPlugins ?? 0}
            />
          </>
        )}
        {pluginCategories.map((cat) => (
          <StatCard
            key={cat.category}
            label={cat.category ?? 'Unknown'}
            value={cat.count ?? 0}
          />
        ))}
      </Box>

      {/* Filters */}
      <HStack gap="md" wrap align="center">
        <Input
          placeholder="Search plugins..."
          value={search}
          onChange={setSearch}
          style={{ flex: 1, minWidth: '200px' }}
        />
        <HStack gap="xs">
          <Button
            size="sm"
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            All
          </Button>
          {/* Only show scope filter buttons for scopes available in this mode */}
          {(!scopeMode || scopeMode === 'user') && (
            <Button
              size="sm"
              active={filter === 'USER'}
              onClick={() => setFilter('USER')}
            >
              User
            </Button>
          )}
          {(!scopeMode || scopeMode === 'project') && (
            <>
              <Button
                size="sm"
                active={filter === 'PROJECT'}
                onClick={() => setFilter('PROJECT')}
              >
                Project
              </Button>
              <Button
                size="sm"
                active={filter === 'LOCAL'}
                onClick={() => setFilter('LOCAL')}
              >
                Local
              </Button>
            </>
          )}
        </HStack>
      </HStack>

      {/* Plugin Grid */}
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: theme.spacing.md,
        }}
      >
        {filteredPlugins
          .filter(
            (plugin): plugin is typeof plugin & { id: string } => !!plugin.id
          )
          .map((plugin) => (
            <PluginCard
              key={plugin.id}
              plugin={{
                id: plugin.id,
                name: plugin.name ?? 'Unknown',
                marketplace: plugin.marketplace ?? '',
                scope: (plugin.scope as 'USER' | 'PROJECT' | 'LOCAL') ?? 'USER',
                enabled: plugin.enabled ?? false,
                category: plugin.category ?? 'Unknown',
              }}
              onToggle={handleToggle}
              onRemove={handleRemove}
              isLoading={actionLoading === plugin.id}
            />
          ))}
      </Box>
      {filteredPlugins.length === 0 && (
        <VStack gap="md" align="center" style={{ padding: theme.spacing.xl }}>
          <Text color="secondary">
            {search
              ? 'No plugins match your search.'
              : 'No plugins found in this category.'}
          </Text>
        </VStack>
      )}

      {/* Install hint */}
      <Card
        style={{
          backgroundColor: theme.colors.bg.tertiary,
        }}
      >
        <VStack gap="sm">
          <Text size="sm" color="secondary">
            To install plugins, use:{' '}
            <code
              style={{
                backgroundColor: theme.colors.bg.secondary,
                padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                borderRadius: theme.borderRadius.sm,
              }}
            >
              han plugin install &lt;name&gt;
            </code>
          </Text>
          <Text size="sm" color="secondary">
            Or auto-detect for your project:{' '}
            <code
              style={{
                backgroundColor: theme.colors.bg.secondary,
                padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                borderRadius: theme.borderRadius.sm,
              }}
            >
              han plugin install --auto
            </code>
          </Text>
        </VStack>
      </Card>
    </VStack>
  );
}

export interface PluginListPageProps {
  /**
   * Filter mode for plugins.
   * - 'user': Only show USER scope plugins (for global /plugins page)
   * - 'project': Only show PROJECT and LOCAL scope plugins (for project plugins page)
   * - undefined: Show all plugins
   */
  scopeMode?: 'user' | 'project';
}

/**
 * Plugin list page component with Suspense boundary
 */
export default function PluginListPage({
  scopeMode,
}: PluginListPageProps): React.ReactElement {
  return (
    <VStack gap="lg" style={{ padding: theme.spacing.xl }}>
      <Suspense
        fallback={
          <VStack
            gap="md"
            align="center"
            justify="center"
            style={{ minHeight: '200px' }}
          >
            <Spinner size="lg" />
            <Text color="secondary">Loading plugins...</Text>
          </VStack>
        }
      >
        <PluginsContent scopeMode={scopeMode} />
      </Suspense>
    </VStack>
  );
}
