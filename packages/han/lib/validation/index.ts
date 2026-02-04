/**
 * Validation Module
 *
 * Re-exports all validation-related functionality for cleaner imports.
 *
 * @example
 * import { validate, analyzeGaps, detectPluginsByMarkers } from './validation';
 */

// Gap analysis
export { analyzeGaps } from './gaps.ts';
// Marker-based plugin detection
export {
  detectPluginsByMarkers,
  formatDetectionSummary,
  loadPluginDetection,
  type MarkerDetectionResult,
  type PluginWithDetection,
} from './marker-detection.ts';
// Main validation functions
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
} from './validate.ts';
