/**
 * Settings Page
 *
 * Displays user-level configuration from Claude and Han settings.
 * Uses Relay for data fetching with Suspense for loading states.
 */

import type React from 'react';
import { Suspense, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import { useParams } from 'react-router-dom';
import { theme } from '@/components/atoms';
import { Badge } from '@/components/atoms/Badge.tsx';
import { Box } from '@/components/atoms/Box.tsx';
import { Card } from '@/components/atoms/Card.tsx';
import { Heading } from '@/components/atoms/Heading.tsx';
import { HStack } from '@/components/atoms/HStack.tsx';
import { Spinner } from '@/components/atoms/Spinner.tsx';
import { Text } from '@/components/atoms/Text.tsx';
import { VStack } from '@/components/atoms/VStack.tsx';
import type { SettingsPageQuery as SettingsPageQueryType } from './__generated__/SettingsPageQuery.graphql.ts';
import {
  FeatureBadge,
  formatDate,
  McpServerCard,
  SettingsFileCard,
  type SettingsTab,
  StatItem,
  StatusIndicator,
  TabButton,
} from './components.ts';

const SettingsPageQueryDef = graphql`
  query SettingsPageQuery($projectId: String) {
    settings(projectId: $projectId) {
      claudeSettingsFiles {
        path
        source
        sourceLabel
        exists
        lastModified
        type
      }
      hanConfigFiles {
        path
        source
        sourceLabel
        exists
        lastModified
        type
      }
      claudeSettings {
        path
        exists
        lastModified
        pluginCount
        mcpServerCount
        hasPermissions
      }
      hanConfig {
        path
        exists
        lastModified
        hooksEnabled
        memoryEnabled
        metricsEnabled
        pluginConfigCount
      }
      mcpServers {
        id
        name
        command
        url
        type
        argCount
        hasEnv
      }
      permissions {
        allowedTools
        deniedTools
        additionalDirectories
      }
    }
  }
`;

/**
 * Inner settings content component that uses Relay hooks
 */
function SettingsContent({
  projectId,
}: {
  projectId: string | null;
}): React.ReactElement {
  const [activeTab, setActiveTab] = useState<SettingsTab>('overview');

  const data = useLazyLoadQuery<SettingsPageQueryType>(
    SettingsPageQueryDef,
    { projectId },
    { fetchPolicy: 'store-and-network' }
  );

  const settings = data.settings;

  if (!settings) {
    return (
      <VStack
        gap="md"
        align="center"
        style={{ padding: theme.spacing.xl, minHeight: '200px' }}
      >
        <Text color="secondary">No settings data available.</Text>
      </VStack>
    );
  }

  const claudeSettingsFiles = settings.claudeSettingsFiles ?? [];
  const hanConfigFiles = settings.hanConfigFiles ?? [];
  const claudeSettings = settings.claudeSettings;
  const hanConfig = settings.hanConfig;
  const mcpServers = settings.mcpServers ?? [];
  const permissions = settings.permissions ?? {
    allowedTools: [],
    deniedTools: [],
    additionalDirectories: [],
  };

  // Count total files and existing files
  const allFiles = [...claudeSettingsFiles, ...hanConfigFiles];
  const existingFiles = allFiles.filter((f) => f.exists).length;

  return (
    <VStack gap="lg" style={{ padding: theme.spacing.xl }}>
      {/* Header */}
      <HStack justify="space-between" align="center">
        <VStack gap="xs">
          <Heading size="lg">
            {projectId ? 'Project Settings' : 'User Settings'}
          </Heading>
          <Text color="secondary">Configuration for Claude Code and Han</Text>
        </VStack>
      </HStack>

      {/* Tabs */}
      <HStack gap="sm">
        <TabButton
          active={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </TabButton>
        <TabButton
          active={activeTab === 'files'}
          onClick={() => setActiveTab('files')}
        >
          All Files ({existingFiles}/{allFiles.length})
        </TabButton>
        <TabButton
          active={activeTab === 'mcp'}
          onClick={() => setActiveTab('mcp')}
        >
          MCP Servers ({mcpServers.length})
        </TabButton>
        <TabButton
          active={activeTab === 'permissions'}
          onClick={() => setActiveTab('permissions')}
        >
          Permissions
        </TabButton>
      </HStack>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <VStack gap="lg">
          {/* Claude Settings Card */}
          <Card>
            <VStack gap="md">
              <HStack justify="space-between" align="center">
                <Heading size="sm" as="h3">
                  Claude Settings
                </Heading>
                <StatusIndicator active={claudeSettings?.exists ?? false} />
              </HStack>
              <Box
                bg="tertiary"
                p="sm"
                borderRadius="md"
                style={{
                  fontFamily: 'monospace',
                  fontSize: theme.fontSize.sm,
                }}
              >
                <Text size="sm">{claudeSettings?.path}</Text>
              </Box>
              {claudeSettings?.exists && (
                <>
                  <HStack gap="xl" justify="flex-start">
                    <StatItem
                      value={claudeSettings.pluginCount ?? 0}
                      label="Plugins"
                    />
                    <StatItem
                      value={claudeSettings.mcpServerCount ?? 0}
                      label="MCP Servers"
                    />
                    <StatItem
                      value={claudeSettings.hasPermissions ? 'Yes' : 'No'}
                      label="Has Permissions"
                    />
                  </HStack>
                  {claudeSettings.lastModified && (
                    <Text size="sm" color="secondary">
                      Last modified: {formatDate(claudeSettings.lastModified)}
                    </Text>
                  )}
                </>
              )}
            </VStack>
          </Card>

          {/* Han Config Card */}
          <Card>
            <VStack gap="md">
              <HStack justify="space-between" align="center">
                <Heading size="sm" as="h3">
                  Han Configuration
                </Heading>
                <StatusIndicator active={hanConfig?.exists ?? false} />
              </HStack>
              <Box
                bg="tertiary"
                p="sm"
                borderRadius="md"
                style={{
                  fontFamily: 'monospace',
                  fontSize: theme.fontSize.sm,
                }}
              >
                <Text size="sm">{hanConfig?.path}</Text>
              </Box>
              {hanConfig?.exists && (
                <>
                  <HStack gap="sm" wrap>
                    <FeatureBadge
                      label="Hooks"
                      enabled={hanConfig.hooksEnabled ?? false}
                    />
                    <FeatureBadge
                      label="Memory"
                      enabled={hanConfig.memoryEnabled ?? false}
                    />
                    <FeatureBadge
                      label="Metrics"
                      enabled={hanConfig.metricsEnabled ?? false}
                    />
                  </HStack>
                  {(hanConfig.pluginConfigCount ?? 0) > 0 && (
                    <Text size="sm" color="secondary">
                      {hanConfig.pluginConfigCount} plugin(s) with custom
                      configuration
                    </Text>
                  )}
                  {hanConfig.lastModified && (
                    <Text size="sm" color="secondary">
                      Last modified: {formatDate(hanConfig.lastModified)}
                    </Text>
                  )}
                </>
              )}
              {!hanConfig?.exists && (
                <Box bg="tertiary" p="md" borderRadius="md">
                  <Text size="sm" color="secondary">
                    Create <code>~/.claude/han.yml</code> to configure Han
                    settings.
                  </Text>
                </Box>
              )}
            </VStack>
          </Card>
        </VStack>
      )}

      {/* Files Tab */}
      {activeTab === 'files' && (
        <VStack gap="xl">
          <VStack gap="md">
            <Heading size="sm" as="h3">
              Claude Settings Files
            </Heading>
            <Text color="secondary" size="sm">
              Configuration files for Claude Code plugins and MCP servers
            </Text>
            <VStack gap="md">
              {claudeSettingsFiles.map((file) => (
                <SettingsFileCard
                  key={file.path}
                  file={{
                    path: file.path ?? '',
                    source: file.source ?? '',
                    sourceLabel: file.sourceLabel ?? '',
                    exists: file.exists ?? false,
                    lastModified: file.lastModified ?? null,
                    type: file.type ?? '',
                  }}
                />
              ))}
            </VStack>
          </VStack>

          <VStack gap="md">
            <Heading size="sm" as="h3">
              Han Configuration Files
            </Heading>
            <Text color="secondary" size="sm">
              Configuration files for Han hooks, memory, and metrics
            </Text>
            <VStack gap="md">
              {hanConfigFiles.map((file) => (
                <SettingsFileCard
                  key={file.path}
                  file={{
                    path: file.path ?? '',
                    source: file.source ?? '',
                    sourceLabel: file.sourceLabel ?? '',
                    exists: file.exists ?? false,
                    lastModified: file.lastModified ?? null,
                    type: file.type ?? '',
                  }}
                />
              ))}
            </VStack>
          </VStack>

          <Card>
            <VStack gap="md">
              <Heading size="sm" as="h4">
                Configuration Precedence
              </Heading>
              <Text color="secondary" size="sm">
                Settings are merged in order from first to last, with later
                files overriding earlier ones:
              </Text>
              <VStack gap="sm" style={{ paddingLeft: theme.spacing.md }}>
                <Text size="sm">
                  1. <strong>User</strong> - Global defaults in{' '}
                  <code>~/.claude/</code>
                </Text>
                <Text size="sm">
                  2. <strong>Project</strong> - Team settings in{' '}
                  <code>.claude/</code> (committed to git)
                </Text>
                <Text size="sm">
                  3. <strong>Local</strong> - Personal overrides in{' '}
                  <code>.claude/*.local.*</code> (gitignored)
                </Text>
                <Text size="sm">
                  4. <strong>Project Root</strong> - Han config in{' '}
                  <code>han.yml</code> (project root)
                </Text>
              </VStack>
            </VStack>
          </Card>
        </VStack>
      )}

      {/* MCP Servers Tab */}
      {activeTab === 'mcp' && (
        <VStack gap="md">
          {mcpServers.length === 0 ? (
            <VStack
              gap="sm"
              align="center"
              style={{ padding: theme.spacing.xl }}
            >
              <Text color="secondary">No MCP servers configured.</Text>
              <Text size="sm" color="muted">
                Add MCP servers to <code>~/.claude/settings.json</code> under
                "mcpServers"
              </Text>
            </VStack>
          ) : (
            <VStack gap="md">
              {mcpServers
                .filter(
                  (server): server is typeof server & { id: string } =>
                    !!server.id
                )
                .map((server) => (
                  <McpServerCard
                    key={server.id}
                    server={{
                      id: server.id,
                      name: server.name ?? 'Unknown',
                      command: server.command ?? null,
                      url: server.url ?? null,
                      type: server.type ?? '',
                      argCount: server.argCount ?? 0,
                      hasEnv: server.hasEnv ?? false,
                    }}
                  />
                ))}
            </VStack>
          )}
        </VStack>
      )}

      {/* Permissions Tab */}
      {activeTab === 'permissions' && (
        <VStack gap="lg">
          <Card>
            <VStack gap="md">
              <Heading size="sm" as="h4">
                Allowed Tools
              </Heading>
              {(permissions.allowedTools?.length ?? 0) === 0 ? (
                <Text color="muted" size="sm">
                  No tools explicitly allowed
                </Text>
              ) : (
                <VStack gap="xs">
                  {(permissions.allowedTools ?? []).map((tool) => (
                    <HStack key={tool} gap="sm" align="center">
                      <Badge variant="success">allowed</Badge>
                      <Text size="sm">{tool}</Text>
                    </HStack>
                  ))}
                </VStack>
              )}
            </VStack>
          </Card>

          <Card>
            <VStack gap="md">
              <Heading size="sm" as="h4">
                Denied Tools
              </Heading>
              {(permissions.deniedTools?.length ?? 0) === 0 ? (
                <Text color="muted" size="sm">
                  No tools explicitly denied
                </Text>
              ) : (
                <VStack gap="xs">
                  {(permissions.deniedTools ?? []).map((tool) => (
                    <HStack key={tool} gap="sm" align="center">
                      <Badge variant="danger">denied</Badge>
                      <Text size="sm">{tool}</Text>
                    </HStack>
                  ))}
                </VStack>
              )}
            </VStack>
          </Card>

          <Card>
            <VStack gap="md">
              <Heading size="sm" as="h4">
                Additional Directories
              </Heading>
              {(permissions.additionalDirectories?.length ?? 0) === 0 ? (
                <Text color="muted" size="sm">
                  No additional directories configured
                </Text>
              ) : (
                <VStack gap="xs">
                  {(permissions.additionalDirectories ?? []).map((dir) => (
                    <Box
                      key={dir}
                      bg="tertiary"
                      p="xs"
                      borderRadius="sm"
                      style={{
                        fontFamily: 'monospace',
                        fontSize: theme.fontSize.sm,
                      }}
                    >
                      <Text size="sm">{dir}</Text>
                    </Box>
                  ))}
                </VStack>
              )}
            </VStack>
          </Card>
        </VStack>
      )}

      {/* Help hint */}
      <Card>
        <VStack gap="md">
          <Heading size="sm" as="h4">
            Configuration Files
          </Heading>
          <VStack gap="xs">
            <Text size="sm">
              <code>~/.claude/settings.json</code> - Claude Code user settings
            </Text>
            <Text size="sm">
              <code>~/.claude/han.yml</code> - Han global configuration
            </Text>
            <Text size="sm">
              <code>.claude/settings.json</code> - Project-level Claude settings
            </Text>
            <Text size="sm">
              <code>.claude/han.yml</code> - Project-level Han configuration
            </Text>
          </VStack>
        </VStack>
      </Card>
    </VStack>
  );
}

/**
 * Settings page with Suspense boundary
 */
export default function SettingsPage(): React.ReactElement {
  const { projectId } = useParams<{ projectId?: string }>();

  return (
    <Suspense
      fallback={
        <VStack
          gap="md"
          align="center"
          justify="center"
          style={{ padding: theme.spacing.xl, minHeight: '200px' }}
        >
          <Spinner size="lg" />
          <Text color="secondary">Loading settings...</Text>
        </VStack>
      }
    >
      <SettingsContent projectId={projectId ?? null} />
    </Suspense>
  );
}
