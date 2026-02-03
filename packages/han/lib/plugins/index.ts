/**
 * Plugins Module
 *
 * Re-exports all plugin-related functionality for cleaner imports.
 *
 * @example
 * import { installPlugin, uninstallPlugin, searchPlugins } from './plugins';
 */

// Marketplace cache
export {
  getCacheAge,
  getMarketplacePlugins,
  hasCachedMarketplace,
  type MarketplaceCache,
  updateMarketplaceCache,
} from '../marketplace-cache.ts';

// Plugin operations
export { installPlugin, installPlugins } from '../plugin-install.ts';
export { listPlugins } from './plugin-list.ts';
export { searchPlugins } from './plugin-search.ts';
export { PluginSelector } from './plugin-selector.tsx';

// UI Components
export { showPluginSelector } from './plugin-selector-wrapper.tsx';
export { uninstallPlugin, uninstallPlugins } from './plugin-uninstall.ts';
