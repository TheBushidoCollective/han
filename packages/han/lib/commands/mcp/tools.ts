import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  getClaudeConfigDir,
  getMergedPluginsAndMarketplaces,
  type MarketplaceConfig,
} from '../../config/claude-settings.ts';
import {
  checkForChangesAsync,
  findDirectoriesWithMarkers,
  getProjectRoot,
} from '../../hooks/hook-cache.ts';
import {
  loadPluginConfig,
  type PluginConfig,
} from '../../hooks/hook-config.ts';
import { recordMcpToolCall } from '../../telemetry/index.ts';
import { runConfiguredHook } from '../../validate.ts';

export interface PluginTool {
  name: string;
  description: string;
  pluginName: string;
  hookName: string;
  pluginRoot: string;
}

export interface AvailableHook {
  plugin: string;
  hook: string;
  description: string;
  pluginRoot: string;
}

/**
 * Find plugin in a marketplace root directory
 */
export function findPluginInMarketplace(
  marketplaceRoot: string,
  pluginName: string
): string | null {
  const potentialPaths = [
    join(marketplaceRoot, 'jutsu', pluginName),
    join(marketplaceRoot, 'do', pluginName),
    join(marketplaceRoot, 'hashi', pluginName),
    join(marketplaceRoot, pluginName),
  ];

  for (const path of potentialPaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  return null;
}

/**
 * Resolve a path to absolute, relative to cwd
 */
export function resolvePathToAbsolute(path: string): string {
  if (path.startsWith('/')) {
    return path;
  }
  return join(process.cwd(), path);
}

/**
 * Get plugin directory based on plugin name, marketplace, and marketplace config
 */
function getPluginDir(
  pluginName: string,
  marketplace: string,
  marketplaceConfig: MarketplaceConfig | undefined
): string | null {
  // If marketplace config specifies a directory source, use that path
  if (marketplaceConfig?.source?.source === 'directory') {
    const directoryPath = marketplaceConfig.source.path;
    if (directoryPath) {
      const absolutePath = resolvePathToAbsolute(directoryPath);
      const found = findPluginInMarketplace(absolutePath, pluginName);
      if (found) {
        return found;
      }
    }
  }

  // Check if we're in the marketplace repo itself (for development)
  const cwd = process.cwd();
  if (existsSync(join(cwd, '.claude-plugin', 'marketplace.json'))) {
    const found = findPluginInMarketplace(cwd, pluginName);
    if (found) {
      return found;
    }
  }

  // Fall back to the default shared config path
  const configDir = getClaudeConfigDir();
  if (!configDir) {
    return null;
  }

  const marketplaceRoot = join(
    configDir,
    'plugins',
    'marketplaces',
    marketplace
  );

  if (!existsSync(marketplaceRoot)) {
    return null;
  }

  return findPluginInMarketplace(marketplaceRoot, pluginName);
}

/**
 * Generate a human-readable description for a hook tool with natural language examples
 */
export function generateToolDescription(
  pluginName: string,
  hookName: string,
  pluginConfig: PluginConfig
): string {
  const hookDef = pluginConfig.hooks[hookName];
  const technology = pluginName.replace(/^(jutsu|do|hashi)-/, '');
  const techDisplay = technology.charAt(0).toUpperCase() + technology.slice(1);

  // Rich descriptions with natural language trigger examples
  const descriptions: Record<
    string,
    (tech: string, display: string) => string
  > = {
    test: (tech, display) =>
      `Run ${display} tests. Triggers: "run the tests", "run ${tech} tests", "check if tests pass", "execute test suite"`,
    lint: (tech, display) =>
      `Lint ${display} code for issues and style violations. Triggers: "lint the code", "check for ${tech} issues", "run the linter", "check code quality"`,
    typecheck: (_tech, display) =>
      `Type-check ${display} code for type errors. Triggers: "check types", "run type checking", "verify types", "typescript check"`,
    format: (_tech, display) =>
      `Check and fix ${display} code formatting. Triggers: "format the code", "check formatting", "fix formatting", "run formatter"`,
    build: (_tech, display) =>
      `Build the ${display} project. Triggers: "build the project", "compile the code", "run the build"`,
    compile: (tech, display) =>
      `Compile ${display} code. Triggers: "compile the code", "run compilation", "build ${tech}"`,
  };

  const descFn = descriptions[hookName];
  let desc = descFn
    ? descFn(technology, techDisplay)
    : `Run ${hookName} for ${techDisplay}. Triggers: "run ${hookName}", "${hookName} the ${technology} code"`;

  // Add context about where it runs
  if (hookDef?.dirsWith && hookDef.dirsWith.length > 0) {
    desc += `. Runs in directories containing: ${hookDef.dirsWith.join(', ')}`;
  }

  // Add the actual command for transparency
  if (hookDef?.command) {
    desc += `. Command: ${hookDef.command}`;
  }

  return desc;
}

/**
 * Discover all plugin tools from installed plugins
 */
export function discoverPluginTools(): PluginTool[] {
  const tools: PluginTool[] = [];
  const { plugins, marketplaces } = getMergedPluginsAndMarketplaces();

  for (const [pluginName, marketplace] of plugins.entries()) {
    const marketplaceConfig = marketplaces.get(marketplace);
    const pluginRoot = getPluginDir(pluginName, marketplace, marketplaceConfig);

    if (!pluginRoot) {
      continue;
    }

    // Load plugin config to discover hooks
    const pluginConfig = loadPluginConfig(pluginRoot, false);
    if (!pluginConfig || !pluginConfig.hooks) {
      continue;
    }

    // Create a tool for each hook (skip hooks with mcp: false)
    for (const [hookName, hookDef] of Object.entries(pluginConfig.hooks)) {
      // Skip hooks explicitly marked as not exposed to MCP
      if (hookDef.mcp === false) {
        continue;
      }

      const toolName = `${pluginName}_${hookName}`.replace(/-/g, '_');

      tools.push({
        name: toolName,
        description: generateToolDescription(
          pluginName,
          hookName,
          pluginConfig
        ),
        pluginName,
        hookName,
        pluginRoot,
      });
    }
  }

  return tools;
}

/**
 * Discover all available hooks from installed plugins (for consolidated hook_run tool)
 */
export function discoverAvailableHooks(): AvailableHook[] {
  const hooks: AvailableHook[] = [];
  const { plugins, marketplaces } = getMergedPluginsAndMarketplaces();

  for (const [pluginName, marketplace] of plugins.entries()) {
    const marketplaceConfig = marketplaces.get(marketplace);
    const pluginRoot = getPluginDir(pluginName, marketplace, marketplaceConfig);

    if (!pluginRoot) {
      continue;
    }

    // Load plugin config to discover hooks
    const pluginConfig = loadPluginConfig(pluginRoot, false);
    if (!pluginConfig || !pluginConfig.hooks) {
      continue;
    }

    // Create an entry for each hook (skip hooks with mcp: false)
    for (const [hookName, hookDef] of Object.entries(pluginConfig.hooks)) {
      // Skip hooks explicitly marked as not exposed to MCP
      if (hookDef.mcp === false) {
        continue;
      }

      hooks.push({
        plugin: pluginName,
        hook: hookName,
        description: generateToolDescription(
          pluginName,
          hookName,
          pluginConfig
        ),
        pluginRoot,
      });
    }
  }

  return hooks;
}

/**
 * Find a specific hook by plugin and hook name
 */
export function findHook(
  plugin: string,
  hook: string
): AvailableHook | undefined {
  const hooks = discoverAvailableHooks();
  return hooks.find((h) => h.plugin === plugin && h.hook === hook);
}

/**
 * Result of checking if a hook needs to run
 */
export interface HookCheckResult {
  /** Whether the hook needs to run (false = all cached) */
  needsRun: boolean;
  /** Directories that need to run (empty if all cached) */
  directoriesNeedingRun: string[];
  /** Total number of matching directories */
  totalDirectories: number;
  /** Message describing the result */
  message: string;
}

/**
 * Check if a hook needs to run by checking the cache for all matching directories.
 * Returns quickly if all directories are cached (no changes needed).
 */
export async function checkHookNeedsRun(
  pluginName: string,
  hookName: string,
  options: {
    sessionId?: string;
    directory?: string;
    checkSessionChangesOnly?: boolean;
  }
): Promise<HookCheckResult> {
  const hookInfo = findHook(pluginName, hookName);
  if (!hookInfo) {
    return {
      needsRun: true,
      directoriesNeedingRun: [],
      totalDirectories: 0,
      message: `Unknown hook: ${pluginName}/${hookName}`,
    };
  }

  // Load plugin config to get hook definition
  const pluginConfig = loadPluginConfig(hookInfo.pluginRoot, false);
  if (!pluginConfig?.hooks?.[hookName]) {
    return {
      needsRun: true,
      directoriesNeedingRun: [],
      totalDirectories: 0,
      message: `Hook config not found for ${pluginName}/${hookName}`,
    };
  }

  const hookDef = pluginConfig.hooks[hookName];
  const patterns = hookDef.ifChanged || ['**/*'];
  const projectRoot = getProjectRoot();

  // Find directories to check
  let directories: string[];
  if (options.directory) {
    // Single directory specified
    directories = [join(projectRoot, options.directory)];
  } else if (hookDef.dirsWith && hookDef.dirsWith.length > 0) {
    // Find all matching directories
    directories = findDirectoriesWithMarkers(projectRoot, hookDef.dirsWith);
  } else {
    // No dirsWith - run in project root
    directories = [projectRoot];
  }

  if (directories.length === 0) {
    return {
      needsRun: false,
      directoriesNeedingRun: [],
      totalDirectories: 0,
      message: `No directories found matching ${hookDef.dirsWith?.join(', ') || 'project root'}`,
    };
  }

  // Check each directory for changes
  const directoriesNeedingRun: string[] = [];
  for (const dir of directories) {
    const hasChanges = await checkForChangesAsync(
      pluginName,
      hookName,
      dir,
      patterns,
      hookInfo.pluginRoot,
      {
        sessionId: options.sessionId,
        directory: dir,
        checkSessionChangesOnly: options.checkSessionChangesOnly,
      }
    );

    if (hasChanges) {
      // Convert to relative path for display
      const relativePath =
        dir === projectRoot ? '.' : dir.replace(`${projectRoot}/`, '');
      directoriesNeedingRun.push(relativePath);
    }
  }

  const needsRun = directoriesNeedingRun.length > 0;
  const cachedCount = directories.length - directoriesNeedingRun.length;

  let message: string;
  if (!needsRun) {
    message = `✅ All ${directories.length} director${directories.length === 1 ? 'y' : 'ies'} passed`;
  } else if (cachedCount > 0) {
    message = `${directoriesNeedingRun.length} director${directoriesNeedingRun.length === 1 ? 'y needs' : 'ies need'} validation (${cachedCount} cached)`;
  } else {
    message = `${directoriesNeedingRun.length} director${directoriesNeedingRun.length === 1 ? 'y needs' : 'ies need'} validation`;
  }

  return {
    needsRun,
    directoriesNeedingRun,
    totalDirectories: directories.length,
    message,
  };
}

/**
 * Generate dynamic description for the consolidated hook_run tool
 */
export function generateHookRunDescription(hooks: AvailableHook[]): string {
  // Group hooks by category (jutsu, do, hashi, core, bushido)
  const byCategory = new Map<string, AvailableHook[]>();

  for (const hook of hooks) {
    let category = 'other';
    if (hook.plugin.startsWith('jutsu-')) category = 'jutsu';
    else if (hook.plugin.startsWith('do-')) category = 'do';
    else if (hook.plugin.startsWith('hashi-')) category = 'hashi';
    else if (hook.plugin === 'core' || hook.plugin === 'bushido')
      category = 'core';

    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category)?.push(hook);
  }

  const lines: string[] = [
    'Execute a plugin hook. Checks cache first - if no files changed, returns immediate success. Otherwise, returns the CLI command to run via Bash for real-time output.',
    '',
    'Available hooks by category:',
    '',
  ];

  // Sort categories for consistent output
  const categoryOrder = ['jutsu', 'do', 'hashi', 'core', 'other'];
  const categoryTitles: Record<string, string> = {
    jutsu: 'Jutsu (validation/quality)',
    do: 'Do (specialized agents)',
    hashi: 'Hashi (MCP integrations)',
    core: 'Core (foundation)',
    other: 'Other',
  };

  for (const cat of categoryOrder) {
    const catHooks = byCategory.get(cat);
    if (!catHooks || catHooks.length === 0) continue;

    lines.push(`**${categoryTitles[cat]}:**`);
    for (const h of catHooks) {
      // Extract short description (first sentence or first N chars)
      const shortDesc = h.description.split('.')[0];
      lines.push(`- ${h.plugin}/${h.hook}: ${shortDesc}`);
    }
    lines.push('');
  }

  lines.push('Parameters:');
  lines.push("- plugin (required): Plugin name (e.g., 'jutsu-biome')");
  lines.push("- hook (required): Hook name (e.g., 'lint')");
  lines.push('- cache: Use cached results (default: true)');
  lines.push('- directory: Limit to specific directory');
  lines.push('- verbose: Show full output in real-time');

  return lines.join('\n');
}

export interface ExecuteToolOptions {
  verbose?: boolean;
  failFast?: boolean;
  directory?: string;
  cache?: boolean;
}

export interface ExecuteToolResult {
  success: boolean;
  output: string;
  idleTimedOut?: boolean;
}

/**
 * Get MCP absolute timeout in milliseconds (default: 10 minutes)
 * This is the maximum time a tool can run before being forcibly terminated.
 */
function getMcpTimeout(): number {
  const envValue = process.env.HAN_MCP_TIMEOUT;
  if (envValue) {
    const parsed = Number.parseInt(envValue, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 10 * 60 * 1000; // 10 minutes default
}

/**
 * Create a timeout promise that rejects after the specified duration
 */
function createTimeoutPromise(
  ms: number,
  toolName: string
): { promise: Promise<never>; cancel: () => void } {
  let timeoutId: NodeJS.Timeout;
  const promise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`MCP_TIMEOUT: Tool ${toolName} exceeded ${ms}ms limit`));
    }, ms);
  });
  return {
    promise,
    cancel: () => clearTimeout(timeoutId),
  };
}

/**
 * Execute a plugin tool
 */
export async function executePluginTool(
  tool: PluginTool,
  options: ExecuteToolOptions
): Promise<ExecuteToolResult> {
  const { verbose = false, directory } = options;

  // When targeting a specific directory, disable cache and checkpoints
  // This is a targeted re-run, so we want to run unconditionally
  // Otherwise, let validate.ts use han.yml defaults for cache and failFast
  const cache = directory ? false : options.cache;
  const failFast = options.failFast; // undefined = use han.yml default

  const startTime = Date.now();
  const timeout = getMcpTimeout();
  let timedOut = false;

  // Capture console output and stream to stderr for progress visibility
  const outputLines: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args) => {
    const line = args.join(' ');
    outputLines.push(line);
    // Stream to stderr so agent can see progress (stderr not captured in context)
    process.stderr.write(`[${tool.pluginName}/${tool.hookName}] ${line}\n`);
  };
  console.error = (...args) => {
    const line = args.join(' ');
    outputLines.push(line);
    // Stream to stderr so agent can see progress
    process.stderr.write(`[${tool.pluginName}/${tool.hookName}] ${line}\n`);
  };

  let success = true;

  // Create timeout for the entire operation
  const timeoutControl = createTimeoutPromise(timeout, tool.name);

  try {
    // Set CLAUDE_PLUGIN_ROOT for the hook
    process.env.CLAUDE_PLUGIN_ROOT = tool.pluginRoot;

    // Use runConfiguredHook but catch the exit
    const originalExit = process.exit;
    let exitCode = 0;

    process.exit = ((code?: number) => {
      exitCode = code ?? 0;
      throw new Error(`__EXIT_${exitCode}__`);
    }) as never;

    // Create the hook execution promise
    const hookPromise = (async () => {
      try {
        await runConfiguredHook({
          pluginName: tool.pluginName,
          hookName: tool.hookName,
          failFast,
          cache,
          only: directory,
          verbose,
        });
      } catch (e) {
        const error = e as Error;
        if (error.message?.startsWith('__EXIT_')) {
          exitCode = Number.parseInt(
            error.message.replace('__EXIT_', '').replace('__', ''),
            10
          );
        } else {
          throw e;
        }
      }
      return exitCode;
    })();

    try {
      // Race between hook execution and timeout
      exitCode = await Promise.race([hookPromise, timeoutControl.promise]);
      success = exitCode === 0;
    } catch (e) {
      const error = e as Error;
      if (error.message?.startsWith('MCP_TIMEOUT:')) {
        timedOut = true;
        success = false;
        outputLines.push(
          `\n⏱️ Timeout: Tool execution exceeded ${Math.round(timeout / 1000)}s limit and was terminated.`
        );
        process.stderr.write(
          `[${tool.pluginName}/${tool.hookName}] ⏱️ Timeout after ${Math.round(timeout / 1000)}s\n`
        );
      } else {
        throw e;
      }
    } finally {
      process.exit = originalExit;
      timeoutControl.cancel();
    }
  } catch (error) {
    success = false;
    outputLines.push(
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  // Record telemetry for MCP tool call
  const duration = Date.now() - startTime;
  recordMcpToolCall(tool.name, success, duration);

  return {
    success,
    output: outputLines.join('\n') || (success ? 'Success' : 'Failed'),
    idleTimedOut: timedOut,
  };
}

/**
 * Execute a hook by plugin and hook name (for consolidated hook_run tool)
 */
export async function executeHookByName(
  pluginName: string,
  hookName: string,
  options: ExecuteToolOptions
): Promise<ExecuteToolResult> {
  const hook = findHook(pluginName, hookName);

  if (!hook) {
    return {
      success: false,
      output: `Unknown hook: ${pluginName}/${hookName}. Use the tool without arguments to see available hooks.`,
    };
  }

  // Convert to PluginTool format for executePluginTool
  const tool: PluginTool = {
    name: `${pluginName}_${hookName}`.replace(/-/g, '_'),
    description: hook.description,
    pluginName: hook.plugin,
    hookName: hook.hook,
    pluginRoot: hook.pluginRoot,
  };

  return executePluginTool(tool, options);
}
