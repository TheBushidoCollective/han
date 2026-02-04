/**
 * Install Module
 *
 * Re-exports all installation-related functionality for cleaner imports.
 *
 * @example
 * import { install, installInteractive, uninstall } from './install';
 */

// Installation functions
export { install, installInteractive } from './install.ts';
// UI Components
export {
  formatToolUsage,
  InstallInteractive,
  parseMarkdown,
} from './install-interactive.tsx';
export { InstallProgress } from './install-progress.tsx';
// Uninstallation
export { uninstall } from './uninstall.ts';
