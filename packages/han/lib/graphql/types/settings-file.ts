/**
 * GraphQL SettingsFile type
 *
 * A settings file with source information.
 */

import type { SettingsFile } from '../../api/settings.ts';
import { builder } from '../builder.ts';

/**
 * Settings file type ref
 */
const SettingsFileRef = builder.objectRef<SettingsFile>('SettingsFile');

/**
 * Settings file type implementation
 */
export const SettingsFileType = SettingsFileRef.implement({
  description: 'A settings file with source information',
  fields: (t) => ({
    path: t.exposeString('path', {
      description: 'Path to settings file',
    }),
    source: t.exposeString('source', {
      description: 'Source location (user, project, local, root, directory)',
    }),
    sourceLabel: t.exposeString('sourceLabel', {
      description: 'Human-readable source label',
    }),
    exists: t.exposeBoolean('exists', {
      description: 'Whether the file exists',
    }),
    lastModified: t.string({
      nullable: true,
      description: 'Last modification time',
      resolve: (s) => s.lastModified,
    }),
    type: t.exposeString('type', {
      description: 'File type (claude or han)',
    }),
  }),
});
