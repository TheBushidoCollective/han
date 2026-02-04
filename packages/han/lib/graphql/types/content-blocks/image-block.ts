/**
 * GraphQL ImageBlock type
 *
 * An image (base64 encoded or file path).
 */

import { builder } from '../../builder.ts';
import type { ContentBlockData, ImageBlockData } from './content-block-data.ts';
import { ContentBlockInterface } from './content-block-interface.ts';
import { ContentBlockTypeEnum } from './content-block-type-enum.ts';

export const ImageBlockType = builder
  .objectRef<ImageBlockData>('ImageBlock')
  .implement({
    description: 'An image (base64 encoded or file path)',
    interfaces: [ContentBlockInterface],
    isTypeOf: (obj): obj is ImageBlockData =>
      (obj as ContentBlockData).type === 'IMAGE',
    fields: (t) => ({
      type: t.field({
        type: ContentBlockTypeEnum,
        resolve: () => 'IMAGE' as const,
      }),
      mediaType: t.exposeString('mediaType', {
        description: 'MIME type of the image',
      }),
      dataUrl: t.exposeString('dataUrl', {
        description: 'Data URL for displaying the image',
      }),
    }),
  });
