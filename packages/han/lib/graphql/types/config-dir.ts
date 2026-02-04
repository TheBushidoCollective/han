/**
 * GraphQL ConfigDir type
 *
 * Represents a registered config directory for multi-environment indexing.
 * Implements the Node interface for Relay global ID support.
 */

import type { ConfigDir } from '../../db/index.ts';
import { builder } from '../builder.ts';
import { encodeGlobalId, registerNodeLoader } from '../node-registry.ts';

/**
 * ConfigDir type ref
 */
export const ConfigDirRef = builder.objectRef<ConfigDir>('ConfigDir');

/**
 * ConfigDir type implementation with global ID
 */
export const ConfigDirType = ConfigDirRef.implement({
  description:
    'A registered config directory for multi-environment session indexing',
  fields: (t) => ({
    id: t.id({
      description: 'Global ID (ConfigDir_{id})',
      resolve: (configDir) => encodeGlobalId('ConfigDir', configDir.id),
    }),
    path: t.exposeString('path', {
      description: 'Absolute filesystem path to the config directory',
    }),
    name: t.string({
      nullable: true,
      description: "Human-friendly name (e.g., 'Work', 'Personal')",
      resolve: (configDir) => configDir.name ?? null,
    }),
    registeredAt: t.field({
      type: 'DateTime',
      description: 'When this config directory was registered',
      resolve: (configDir) => configDir.registeredAt,
    }),
    lastIndexedAt: t.field({
      type: 'DateTime',
      nullable: true,
      description: 'When sessions from this directory were last indexed',
      resolve: (configDir) => configDir.lastIndexedAt ?? null,
    }),
    sessionCount: t.int({
      nullable: true,
      description: 'Number of sessions from this config directory',
      resolve: (configDir) => configDir.sessionCount ?? null,
    }),
    isDefault: t.exposeBoolean('isDefault', {
      description: 'Whether this is the default config directory (~/.claude)',
    }),
  }),
});

/**
 * Shape of the mutation result
 */
export interface ConfigDirMutationResult {
  success: boolean;
  message: string | null;
  configDir: ConfigDir | null;
}

/**
 * ConfigDir mutation result ref
 */
const ConfigDirMutationResultRef = builder.objectRef<ConfigDirMutationResult>(
  'ConfigDirMutationResult'
);

/**
 * ConfigDir mutation result type
 */
export const ConfigDirMutationResultType = ConfigDirMutationResultRef.implement(
  {
    description: 'Result of a config directory mutation',
    fields: (t) => ({
      success: t.exposeBoolean('success', {
        description: 'Whether the operation succeeded',
      }),
      message: t.string({
        nullable: true,
        description: 'Human-readable result message',
        resolve: (result) => result.message,
      }),
      configDir: t.field({
        type: ConfigDirRef,
        nullable: true,
        description: 'The affected config directory (if applicable)',
        resolve: (result) => result.configDir,
      }),
    }),
  }
);

// Register node loader for ConfigDir type
registerNodeLoader('ConfigDir', async (id: string) => {
  const { listConfigDirs } = await import('../../db/index.ts');
  const configDirs = await listConfigDirs();
  return configDirs.find((c) => c.id === id) ?? null;
});
