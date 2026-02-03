/**
 * GraphQL CacheStats type
 *
 * Aggregate cache statistics.
 */

import { getCacheStats } from '../../api/cache.ts';
import { builder } from '../builder.ts';

/**
 * Cache stats data interface
 */
export interface CacheStatsData {
  totalEntries: number;
  totalFiles: number;
  oldestEntry: string | null;
  newestEntry: string | null;
}

const CacheStatsRef = builder.objectRef<CacheStatsData>('CacheStats');

export const CacheStatsType = CacheStatsRef.implement({
  description: 'Aggregate cache statistics',
  fields: (t) => ({
    totalEntries: t.exposeInt('totalEntries', {
      description: 'Total number of cache entries',
    }),
    totalFiles: t.exposeInt('totalFiles', {
      description: 'Total number of tracked files',
    }),
    oldestEntry: t.field({
      type: 'DateTime',
      nullable: true,
      description: 'Oldest cache entry timestamp',
      resolve: (stats) => stats.oldestEntry,
    }),
    newestEntry: t.field({
      type: 'DateTime',
      nullable: true,
      description: 'Newest cache entry timestamp',
      resolve: (stats) => stats.newestEntry,
    }),
  }),
});

/**
 * Get cache statistics
 */
export function queryCacheStats(): CacheStatsData {
  return getCacheStats();
}
