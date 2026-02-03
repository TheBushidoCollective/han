/**
 * GraphQL FileValidation type
 *
 * Represents a hook validation for a file.
 */

import type { SessionFileValidation as FileValidationData } from '../../../db/index.ts';
import { builder } from '../../builder.ts';

export const FileValidationType =
  builder.objectRef<FileValidationData>('FileValidation');

FileValidationType.implement({
  description: 'A hook validation for a file',
  fields: (t) => ({
    id: t.exposeString('id', {
      nullable: true,
      description: 'Unique identifier for this validation',
    }),
    pluginName: t.exposeString('pluginName', {
      description: 'Name of the plugin that validated the file',
    }),
    hookName: t.exposeString('hookName', {
      description: 'Name of the hook that validated the file',
    }),
    directory: t.exposeString('directory', {
      description: 'Directory context for the validation',
    }),
    validatedAt: t.field({
      type: 'DateTime',
      nullable: true,
      description: 'When the file was validated',
      resolve: (fv) => fv.validatedAt ?? null,
    }),
  }),
});
