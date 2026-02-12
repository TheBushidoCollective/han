/**
 * Configuration Module
 *
 * Re-exports all configuration-related functionality for cleaner imports.
 *
 * @example
 * import { getMergedHanConfig, getMergedSettings } from './config';
 */

// Claude settings
export {
  type ClaudeSettings,
  getClaudeConfigDir,
  getMergedPluginsAndMarketplaces,
  getMergedSettings,
  getProjectDir,
  getSettingsPaths,
  type MarketplaceConfig,
  type MarketplaceSource,
  readSettingsFile,
  type SettingsScope,
} from './claude-settings.ts';
// Config validation
export {
  formatValidationErrors,
  type ValidationError,
  type ValidationResult,
  validatePluginConfig,
  validateUserConfig,
} from './config-validator.ts';
// Han settings
export {
  getHanBinary,
  getHanConfigPaths,
  getHanConfigPathsForDirectory,
  getMergedHanConfig,
  getMergedHanConfigForDirectory,
  getPluginHookSettings,
  type HanConfig,
  type HanConfigScope,
  type HookOverride,
  isCacheEnabled,
  isHooksEnabled,
  isMemoryEnabled,
  isMetricsEnabled,
  isSessionFilteringEnabled,
  loadHanConfigFile,
  type PluginSettings,
  type PortConfig,
} from './han-settings.ts';
// Port allocation
export {
  DEFAULT_BROWSE_PORT,
  DEFAULT_COORDINATOR_PORT,
  findAvailablePorts,
  getAllAllocatedPorts,
  getConfiguredPorts,
  getOrAllocatePorts,
  isPortAvailable,
  writePortsToConfig,
} from './port-allocation.ts';
