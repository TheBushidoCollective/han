/**
 * Configuration Module
 *
 * Re-exports all configuration-related functionality for cleaner imports.
 *
 * @example
 * import { getMergedHanConfig, getMergedSettings, validate } from './config';
 */

// Validation and hook execution
export {
  buildHookCommand,
  buildMcpToolInstruction,
  generateOutputFilename,
  getAbsoluteEnvFilePath,
  getCacheKeyForDirectory,
  getHanTempDir,
  isDebugMode,
  type RunConfiguredHookOptions,
  runConfiguredHook,
  validate,
  wrapCommandWithEnvFile,
  writeDebugFile,
  writeOutputFile,
} from '../validation/index.ts';
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
  isFailFastEnabled,
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
