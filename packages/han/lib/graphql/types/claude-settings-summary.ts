/**
 * GraphQL ClaudeSettingsSummary type
 *
 * Summary of Claude user settings.
 */

import { builder } from '../builder.ts';

/**
 * Claude settings summary data
 */
export interface ClaudeSettingsSummaryData {
  path: string;
  exists: boolean;
  lastModified: string | null;
  pluginCount: number;
  mcpServerCount: number;
  hasPermissions: boolean;
}

/**
 * Claude settings summary type ref
 */
const ClaudeSettingsSummaryRef = builder.objectRef<ClaudeSettingsSummaryData>(
  'ClaudeSettingsSummary'
);

/**
 * Claude settings summary type implementation
 */
export const ClaudeSettingsSummaryType = ClaudeSettingsSummaryRef.implement({
  description: 'Summary of Claude user settings',
  fields: (t) => ({
    path: t.exposeString('path', {
      description: 'Path to settings file',
    }),
    exists: t.exposeBoolean('exists', {
      description: 'Whether the settings file exists',
    }),
    lastModified: t.string({
      nullable: true,
      description: 'Last modification time',
      resolve: (s) => s.lastModified,
    }),
    pluginCount: t.exposeInt('pluginCount', {
      description: 'Number of enabled plugins',
    }),
    mcpServerCount: t.exposeInt('mcpServerCount', {
      description: 'Number of configured MCP servers',
    }),
    hasPermissions: t.exposeBoolean('hasPermissions', {
      description: 'Whether permissions are configured',
    }),
  }),
});
