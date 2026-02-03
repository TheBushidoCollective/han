/**
 * GraphQL SettingsSummary type
 *
 * Settings summary with all configuration locations.
 */

import {
  getMcpServers,
  getPermissions,
  getSettingsSummary,
  type SettingsSummary,
} from '../../api/settings.ts';
import { builder } from '../builder.ts';
import { ClaudeSettingsSummaryType } from './claude-settings-summary.ts';
import { HanConfigSummaryType } from './han-config-summary.ts';
import { McpServerType } from './mcp-server.ts';
import { PermissionsType } from './permissions.ts';
import { SettingsFileType } from './settings-file.ts';

/**
 * Settings summary type ref
 */
const SettingsSummaryRef =
  builder.objectRef<SettingsSummary>('SettingsSummary');

/**
 * Settings summary type implementation
 */
export const SettingsSummaryType = SettingsSummaryRef.implement({
  description: 'Settings summary with all configuration locations',
  fields: (t) => ({
    claudeSettingsFiles: t.field({
      type: [SettingsFileType],
      description: 'All Claude settings files with source information',
      resolve: (s) => s.claudeSettingsFiles,
    }),
    hanConfigFiles: t.field({
      type: [SettingsFileType],
      description: 'All Han config files with source information',
      resolve: (s) => s.hanConfigFiles,
    }),
    claudeSettings: t.field({
      type: ClaudeSettingsSummaryType,
      description: 'Claude settings summary (legacy)',
      resolve: (s) => s.claudeSettings,
    }),
    hanConfig: t.field({
      type: HanConfigSummaryType,
      description: 'Han configuration summary (legacy)',
      resolve: (s) => s.hanConfig,
    }),
    mcpServers: t.field({
      type: [McpServerType],
      description: 'Configured MCP servers',
      resolve: () => getMcpServers(),
    }),
    permissions: t.field({
      type: PermissionsType,
      description: 'Permissions configuration',
      resolve: () => getPermissions(),
    }),
  }),
});

/**
 * Query settings summary
 */
export function querySettingsSummary(projectId?: string): SettingsSummary {
  return getSettingsSummary(projectId);
}
