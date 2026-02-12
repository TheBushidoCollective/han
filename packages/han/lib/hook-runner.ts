import { execSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import micromatch from 'micromatch';
import {
  getClaudeConfigDir,
  getMergedPluginsAndMarketplaces,
} from './config/claude-settings.ts';
import {
  getPluginHookSettings,
  isCacheEnabled,
} from './config/han-settings.ts';
import { getSessionModifiedFiles, sessionFileValidations } from './db/index.ts';
import { getEventLogger } from './events/logger.ts';
import {
  createLockManager,
  isHookRunning,
  waitForHook,
  withGlobalSlot,
  withSlot,
} from './hook-lock.ts';
import {
  checkForChangesAsync,
  computeFileHash,
  findDirectoriesWithMarkers,
  findFilesWithGlob,
  trackFilesAsync,
} from './hooks/hook-cache.ts';
import {
  getHookConfigs,
  getHookDefinition,
  type PluginHookDefinition,
  type ResolvedHookConfig,
} from './hooks/hook-config.ts';
import {
  buildCommandWithFiles,
  HAN_FILES_TEMPLATE,
} from './hooks/transcript-filter.ts';
import { getPluginNameFromRoot, isDebugMode } from './shared.ts';

// Re-export for tests
export { HAN_FILES_TEMPLATE, buildCommandWithFiles };

/**
 * Compute SHA256 hash of a command string.
 * Used to detect when hook commands change and need to re-run.
 */
function computeCommandHash(command: string): string {
  return createHash('sha256').update(command).digest('hex');
}

/**
 * Get the han temp directory for output files
 */
export function getHanTempDir(): string {
  const dir = join(tmpdir(), 'han-hook-output');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Generate a unique filename for hook output
 */
export function generateOutputFilename(
  hookName: string,
  directory: string
): string {
  const timestamp = Date.now();
  const sanitizedDir = directory.replace(/[^a-zA-Z0-9]/g, '_').slice(-30);
  return `${hookName}_${sanitizedDir}_${timestamp}`;
}

/**
 * Write debug info to a file
 */
export function writeDebugFile(
  basePath: string,
  info: Record<string, unknown>
): string {
  const debugPath = `${basePath}.debug.txt`;
  const lines: string[] = [
    '=== Han Hook Debug Info ===',
    `Timestamp: ${new Date().toISOString()}`,
    '',
    '=== Environment ===',
    `NODE_VERSION: ${process.version}`,
    `PLATFORM: ${process.platform}`,
    `ARCH: ${process.arch}`,
    `CWD: ${process.cwd()}`,
    `CLAUDE_PROJECT_DIR: ${process.env.CLAUDE_PROJECT_DIR || '(not set)'}`,
    `CLAUDE_PLUGIN_ROOT: ${process.env.CLAUDE_PLUGIN_ROOT || '(not set)'}`,
    `CLAUDE_ENV_FILE: ${process.env.CLAUDE_ENV_FILE || '(not set)'}`,
    `PATH: ${process.env.PATH || '(not set)'}`,
    '',
    '=== Hook Info ===',
  ];

  for (const [key, value] of Object.entries(info)) {
    lines.push(`${key}: ${JSON.stringify(value)}`);
  }

  writeFileSync(debugPath, lines.join('\n'), 'utf-8');
  return debugPath;
}

/**
 * Write output to a file
 */
export function writeOutputFile(basePath: string, output: string): string {
  const outputPath = `${basePath}.output.txt`;
  writeFileSync(outputPath, output, 'utf-8');
  return outputPath;
}

/**
 * Get the absolute path to CLAUDE_ENV_FILE.
 * Resolves relative paths against CLAUDE_PROJECT_DIR or cwd.
 */
export function getAbsoluteEnvFilePath(): string | null {
  const envFile = process.env.CLAUDE_ENV_FILE;
  if (!envFile) return null;

  // Security: Validate path to prevent shell injection
  // Only allow safe file path characters: alphanumeric, /, -, _, ., ~
  if (!/^[a-zA-Z0-9/_.\-~]+$/.test(envFile)) {
    console.error(
      `[han] SECURITY: Invalid CLAUDE_ENV_FILE path (contains unsafe characters): ${envFile}`
    );
    return null;
  }

  // If already absolute, use as-is
  if (envFile.startsWith('/')) return envFile;

  // Resolve relative path against project dir or cwd
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  return resolve(projectDir, envFile);
}

/**
 * Wrap a command to set up the proper environment.
 * - If CLAUDE_ENV_FILE is set, source it first (mimics Claude Code's behavior)
 * - Otherwise, use a login shell to get the user's full PATH (mise, etc.)
 */
export function wrapCommandWithEnvFile(cmd: string): string {
  const envFile = getAbsoluteEnvFilePath();
  if (envFile) {
    // Source the env file before running the command
    return `source "${envFile}" && ${cmd}`;
  }
  // No CLAUDE_ENV_FILE - just run the command directly
  // The shell: "/bin/bash" in execSync will provide a proper environment
  return cmd;
}

interface ValidateOptions {
  dirsWith: string | null;
  testDir?: string | null;
  command: string;
  verbose?: boolean;
}

/**
 * Find directories containing marker files (respects nested .gitignore files)
 */
function findDirectoriesWithMarker(
  rootDir: string,
  markerPatterns: string[]
): string[] {
  return findDirectoriesWithMarkers(rootDir, markerPatterns);
}

// Run command in directory (sync version for legacy format)
// When verbose=false, suppresses output and we'll tell the agent how to reproduce
// When verbose=true, inherits stdio to show full output
function runCommandSync(dir: string, cmd: string, verbose?: boolean): boolean {
  const wrappedCmd = wrapCommandWithEnvFile(cmd);
  try {
    if (verbose) {
      // Verbose mode: show full output
      execSync(wrappedCmd, {
        cwd: dir,
        stdio: 'inherit',
        encoding: 'utf8',
        shell: '/bin/bash',
      });
    } else {
      // Quiet mode: suppress output, we give the agent a concise instruction instead
      execSync(wrappedCmd, {
        cwd: dir,
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        shell: '/bin/bash',
      });
    }
    return true;
  } catch (_e) {
    return false;
  }
}

interface RunCommandResult {
  success: boolean;
  idleTimedOut?: boolean;
  /** Captured stdout/stderr output */
  output?: string;
  /** Path to the output file containing stdout/stderr (only on failure) */
  outputFile?: string;
  /** Path to the debug file (only when HAN_DEBUG=true) */
  debugFile?: string;
}

interface RunCommandOptions {
  dir: string;
  cmd: string;
  verbose?: boolean;
  idleTimeout?: number;
  /** Hook name for generating output filenames */
  hookName?: string;
  /** Plugin root directory for CLAUDE_PLUGIN_ROOT env var */
  pluginRoot?: string;
  /** Absolute timeout in seconds (safeguard against hangs). Default: 300s (5 min) */
  absoluteTimeout?: number;
}

/**
 * Get the default absolute timeout for commands in seconds.
 * This is a safeguard against hanging processes that output slowly but continuously,
 * bypassing the idle timeout.
 * Default: 5 minutes (300 seconds). Configurable via HAN_HOOK_ABSOLUTE_TIMEOUT.
 */
function getDefaultAbsoluteTimeout(): number {
  const envValue = process.env.HAN_HOOK_ABSOLUTE_TIMEOUT;
  if (envValue) {
    const parsed = Number.parseInt(envValue, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 300; // 5 minutes default
}

// Run command in directory (async version with idle timeout support)
// When verbose=false, captures output to temp file on failure
// When verbose=true, shows full output
async function runCommand(
  options: RunCommandOptions
): Promise<RunCommandResult> {
  const {
    dir,
    cmd,
    verbose,
    idleTimeout,
    hookName = 'hook',
    pluginRoot,
    absoluteTimeout = getDefaultAbsoluteTimeout(),
  } = options;
  const wrappedCmd = wrapCommandWithEnvFile(cmd);
  const debug = isDebugMode();
  const startTime = Date.now();

  return new Promise((resolvePromise) => {
    let resolved = false;
    let absoluteTimeoutHandle: NodeJS.Timeout | null = null;
    let absoluteTimedOut = false;

    const child = spawn(wrappedCmd, {
      cwd: dir,
      shell: '/bin/bash',
      stdio: verbose ? 'inherit' : ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...(pluginRoot ? { CLAUDE_PLUGIN_ROOT: pluginRoot } : {}),
      },
    });

    let idleTimeoutHandle: NodeJS.Timeout | null = null;
    let idleTimedOut = false;
    const outputChunks: string[] = [];

    // Convert seconds to milliseconds for setTimeout
    const idleTimeoutMs = idleTimeout ? idleTimeout * 1000 : undefined;
    const absoluteTimeoutMs = absoluteTimeout * 1000;

    // Reset idle timeout on output
    const resetIdleTimeout = () => {
      if (idleTimeoutHandle) {
        clearTimeout(idleTimeoutHandle);
      }
      if (idleTimeoutMs && idleTimeoutMs > 0) {
        idleTimeoutHandle = setTimeout(() => {
          idleTimedOut = true;
          child.kill();
        }, idleTimeoutMs);
      }
    };

    // Start initial idle timeout
    if (idleTimeoutMs && idleTimeoutMs > 0) {
      idleTimeoutHandle = setTimeout(() => {
        idleTimedOut = true;
        child.kill();
      }, idleTimeoutMs);
    }

    // Start absolute timeout as safeguard (always active)
    // Prevents processes that output slowly but continuously from hanging forever
    absoluteTimeoutHandle = setTimeout(() => {
      if (!resolved) {
        absoluteTimedOut = true;
        outputChunks.push(
          `\n⏱️ Absolute timeout: Command exceeded ${absoluteTimeout}s limit and was terminated.\n`
        );
        try {
          child.kill('SIGKILL');
        } catch {
          // Ignore kill errors
        }
      }
    }, absoluteTimeoutMs);

    // Capture output to file only (no streaming to avoid polluting context)
    if (!verbose) {
      child.stdout?.on('data', (data) => {
        const text = data.toString();
        outputChunks.push(text);
        resetIdleTimeout();
      });
      child.stderr?.on('data', (data) => {
        const text = data.toString();
        outputChunks.push(text);
        resetIdleTimeout();
      });
    }

    const finalizeResult = (success: boolean) => {
      if (resolved) return; // Prevent double resolution from close/error race
      resolved = true;

      if (idleTimeoutHandle) {
        clearTimeout(idleTimeoutHandle);
      }
      if (absoluteTimeoutHandle) {
        clearTimeout(absoluteTimeoutHandle);
      }

      const combinedOutput = outputChunks.join('');
      const result: RunCommandResult = {
        success,
        idleTimedOut: idleTimedOut || absoluteTimedOut,
        output: combinedOutput || undefined,
      };

      // Write output and debug files on failure (or always in debug mode)
      if (!success || debug) {
        const tempDir = getHanTempDir();
        const basePath = join(tempDir, generateOutputFilename(hookName, dir));

        // Write output file if we captured any output
        if (combinedOutput) {
          result.outputFile = writeOutputFile(basePath, combinedOutput);
        }

        // Write debug file in debug mode
        if (debug) {
          const duration = Date.now() - startTime;
          result.debugFile = writeDebugFile(basePath, {
            hookName,
            command: cmd,
            wrappedCommand: wrappedCmd,
            directory: dir,
            idleTimeout: idleTimeout ?? null,
            absoluteTimeout,
            idleTimedOut,
            absoluteTimedOut,
            exitSuccess: success,
            durationMs: duration,
            outputLength: combinedOutput.length,
          });
        }
      }

      resolvePromise(result);
    };

    child.on('close', (code) => {
      finalizeResult(code === 0 && !idleTimedOut && !absoluteTimedOut);
    });

    child.on('error', (err) => {
      outputChunks.push(`\nSpawn error: ${err.message}\n`);
      finalizeResult(false);
    });
  });
}

// Run test command silently in directory (returns true if exit code 0)
function testDirCommand(dir: string, cmd: string): boolean {
  const wrappedCmd = wrapCommandWithEnvFile(cmd);
  try {
    execSync(wrappedCmd, {
      cwd: dir,
      stdio: ['ignore', 'ignore', 'ignore'],
      encoding: 'utf8',
      shell: '/bin/bash',
    });
    return true;
  } catch (_e) {
    return false;
  }
}

export async function validate(options: ValidateOptions): Promise<void> {
  const { dirsWith, testDir, command: commandToRun, verbose } = options;

  // Canonicalize rootDir to match paths from native module (which uses fs::canonicalize)
  // This ensures path comparison works correctly on macOS where /var -> /private/var
  const rawRootDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const rootDir = existsSync(rawRootDir)
    ? realpathSync(rawRootDir)
    : rawRootDir;

  // No dirsWith specified - run in current directory only
  if (!dirsWith) {
    // In verbose mode, show what we're running
    if (verbose) {
      console.log(`\n[han] Running in .:`);
      console.log(`  $ ${commandToRun}\n`);
    }

    // Acquire slot, run command, release slot
    const success = await withSlot('legacy-validate', undefined, async () => {
      return runCommandSync(rootDir, commandToRun, verbose);
    });
    if (!success) {
      console.error(
        `\n❌ The command \`${commandToRun}\` failed.\n\n` +
          `Spawn a subagent to run the command, review the output, and fix all issues.\n` +
          `Do NOT ask the user any questions - proceed directly with fixing the issues.\n`
      );
      process.exit(2);
    }
    // Silent success - no need for a message when running a single command
    process.exit(0);
  }

  // Parse comma-delimited patterns
  const patterns = dirsWith.split(',').map((p) => p.trim());

  const failures: string[] = [];
  let processedCount = 0;

  // Find directories
  const directories = findDirectoriesWithMarker(rootDir, patterns);

  for (const dir of directories) {
    // Filter with test command if specified
    if (testDir && !testDirCommand(dir, testDir)) {
      continue;
    }

    processedCount++;

    const relativePath = dir === rootDir ? '.' : dir.replace(`${rootDir}/`, '');

    // In verbose mode, show what we're running
    if (verbose) {
      console.log(`\n[han] Running in ${relativePath}:`);
      console.log(`  $ ${commandToRun}\n`);
    }

    // Acquire slot, run command, release slot (per directory)
    const success = await withSlot('legacy-validate', undefined, async () => {
      return runCommandSync(dir, commandToRun, verbose);
    });

    if (!success) {
      failures.push(relativePath);
    }
  }

  if (processedCount === 0) {
    console.log(`No directories found with ${dirsWith}`);
    process.exit(0);
  }

  if (failures.length > 0) {
    console.error(
      `\n❌ ${failures.length} director${failures.length === 1 ? 'y' : 'ies'} failed validation.\n\n` +
        `Spawn ${failures.length === 1 ? 'a subagent' : 'subagents in parallel'} to fix the following:\n`
    );
    for (const dir of failures) {
      const cmdStr =
        dir === '.' ? commandToRun : `cd ${dir} && ${commandToRun}`;
      console.error(`  • \`${cmdStr}\``);
    }
    console.error(
      `\nEach subagent should run the command, review the output, and fix all issues.\n` +
        `Do NOT ask the user any questions - proceed directly with fixing the issues.\n`
    );
    process.exit(2);
  }

  console.log(
    `\n✅ All ${processedCount} director${processedCount === 1 ? 'y' : 'ies'} passed validation`
  );
  process.exit(0);
}

// ============================================
// Plugin Discovery (for running outside hook context)
// ============================================

/**
 * Find plugin in a marketplace root directory using multiple discovery methods.
 *
 * Discovery order:
 * 1. Check marketplace.json for the plugin's source path
 * 2. Scan for han-plugin.yml files (for external plugins)
 * 3. Fall back to legacy directory patterns
 */
function findPluginInMarketplace(
  marketplaceRoot: string,
  pluginName: string
): string | null {
  // 1. Try marketplace.json first (most reliable for han marketplace)
  const marketplaceJsonPath = join(
    marketplaceRoot,
    '.claude-plugin',
    'marketplace.json'
  );
  if (existsSync(marketplaceJsonPath)) {
    try {
      const marketplaceJson = JSON.parse(
        readFileSync(marketplaceJsonPath, 'utf8')
      );
      const plugin = marketplaceJson.plugins?.find(
        (p: { name: string }) => p.name === pluginName
      );
      if (plugin?.source) {
        // Source is relative to marketplace root (e.g., "./plugins/validation/biome")
        const pluginPath = join(marketplaceRoot, plugin.source);
        if (existsSync(pluginPath)) {
          return pluginPath;
        }
      }
    } catch {
      // Ignore parse errors, try other methods
    }
  }

  // 2. Scan for han-plugin.yml files in the marketplace (for external plugins)
  // Look for directories containing han-plugin.yml where the directory name matches
  const scanDirs = [marketplaceRoot, join(marketplaceRoot, 'plugins')];
  for (const scanDir of scanDirs) {
    if (!existsSync(scanDir)) continue;
    try {
      const entries = readdirSync(scanDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dirPath = join(scanDir, entry.name);
        // Check direct match
        if (entry.name === pluginName) {
          const hanPluginPath = join(dirPath, 'han-plugin.yml');
          if (existsSync(hanPluginPath)) {
            return dirPath;
          }
        }
        // Check subdirectories (one level deep for category dirs)
        try {
          const subEntries = readdirSync(dirPath, { withFileTypes: true });
          for (const subEntry of subEntries) {
            if (!subEntry.isDirectory()) continue;
            if (subEntry.name === pluginName) {
              const hanPluginPath = join(
                dirPath,
                subEntry.name,
                'han-plugin.yml'
              );
              if (existsSync(hanPluginPath)) {
                return join(dirPath, subEntry.name);
              }
            }
          }
        } catch {
          // Ignore permission errors
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  // 3. Legacy directory patterns (for backwards compatibility)
  const legacyPaths = [
    join(marketplaceRoot, 'jutsu', pluginName),
    join(marketplaceRoot, 'do', pluginName),
    join(marketplaceRoot, 'hashi', pluginName),
    join(marketplaceRoot, pluginName),
  ];

  for (const path of legacyPaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  return null;
}

/**
 * Resolve a path to absolute, relative to cwd
 */
function resolvePathToAbsolute(path: string): string {
  if (path.startsWith('/')) {
    return path;
  }
  return join(process.cwd(), path);
}

/**
 * Discover plugin root from settings when CLAUDE_PLUGIN_ROOT is not set.
 * Returns the plugin root path or null if not found.
 */
function discoverPluginRoot(pluginName: string): string | null {
  const { plugins, marketplaces } = getMergedPluginsAndMarketplaces();

  // Check if this plugin is enabled
  const marketplace = plugins.get(pluginName);
  if (!marketplace) {
    return null;
  }

  const marketplaceConfig = marketplaces.get(marketplace);

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
 * Options for running a configured hook
 */
export interface RunConfiguredHookOptions {
  /**
   * The plugin name (e.g., "jutsu-elixir")
   * Used to validate CLAUDE_PLUGIN_ROOT and generate proper error messages
   */
  pluginName: string;
  hookName: string;
  /**
   * Enable caching - skip hooks if no files changed since last successful run.
   * Defaults to han.yml hooks.cache (true if not set).
   * Can be overridden by HAN_NO_CACHE=1 environment variable.
   */
  cache?: boolean;
  /**
   * When set, only run in this specific directory.
   * Used for targeted re-runs after failures.
   */
  only?: string;
  /**
   * When true, show full command output instead of suppressing it.
   * Also settable via HAN_HOOK_RUN_VERBOSE=1 environment variable.
   */
  verbose?: boolean;
  /**
   * Checkpoint type to filter against (session or agent)
   * When set, only runs hook if files changed since both:
   * 1. Last hook run (cache check)
   * 2. Checkpoint creation (checkpoint check)
   */
  checkpointType?: 'session' | 'agent';
  /**
   * Checkpoint ID to filter against
   * Required when checkpointType is set
   */
  checkpointId?: string;
  /**
   * Skip dependency checks. Useful for recheck/retry scenarios
   * when dependencies have already been satisfied.
   */
  skipDeps?: boolean;
  /**
   * Claude session ID for cache tracking.
   * Required for hooks to be cached properly.
   */
  sessionId?: string;
  /**
   * Enable ${HAN_FILES} substitution from session-modified files.
   * For Stop hooks: substitutes with session-modified files filtered by hook rules.
   */
  async?: boolean;
}

/**
 * Generate a cache key for a directory-specific hook cache
 */
export function getCacheKeyForDirectory(
  hookName: string,
  directory: string,
  projectRoot: string
): string {
  const relativeDirPath =
    directory.replace(projectRoot, '').replace(/^\//, '').replace(/\//g, '_') ||
    'root';
  return `${hookName}_${relativeDirPath}`;
}

/**
 * Build the han hook run command for error messages (legacy - prefer MCP)
 */
export function buildHookCommand(
  pluginName: string,
  hookName: string,
  options: { cached?: boolean; only?: string }
): string {
  let cmd = `han hook run ${pluginName} ${hookName}`;
  if (options.cached) {
    cmd += ' --cached';
  }
  if (options.only) {
    cmd += ` --only=${options.only}`;
  }
  return cmd;
}

/**
 * Build MCP tool re-run instruction for error messages
 * When targeting a specific directory, cache is disabled automatically
 */
export function buildMcpToolInstruction(
  pluginName: string,
  hookName: string,
  options: { only?: string }
): string {
  const toolName = `${pluginName}_${hookName}`.replace(/-/g, '_');
  const args: string[] = [];

  if (options.only) {
    args.push(`directory: "${options.only}"`);
  }

  if (args.length > 0) {
    return `${toolName}(${args.join(', ')})`;
  }
  return `${toolName}()`;
}

/**
 * Run a hook using plugin config and user overrides.
 * This is the new format: `han hook run <plugin-name> <hook-name> [--no-cache] [--only=<dir>]`
 */
export async function runConfiguredHook(
  options: RunConfiguredHookOptions
): Promise<void> {
  const {
    pluginName,
    hookName,
    only,
    verbose,
    // checkpointType and checkpointId are no longer used - checkpoints feature removed
    skipDeps,
    sessionId,
  } = options;

  // Resolve cache setting
  // Priority: HAN_NO_CACHE env > options.cache > han.yml default
  const cache =
    process.env.HAN_NO_CACHE === '1' || process.env.HAN_NO_CACHE === 'true'
      ? false
      : (options.cache ?? isCacheEnabled());

  // Checkpoints feature has been removed - now using ifChanged + transcript filtering

  let pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  // Canonicalize projectRoot to match paths from native module (which uses fs::canonicalize)
  // This ensures path comparison works correctly on macOS where /var -> /private/var
  const rawProjectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const projectRoot = existsSync(rawProjectRoot)
    ? realpathSync(rawProjectRoot)
    : rawProjectRoot;

  // If CLAUDE_PLUGIN_ROOT is not set, try to discover it from settings
  if (!pluginRoot) {
    const discoveredRoot = discoverPluginRoot(pluginName);
    if (discoveredRoot) {
      pluginRoot = discoveredRoot;
      if (verbose) {
        console.log(`[han] Discovered plugin root: ${pluginRoot}`);
      }
    } else {
      console.error(
        `Error: Could not find plugin "${pluginName}".\n\n` +
          'The plugin must be enabled in your .claude/settings.json or .claude/settings.local.json.\n' +
          'If running outside of a Claude Code hook context, ensure the plugin is installed.'
      );
      process.exit(1);
    }
  } else {
    // Validate that CLAUDE_PLUGIN_ROOT matches the specified plugin name
    const pluginRootName = getPluginNameFromRoot(pluginRoot);
    if (pluginRootName !== pluginName) {
      console.error(
        `Error: Plugin name mismatch.\n` +
          `  Expected: ${pluginName}\n` +
          `  Got: ${pluginRootName} (from CLAUDE_PLUGIN_ROOT)\n\n` +
          `The hook command specifies plugin "${pluginName}" but CLAUDE_PLUGIN_ROOT points to "${pluginRootName}".`
      );
      process.exit(1);
    }
  }

  // Handle dependencies (unless --skip-deps is set)
  if (!skipDeps) {
    const hookDef = getHookDefinition(pluginRoot, hookName);
    if (hookDef?.dependsOn && hookDef.dependsOn.length > 0) {
      const lockManager = createLockManager();
      const { plugins } = getMergedPluginsAndMarketplaces();

      for (const dep of hookDef.dependsOn) {
        // Check if dependency plugin is installed
        const isDepInstalled = plugins.has(dep.plugin);

        if (!isDepInstalled) {
          if (dep.optional) {
            if (verbose) {
              console.log(
                `[${pluginName}/${hookName}] Skipping optional dependency: ${dep.plugin}/${dep.hook} (not installed)`
              );
            }
            continue;
          }
          // Required dependency is missing
          console.error(
            `Error: Required dependency plugin "${dep.plugin}" is not installed.\n\n` +
              `The hook "${pluginName}/${hookName}" requires "${dep.plugin}/${dep.hook}" to run first.\n` +
              `Install the dependency plugin with: han plugin install ${dep.plugin}`
          );
          process.exit(1);
        }

        // Check if dependency hook is already running
        if (isHookRunning(lockManager, dep.plugin, dep.hook)) {
          if (verbose) {
            console.log(
              `[${pluginName}/${hookName}] Waiting for dependency: ${dep.plugin}/${dep.hook} (already running)`
            );
          }
          const completed = await waitForHook(
            lockManager,
            dep.plugin,
            dep.hook
          );
          if (!completed) {
            console.error(
              `Error: Timeout waiting for dependency hook "${dep.plugin}/${dep.hook}" to complete.\n`
            );
            process.exit(1);
          }
        } else {
          // Dependency is not running - spawn it and wait
          if (verbose) {
            console.log(
              `[${pluginName}/${hookName}] Running dependency: ${dep.plugin}/${dep.hook}`
            );
          }

          // Run the dependency hook synchronously
          const result = spawnSync(
            'han',
            ['hook', 'run', dep.plugin, dep.hook, '--skip-deps'],
            {
              stdio: verbose ? 'inherit' : 'pipe',
              shell: true,
              env: {
                ...process.env,
                // Don't inherit CLAUDE_PLUGIN_ROOT since we're running a different plugin
                CLAUDE_PLUGIN_ROOT: '',
              },
            }
          );

          if (result.status !== 0) {
            console.error(
              `Error: Dependency hook "${dep.plugin}/${dep.hook}" failed.\n` +
                `Fix the dependency first, then retry.`
            );
            process.exit(2);
          }
        }
      }
    }
  }

  // Get all configs
  let configs = getHookConfigs(pluginRoot, hookName, projectRoot);

  // If --only is specified, filter to just that directory
  if (only) {
    const onlyAbsolute = only.startsWith('/') ? only : join(projectRoot, only);
    const normalizedOnly = onlyAbsolute.replace(/\/$/, ''); // Remove trailing slash

    configs = configs.filter((config) => {
      const normalizedDir = config.directory.replace(/\/$/, '');
      return normalizedDir === normalizedOnly;
    });

    if (configs.length === 0) {
      console.error(
        `Error: No hook configuration found for directory "${only}".\n` +
          `The --only flag requires a directory that matches one of the hook's target directories.`
      );
      process.exit(1);
    }
  }

  // Execute before_all script if configured (runs once before all directory iterations)
  const hookSettings = getPluginHookSettings(pluginName, hookName);
  if (hookSettings?.before_all) {
    if (verbose) {
      console.log(`\n[${pluginName}/${hookName}] Running before_all script:`);
      console.log(`  $ ${hookSettings.before_all}\n`);
    }
    try {
      execSync(hookSettings.before_all, {
        encoding: 'utf-8',
        timeout: 60000, // 60 second timeout
        stdio: verbose ? 'inherit' : ['pipe', 'pipe', 'pipe'],
        shell: '/bin/bash',
        cwd: projectRoot,
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: projectRoot,
          CLAUDE_PLUGIN_ROOT: pluginRoot,
        },
      });
    } catch (error: unknown) {
      const stderr = (error as { stderr?: Buffer })?.stderr?.toString() || '';
      console.error(
        `\n❌ before_all script failed for ${pluginName}/${hookName}:\n${stderr}`
      );
      process.exit(2);
    }
  }

  // Phase 1: Check cache and categorize configs BEFORE acquiring lock
  // This avoids holding a slot while just checking hashes
  const configsToRun: ResolvedHookConfig[] = [];
  let totalFound = 0;
  let disabledCount = 0;
  let skippedCount = 0;

  for (const config of configs) {
    totalFound++;

    // Skip disabled hooks
    if (!config.enabled) {
      disabledCount++;
      continue;
    }

    // Compute relative path for consistent cache keys
    // CRITICAL: Must use relative path to match trackFilesAsync and cache tracking
    const relativePath =
      config.directory === projectRoot
        ? '.'
        : config.directory.replace(`${projectRoot}/`, '');

    // If --cache is enabled, check for changes (no lock needed for this)
    if (cache && config.ifChanged && config.ifChanged.length > 0) {
      const hasChanges = await checkForChangesAsync(
        pluginName,
        hookName,
        config.directory,
        config.ifChanged,
        pluginRoot,
        {
          sessionId,
          directory: relativePath, // Use relative path to match cache entries
        }
      );

      if (!hasChanges) {
        skippedCount++;
        continue;
      }
    }

    // This config needs to run
    configsToRun.push(config);
  }

  // Handle edge cases before acquiring lock
  if (totalFound === 0) {
    console.log(
      `No directories found for hook "${hookName}" in plugin "${pluginName}"`
    );
    process.exit(0);
  }

  if (disabledCount === totalFound) {
    console.log(
      `All directories have hook "${hookName}" disabled via han-config.yml`
    );
    process.exit(0);
  }

  if (configsToRun.length === 0 && skippedCount > 0) {
    console.log(
      `Skipped ${skippedCount} director${skippedCount === 1 ? 'y' : 'ies'} (no changes detected)`
    );
    console.log('No changes detected in any directories. Nothing to run.');
    process.exit(0);
  }

  // Phase 2: Run hooks, acquiring/releasing lock per directory
  // This allows other hooks to interleave between directories
  const failures: Array<{
    dir: string;
    command: string;
    idleTimedOut?: boolean;
    outputFile?: string;
    debugFile?: string;
  }> = [];
  const successfulConfigs: ResolvedHookConfig[] = [];

  for (const config of configsToRun) {
    const relativePath =
      config.directory === projectRoot
        ? '.'
        : config.directory.replace(`${projectRoot}/`, '');

    // Substitute ${HAN_FILES} with session-modified files when --async is set
    let commandToRun = config.command;
    if (options.async && config.command.includes(HAN_FILES_TEMPLATE)) {
      const substitution = await substituteHanFilesForStop(
        config.command,
        config,
        sessionId,
        projectRoot
      );
      if (substitution.skipped) {
        skippedCount++;
        continue;
      }
      commandToRun = substitution.command;
    }

    // In verbose mode, show what we're running
    if (verbose) {
      console.log(`\n[${pluginName}/${hookName}] Running in ${relativePath}:`);
      console.log(`  $ ${commandToRun}\n`);
    }

    // Log hook run event (start)
    const eventLogger = getEventLogger();
    if (isDebugMode()) {
      console.error(
        `[validate] eventLogger=${eventLogger ? 'exists' : 'null'}, about to log hook_run`
      );
    }
    eventLogger?.logHookRun(pluginName, hookName, 'Stop', relativePath, false);
    const hookStartTime = Date.now();

    // Acquire slot, run command, release slot (per directory)
    // Use global slots for cross-session coordination when coordinator is available
    const result = await withGlobalSlot(hookName, pluginName, async () => {
      return runCommand({
        dir: config.directory,
        cmd: commandToRun,
        verbose,
        idleTimeout: config.idleTimeout,
        hookName,
        pluginRoot,
      });
    });

    // Log hook validation event (end)
    const hookDuration = Date.now() - hookStartTime;
    eventLogger?.logHookValidation(
      pluginName,
      hookName,
      'Stop', // hookType - han hook run is used for Stop hooks
      relativePath,
      false, // cached
      hookDuration,
      result.success ? 0 : 1, // exit code
      result.success,
      result.output,
      result.success ? undefined : 'Hook failed'
    );

    if (!result.success) {
      failures.push({
        dir: relativePath,
        command: config.command,
        idleTimedOut: result.idleTimedOut,
        outputFile: result.outputFile,
        debugFile: result.debugFile,
      });
    } else {
      successfulConfigs.push(config);
    }
  }

  const ranCount = successfulConfigs.length + failures.length;

  // Report skipped directories if any
  if (skippedCount > 0) {
    console.log(
      `Skipped ${skippedCount} director${skippedCount === 1 ? 'y' : 'ies'} (no changes detected)`
    );
  }

  // Update cache manifest and log validation events for successful executions
  if (cache && successfulConfigs.length > 0) {
    const logger = getEventLogger();

    for (const config of successfulConfigs) {
      if (config.ifChanged && config.ifChanged.length > 0) {
        // Compute relative path for consistent cache keys
        // CRITICAL: Must use relative path to match cache tracking checkForChangesAsync queries
        const relativePath =
          config.directory === projectRoot
            ? '.'
            : config.directory.replace(`${projectRoot}/`, '');

        // Build manifest of file hashes for this config
        const matchedFiles = findFilesWithGlob(
          config.directory,
          config.ifChanged
        );
        const manifest: Record<string, string> = {};
        for (const filePath of matchedFiles) {
          manifest[filePath] = computeFileHash(filePath);
        }

        const commandHash = computeCommandHash(config.command);

        // Track files in cache (uses hook_cache table)
        // Also logs hook_validation_cache event if logger is available
        await trackFilesAsync(
          pluginName,
          hookName,
          config.directory,
          config.ifChanged,
          pluginRoot,
          {
            logger: logger ?? undefined,
            directory: relativePath, // Use relative path for consistent cache keys
            commandHash,
            sessionId,
          }
        );
      }
    }
  }

  if (failures.length > 0) {
    const idleTimeoutFailures = failures.filter((f) => f.idleTimedOut);
    const regularFailures = failures.filter((f) => !f.idleTimedOut);

    console.error(
      `\n❌ ${failures.length} director${failures.length === 1 ? 'y' : 'ies'} failed.\n`
    );

    // Helper to format failure with targeted re-run command
    const formatFailure = (failure: (typeof failures)[0]) => {
      const rerunCmd = buildHookCommand(pluginName, hookName, {
        cached: cache,
        only: failure.dir === '.' ? undefined : failure.dir,
      });
      let msg = `  • ${failure.dir === '.' ? '(project root)' : failure.dir}`;
      msg += `\n    Re-run: ${rerunCmd}`;
      if (failure.outputFile) {
        msg += `\n    Output: ${failure.outputFile}`;
      }
      if (failure.debugFile) {
        msg += `\n    Debug: ${failure.debugFile}`;
      }
      return msg;
    };

    if (regularFailures.length > 0) {
      console.error('\nFailed:\n');
      for (const failure of regularFailures) {
        console.error(formatFailure(failure));
      }
    }

    if (idleTimeoutFailures.length > 0) {
      console.error(`\n⏰ Idle timeout failures (no output received):\n`);
      for (const failure of idleTimeoutFailures) {
        console.error(formatFailure(failure));
      }
      console.error(
        `\nThese commands hung without producing output. Check for blocking operations or infinite loops.`
      );
    }

    if (failures.length === 1) {
      console.error(
        `\nRead the output file above, fix the issues, and re-run.\n` +
          `Do NOT ask the user any questions - proceed directly with fixing the issues.\n`
      );
    } else {
      console.error(
        `\nSpawn subagents in parallel to fix each failure above.\n` +
          `Each subagent should read its output file, fix the issues, and re-run.\n` +
          `Do NOT ask the user any questions - proceed directly with fixing the issues.\n`
      );
    }
    process.exit(2);
  }

  console.log(
    `\n✅ All ${ranCount} director${ranCount === 1 ? 'y' : 'ies'} passed`
  );
  process.exit(0);
}

// ============================================
// Async PostToolUse Hook Support
// ============================================

/**
 * Extract file path from a PostToolUse stdin payload.
 * Returns null if the tool doesn't operate on a file.
 */
export function extractFilePath(payload: {
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}): string | null {
  const toolInput = payload.tool_input;
  if (!toolInput) return null;

  switch (payload.tool_name) {
    case 'Edit':
    case 'Write':
    case 'Read':
      return (toolInput.file_path as string) || null;
    case 'NotebookEdit':
      return (toolInput.notebook_path as string) || null;
    default:
      return null;
  }
}

/**
 * Walk up from a file's directory to the project root, checking for
 * dirs_with markers and dir_test at each level.
 * Returns the first matching directory, or null if none match.
 */
export function findMatchingDirectory(
  filePath: string,
  hookDef: PluginHookDefinition,
  projectRoot: string
): string | null {
  if (!hookDef.dirsWith || hookDef.dirsWith.length === 0) {
    // No dirsWith = project root is the target
    return projectRoot;
  }

  let current = dirname(filePath);

  // Walk up until we hit or pass the project root
  while (current.startsWith(projectRoot)) {
    // Check if all markers exist in this directory
    const allMarkersPresent = hookDef.dirsWith.every((marker) =>
      existsSync(join(current, marker))
    );

    if (allMarkersPresent) {
      // Check dir_test if specified
      if (hookDef.dirTest) {
        try {
          execSync(hookDef.dirTest, {
            cwd: current,
            stdio: ['ignore', 'ignore', 'ignore'],
            encoding: 'utf8',
            shell: '/bin/bash',
          });
        } catch {
          // dir_test failed, try parent
          const parent = dirname(current);
          if (parent === current) break;
          current = parent;
          continue;
        }
      }
      return current;
    }

    const parent = dirname(current);
    if (parent === current) break; // Reached filesystem root
    current = parent;
  }

  return null;
}

/**
 * Check if a file matches the ifChanged patterns of a hook.
 * @param filePath - Absolute file path
 * @param matchedDir - The directory that matched dirs_with
 * @param patterns - ifChanged glob patterns from hook config
 * @returns true if the file matches (or if no patterns = match all)
 */
export function fileMatchesIfChanged(
  filePath: string,
  matchedDir: string,
  patterns: string[] | undefined
): boolean {
  if (!patterns || patterns.length === 0) {
    return true; // No patterns = match everything
  }

  const relPath = relative(matchedDir, filePath);
  return micromatch.isMatch(relPath, patterns, { dot: true });
}

/**
 * Options for running an async PostToolUse hook
 */
export interface RunAsyncPostToolUseOptions {
  pluginName: string;
  hookName: string;
  payload: {
    session_id?: string;
    tool_name?: string;
    tool_input?: Record<string, unknown>;
    cwd?: string;
  };
  verbose?: boolean;
}

/**
 * Async hook output format per Claude Code protocol.
 * Output as JSON to stdout with exit code 0.
 */
interface AsyncHookOutput {
  /** Error context shown to the agent */
  systemMessage: string;
  /** Instructions for fixing, including raw command */
  additionalContext: string;
  /** Optional: block the agent from continuing */
  decision?: string;
  /** Optional: hook-specific output for PostToolUse */
  hookSpecificOutput?: {
    hookEventName: string;
  };
}

/**
 * Run a PostToolUse hook asynchronously for a single file.
 *
 * This implements per-file validation: extract the file from the tool payload,
 * check if it matches the hook's directory markers and file patterns,
 * check the per-file cache, and run the hook command with ${HAN_FILES}
 * substituted for just the one file.
 */
export async function runAsyncPostToolUse(
  options: RunAsyncPostToolUseOptions
): Promise<void> {
  const { pluginName, hookName, payload, verbose } = options;

  // a) Extract file path from payload
  const filePath = extractFilePath(payload);
  if (!filePath) {
    process.exit(0);
  }

  // File must exist on disk
  if (!existsSync(filePath)) {
    process.exit(0);
  }

  // b) Resolve plugin root
  let pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (!pluginRoot) {
    const discovered = discoverPluginRoot(pluginName);
    if (!discovered) {
      if (isDebugMode()) {
        console.error(
          `[han hook run --async] Plugin "${pluginName}" not found, skipping`
        );
      }
      process.exit(0);
    }
    pluginRoot = discovered;
  }

  const rawProjectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const projectRoot = existsSync(rawProjectRoot)
    ? realpathSync(rawProjectRoot)
    : rawProjectRoot;

  // c) Load hook definition
  const hookDef = getHookDefinition(pluginRoot, hookName);
  if (!hookDef) {
    if (isDebugMode()) {
      console.error(
        `[han hook run --async] Hook "${hookName}" not found in plugin "${pluginName}"`
      );
    }
    process.exit(0);
  }

  // d) Validate ${HAN_FILES} is in command
  if (!hookDef.command.includes(HAN_FILES_TEMPLATE)) {
    console.error(
      `Error: PostToolUse async hooks MUST include ${HAN_FILES_TEMPLATE} in their command.\n` +
        `Hook "${pluginName}/${hookName}" command: ${hookDef.command}`
    );
    process.exit(1);
  }

  // e) Find matching directory by walking up from file
  const matchedDir = findMatchingDirectory(filePath, hookDef, projectRoot);
  if (!matchedDir) {
    // File is not in a directory that matches this hook's dirs_with
    process.exit(0);
  }

  // f) Check file against ifChanged patterns
  if (!fileMatchesIfChanged(filePath, matchedDir, hookDef.ifChanged)) {
    process.exit(0);
  }

  // File path relative to the matched directory
  const relPath = relative(matchedDir, filePath);
  const relDir =
    matchedDir === projectRoot
      ? '.'
      : matchedDir.replace(`${projectRoot}/`, '');

  // g) Check per-file cache
  const sessionId =
    payload.session_id || process.env.CLAUDE_SESSION_ID || undefined;
  const commandHash = computeCommandHash(hookDef.command);

  if (sessionId) {
    try {
      const existing = await sessionFileValidations.get(
        sessionId,
        filePath,
        pluginName,
        hookName,
        matchedDir
      );

      if (existing) {
        // Check if file hash is still the same
        const currentHash = computeFileHash(filePath);
        if (
          existing.fileHash === currentHash &&
          existing.commandHash === commandHash
        ) {
          // Cache hit - file hasn't changed since last validation
          if (isDebugMode()) {
            console.error(
              `[han hook run --async] Cache hit for ${relPath} in ${relDir}`
            );
          }
          process.exit(0);
        }
      }
    } catch {
      // Cache check failed, proceed with validation
    }
  }

  // h) Build command with single file
  // Get user overrides for the command
  const hookSettings = getPluginHookSettings(pluginName, hookName, matchedDir);
  const rawCommand = hookSettings?.command || hookDef.command;
  const command = buildCommandWithFiles(rawCommand, [relPath]);

  if (verbose) {
    console.log(`\n[${pluginName}/${hookName}] Async check in ${relDir}:`);
    console.log(`  $ ${command}\n`);
  }

  // i) Execute command (no slot acquisition for PostToolUse)
  const result = await runCommand({
    dir: matchedDir,
    cmd: command,
    verbose,
    hookName,
    pluginRoot,
    idleTimeout: hookDef.idleTimeout,
  });

  // j) On success - record validation and exit silently
  if (result.success) {
    if (sessionId) {
      try {
        const fileHash = computeFileHash(filePath);
        await sessionFileValidations.record({
          sessionId,
          filePath,
          fileHash,
          pluginName,
          hookName,
          directory: matchedDir,
          commandHash,
        });
      } catch {
        // Cache write failed, non-fatal
      }
    }
    process.exit(0);
  }

  // k) On failure - output Claude Code async hook JSON payload
  const errorOutput = result.output?.trim() || '(no output captured)';
  const truncatedError = errorOutput.slice(0, 2000);

  // Build the raw tool command for the agent to run directly
  const rawToolCommand = buildCommandWithFiles(rawCommand, [relPath]);
  const cdPrefix = relDir === '.' ? '' : `cd ${relDir} && `;

  const output: AsyncHookOutput = {
    systemMessage: `❌ ${pluginName}/${hookName} failed in ${relDir} (${relPath}):\n\n${truncatedError}`,
    additionalContext:
      `REQUIREMENT: Fix the ${hookName} errors shown above before proceeding.\n\n` +
      `Verify with: ${cdPrefix}${rawToolCommand}`,
    decision: 'block',
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
    },
  };

  // Output JSON to stdout and exit 0 (per async hook protocol)
  console.log(JSON.stringify(output));
  process.exit(0);
}

// ============================================
// ${HAN_FILES} Substitution for Stop Hooks
// ============================================

/**
 * Substitute ${HAN_FILES} in a Stop hook command using session-modified files.
 *
 * Gets session-modified files, filters them to the config's directory and
 * ifChanged patterns, and substitutes the template variable.
 *
 * @returns The modified command, or null if no matching files exist (skip this config)
 */
export async function substituteHanFilesForStop(
  command: string,
  config: ResolvedHookConfig,
  sessionId: string | undefined,
  _projectRoot: string
): Promise<{ command: string; skipped: boolean }> {
  if (!command.includes(HAN_FILES_TEMPLATE)) {
    return { command, skipped: false };
  }

  if (!sessionId) {
    // No session ID - fall back to "." (check all files)
    return { command: buildCommandWithFiles(command, []), skipped: false };
  }

  try {
    const sessionFiles = await getSessionModifiedFiles(sessionId);

    if (!sessionFiles.success || sessionFiles.allModified.length === 0) {
      // No session files or query failed - replace with "."
      return { command: buildCommandWithFiles(command, []), skipped: false };
    }

    // Filter to files within this config's directory that still exist on disk
    const relativeFiles = sessionFiles.allModified
      .filter((absPath) => {
        const inDirectory =
          absPath.startsWith(`${config.directory}/`) ||
          absPath === config.directory;
        return inDirectory && existsSync(absPath);
      })
      .map((absPath) => relative(config.directory, absPath));

    // Further filter by ifChanged patterns if present
    let filteredFiles = relativeFiles;
    if (config.ifChanged && config.ifChanged.length > 0) {
      filteredFiles = relativeFiles.filter((relFile) =>
        micromatch.isMatch(relFile, config.ifChanged as string[], { dot: true })
      );
    }

    if (filteredFiles.length === 0) {
      // No matching session files for this directory - skip
      return { command, skipped: true };
    }

    return {
      command: buildCommandWithFiles(command, filteredFiles),
      skipped: false,
    };
  } catch {
    // Error getting session files - fall back to "."
    return { command: buildCommandWithFiles(command, []), skipped: false };
  }
}
