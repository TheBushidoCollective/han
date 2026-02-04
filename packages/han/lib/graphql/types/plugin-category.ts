/**
 * GraphQL PluginCategory type
 *
 * Plugin count by category.
 */

import { getPluginCategories } from '../../api/plugins.ts';
import { builder } from '../builder.ts';

/**
 * Plugin category data interface
 */
export interface PluginCategoryData {
  category: string;
  count: number;
}

const PluginCategoryRef =
  builder.objectRef<PluginCategoryData>('PluginCategory');

export const PluginCategoryType = PluginCategoryRef.implement({
  description: 'Plugin count by category',
  fields: (t) => ({
    category: t.exposeString('category', {
      description: 'Category name',
    }),
    count: t.exposeInt('count', {
      description: 'Number of plugins in this category',
    }),
  }),
});

/**
 * Get plugin categories
 */
export function queryPluginCategories(): PluginCategoryData[] {
  const categories = getPluginCategories();
  return Object.entries(categories)
    .filter(([, count]) => count > 0)
    .map(([category, count]) => ({ category, count }));
}
