/**
 * GraphQL ContentBlock interface
 *
 * Base interface for all content blocks.
 */

import { builder } from '../../builder.ts';
import type { ContentBlockData } from './content-block-data.ts';
import { ContentBlockTypeEnum } from './content-block-type-enum.ts';

export const ContentBlockInterface = builder
  .interfaceRef<ContentBlockData>('ContentBlock')
  .implement({
    description: 'A content block within a message',
    fields: (t) => ({
      type: t.field({
        type: ContentBlockTypeEnum,
        description: 'The type of this content block',
      }),
    }),
    resolveType: (block) => {
      switch (block.type) {
        case 'THINKING':
          return 'ThinkingBlock';
        case 'TEXT':
          return 'TextBlock';
        case 'TOOL_USE':
          return 'ToolUseBlock';
        case 'TOOL_RESULT':
          return 'ToolResultBlock';
        case 'IMAGE':
          return 'ImageBlock';
        default:
          return 'TextBlock';
      }
    },
  });
