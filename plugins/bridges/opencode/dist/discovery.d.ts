/**
 * Plugin and hook discovery.
 *
 * Reads Claude Code settings files to find installed Han plugins,
 * resolves their paths via the marketplace, and parses han-plugin.yml
 * to extract hook definitions.
 *
 * This replaces `han hook dispatch`'s discovery with direct filesystem
 * reads, giving the bridge full control over hook execution.
 */
import type { HookDefinition } from './types';
/**
 * Resolve enabled plugins to their filesystem paths.
 * Returns a map of plugin name -> absolute plugin root path.
 */
export declare function resolvePluginPaths(projectDir: string): Map<string, string>;
/**
 * Discover all hook definitions from installed Han plugins.
 *
 * Reads settings files to find enabled plugins, resolves their paths
 * via the marketplace, and parses han-plugin.yml for hook definitions.
 */
export declare function discoverHooks(projectDir: string): HookDefinition[];
/**
 * Filter hooks to only those matching a specific event type.
 */
export declare function getHooksByEvent(hooks: HookDefinition[], event: string): HookDefinition[];
