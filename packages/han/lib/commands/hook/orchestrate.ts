import { execSync, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import type { Command } from 'commander';
import {
  getClaudeConfigDir,
  getMergedPluginsAndMarketplaces,
  getProjectDir,
} from '../../config/claude-settings.ts';
import {
  getHanBinary as getConfiguredHanBinary,
  getPluginHookSettings,
} from '../../config/han-settings.ts';
import {
  getSessionModifiedFiles,
  hookAttempts,
  messages,
} from '../../db/index.ts';
import {
  getEventLogger,
  getOrCreateEventLogger,
  initEventLogger,
} from '../../events/logger.ts';
import { HashCycleDetector } from '../../hooks/hash-cycle-detector.ts';
import {
  buildCommandWithFiles,
  checkForChangesAsync,
  findDirectoriesWithMarkers,
  getPluginDir,
  type HookCategory,
  hookMatchesEvent,
  inferCategoryFromHookName,
  loadPluginConfig,
  PHASE_ORDER,
  type PluginHookDefinition,
  trackFilesAsync,
} from '../../hooks/index.ts';
import { acquireGlobalSlot } from '../../hooks/slot-client.ts';
import { isDebugMode } from '../../shared.ts';

/**
 * Get the han binary invocation string.
 * Priority:
 * 1. hanBinary from config (han.yml) - allows development overrides
 * 2. "han" from PATH (default)
 *
 * Note: We don't use process.argv[1] directly because compiled Bun binaries
 * have paths like "/$bunfs/root/han-darwin-arm64" which contain shell variables
 * that get incorrectly expanded when run via bash.
 */
function getHanBinary(): string {
  // Use the configured hanBinary if available (respects han.yml settings)
  const configured = getConfiguredHanBinary();
  if (configured && configured !== 'han') {
    return configured;
  }

  // Fallback to 'han' from PATH
  return 'han';
}

/**
 * Replace 'han ' prefix in commands with the actual binary invocation.
 * This ensures inner han commands use the same version as the orchestrator.
 */
function resolveHanCommand(command: string): string {
  const hanBinary = getHanBinary();
  // Replace 'han ' at the start of the command
  if (command.startsWith('han ')) {
    return hanBinary + command.slice(3);
  }
  return command;
}

/**
 * Result of running a command with timeout
 */
interface CommandWithTimeoutResult {
  completed: boolean;
  success: boolean;
  output: string;
  error: string;
  exitCode: number;
  duration: number;
}

/**
 * Run a command synchronously and wait for it to complete.
 * Logs output in real-time to stderr for immediate visibility.
 *
 * @param command - The shell command to run
 * @param cwd - Working directory
 * @param env - Environment variables
 * @param payloadJson - JSON payload to pass via stdin
 * @returns Result with success/failure status
 */
async function runCommandSync(
  command: string,
  cwd: string,
  env: Record<string, string | undefined>,
  payloadJson: string
): Promise<CommandWithTimeoutResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn('/bin/bash', ['-c', command], {
      cwd,
      env: { ...process.env, ...env },
    });

    // Write payload to stdin
    proc.stdin.write(payloadJson);
    proc.stdin.end();

    // Stream output to stderr in real-time for visibility
    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stderr.write(text);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    proc.on('close', (code) => {
      resolve({
        completed: true,
        success: code === 0,
        output: stdout,
        error: stderr,
        exitCode: code ?? 1,
        duration: Date.now() - startTime,
      });
    });

    proc.on('error', (err) => {
      resolve({
        completed: true,
        success: false,
        output: stdout,
        error: err.message,
        exitCode: 1,
        duration: Date.now() - startTime,
      });
    });
  });
}

/**
 * Run a command with a timeout. If the command doesn't complete within the timeout,
 * returns { completed: false } so the caller can defer to background execution.
 *
 * @deprecated This function is no longer used. Wait mode now uses runCommandSync for fully synchronous execution.
 * @param command - The shell command to run
 * @param cwd - Working directory
 * @param env - Environment variables
 * @param payloadJson - JSON payload to pass via stdin
 * @param timeoutMs - Maximum time to wait before returning (default: 5000ms)
 * @returns Result with completed flag indicating if finished within timeout
 */
async function _runCommandWithTimeout(
  command: string,
  cwd: string,
  env: Record<string, string | undefined>,
  payloadJson: string,
  timeoutMs = 5000
): Promise<CommandWithTimeoutResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let resolved = false;

    const proc = spawn('/bin/bash', ['-c', command], {
      cwd,
      env: { ...process.env, ...env },
    });

    // Write payload to stdin
    proc.stdin.write(payloadJson);
    proc.stdin.end();

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Set up timeout
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        // Don't kill the process - it will continue running
        // The coordinator will pick it up via pendingHooks
        resolve({
          completed: false,
          success: false,
          output: stdout,
          error: 'timeout - deferred to background',
          exitCode: -1,
          duration: Date.now() - startTime,
        });
      }
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (!resolved) {
        resolved = true;
        resolve({
          completed: true,
          success: code === 0,
          output: stdout,
          error: stderr,
          exitCode: code ?? 1,
          duration: Date.now() - startTime,
        });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      if (!resolved) {
        resolved = true;
        resolve({
          completed: true,
          success: false,
          output: stdout,
          error: err.message,
          exitCode: 1,
          duration: Date.now() - startTime,
        });
      }
    });
  });
}

/**
 * ANSI color codes for CLI output
 */
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  bold: '\x1b[1m',
  magenta: '\x1b[35m',
};

/**
 * Result of coordinator health verification
 */
interface CoordinatorHealthResult {
  healthy: boolean;
  degraded: boolean;
  reason?: string;
}

/**
 * Verify coordinator health for cache operations
 * Returns degraded=true if coordinator is not fully operational
 */
async function verifyCoordinatorHealth(
  _sessionId: string,
  _projectRoot: string
): Promise<CoordinatorHealthResult> {
  const HEALTH_CHECK_TIMEOUT_MS = 5000;

  try {
    // Try to check coordinator health via HTTP
    const { checkHealth } = await import('../coordinator/health.ts');
    const health = await checkHealth();

    if (health?.status === 'ok') {
      return { healthy: true, degraded: false };
    }

    // Coordinator not responding - try to start it
    try {
      const { ensureCoordinator } = await import('../coordinator/daemon.ts');
      const startPromise = ensureCoordinator();

      // Wait up to 5s for coordinator to start
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), HEALTH_CHECK_TIMEOUT_MS)
      );

      const result = await Promise.race([startPromise, timeoutPromise]);

      if (result?.running) {
        return { healthy: true, degraded: false };
      }
    } catch (startError) {
      if (isDebugMode()) {
        console.error(
          `${colors.dim}[verifyCoordinatorHealth]${colors.reset} Failed to start coordinator:`,
          startError
        );
      }
    }

    // Coordinator not available - mark as degraded
    return {
      healthy: false,
      degraded: true,
      reason: 'Coordinator not responding - cache may be stale',
    };
  } catch (error) {
    if (isDebugMode()) {
      console.error(
        `${colors.dim}[verifyCoordinatorHealth]${colors.reset} Health check error:`,
        error
      );
    }
    return {
      healthy: false,
      degraded: true,
      reason: 'Unable to verify coordinator health',
    };
  }
}

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

/**
 * Get the log file path for an orchestration
 */
function getOrchestrationLogPath(orchestrationId: string): string {
  const configDir =
    getClaudeConfigDir() || join(process.env.HOME || '', '.claude');
  const logsDir = join(configDir, 'han', 'logs');
  mkdirSync(logsDir, { recursive: true });
  return join(logsDir, `${orchestrationId}.log`);
}

/**
 * Initialize orchestration log file
 */
function initOrchestrationLog(
  orchestrationId: string,
  eventType: string,
  projectRoot: string
): string {
  const logPath = getOrchestrationLogPath(orchestrationId);
  const header = `Han Hook Orchestration Log
========================
Orchestration ID: ${orchestrationId}
Event Type: ${eventType}
Project Root: ${projectRoot}
Started: ${new Date().toISOString()}

`;
  writeFileSync(logPath, header);
  return logPath;
}

/**
 * Append to orchestration log file
 */
function appendToOrchestrationLog(logPath: string, content: string): void {
  appendFileSync(logPath, content);
}

/**
 * Hook payload structure from Claude Code stdin
 * These are the common fields that Claude Code sends with hook invocations.
 */
interface HookPayload {
  // Common fields (always present from Claude Code)
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  permission_mode?: string;

  // Event-specific fields
  hook_event_name?: string;
  agent_id?: string;
  agent_type?: string;
  tool_name?: string;

  // Stop hook specific - indicates this is a retry after a previous stop hook failure
  // When true, we track consecutive failures for attempt tracking
  stop_hook_active?: boolean;
}

/**
 * Get the active session ID for the current project from the database.
 * This is used when hooks run without stdin payload (e.g., Stop hook).
 */
function getActiveSessionId(projectRoot: string): string | null {
  try {
    const { getActiveSessionForProject } = require('../../db/index.ts');
    const session = getActiveSessionForProject(projectRoot);
    if (isDebugMode()) {
      console.error(
        `${colors.dim}[orchestrate]${colors.reset} getActiveSessionId: projectRoot=${projectRoot}, session=${session?.id || 'null'}`
      );
    }
    return session?.id || null;
  } catch (error) {
    console.error(
      `${colors.dim}[orchestrate]${colors.reset} Failed to get active session: ${error}`
    );
    return null;
  }
}

/**
 * Generate a CLI payload when running orchestrate directly from command line.
 * This mimics the payload structure that Claude Code would send.
 */
function generateCliPayload(
  eventType: string,
  projectRoot: string
): HookPayload {
  // Use current session ID from multiple sources (in order of preference):
  // 1. HAN_SESSION_ID - explicit override from hook dispatch
  // 2. CLAUDE_SESSION_ID - may be set by Claude Code environment
  // 3. Active session from database - lookup current active session for this project
  // 4. Generate new CLI session ID - fallback for standalone CLI usage
  const sessionId =
    process.env.HAN_SESSION_ID ||
    process.env.CLAUDE_SESSION_ID ||
    getActiveSessionId(projectRoot) ||
    `cli-${randomUUID()}`;

  if (isDebugMode()) {
    console.error(
      `${colors.dim}[generateCliPayload]${colors.reset} sessionId=${sessionId} (source: ${process.env.HAN_SESSION_ID ? 'HAN_SESSION_ID' : process.env.CLAUDE_SESSION_ID ? 'CLAUDE_SESSION_ID' : 'db/generated'})`
    );
  }

  return {
    session_id: sessionId,
    transcript_path: '', // No transcript in CLI mode
    cwd: projectRoot,
    permission_mode: 'default',
    hook_event_name: eventType,
  };
}

/**
 * A discovered hook task ready for execution
 */
interface HookTask {
  plugin: string;
  pluginRoot: string;
  hookName: string;
  hookDef: PluginHookDefinition;
  directories: string[];
  dependsOn: Array<{ plugin: string; hook: string; optional?: boolean }>;
}

/**
 * Result of executing a hook in a directory
 */
interface HookResult {
  plugin: string;
  hook: string;
  directory: string;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
  skipped?: boolean;
  skipReason?: string;
  /** Hook was deferred to background execution */
  deferred?: boolean;
}

/**
 * Read stdin payload from Claude Code.
 * Handles various stdin types: files, FIFOs, pipes, and sockets.
 *
 * IMPORTANT: Anonymous pipes (how Claude Code passes stdin) don't match
 * isFile/isFIFO/isSocket checks. We must try reading any non-TTY stdin.
 */
function readStdinPayload(): HookPayload | null {
  try {
    // TTY means interactive terminal - no piped input
    if (process.stdin.isTTY) {
      return null;
    }

    // Try to read stdin directly - don't check stat types because
    // anonymous pipes (from Claude Code) don't match isFile/isFIFO/isSocket
    const stdin = readFileSync(0, 'utf-8');
    if (stdin.trim()) {
      return JSON.parse(stdin) as HookPayload;
    }
  } catch {
    // stdin not available or empty
  }
  return null;
}

/**
 * Discover all hook tasks for a given event type
 */
function discoverHookTasks(
  eventType: string,
  payload: HookPayload | null,
  projectRoot: string,
  toolName?: string
): HookTask[] {
  const tasks: HookTask[] = [];
  const { plugins, marketplaces } = getMergedPluginsAndMarketplaces();

  for (const [pluginName, marketplace] of plugins.entries()) {
    const marketplaceConfig = marketplaces.get(marketplace);
    const pluginRoot = getPluginDir(pluginName, marketplace, marketplaceConfig);

    if (!pluginRoot) continue;

    const config = loadPluginConfig(pluginRoot, false);
    if (!config?.hooks) continue;

    for (const [hookName, hookDef] of Object.entries(config.hooks)) {
      // Check if this hook responds to this event type
      if (!hookMatchesEvent(hookDef, eventType)) {
        continue;
      }

      // For PreToolUse/PostToolUse, check tool filter from payload
      if (
        (eventType === 'PreToolUse' || eventType === 'PostToolUse') &&
        hookDef.toolFilter &&
        hookDef.toolFilter.length > 0
      ) {
        const payloadToolName = payload?.tool_name;
        if (!payloadToolName || !hookDef.toolFilter.includes(payloadToolName)) {
          continue;
        }
      }

      // For SubagentPrompt, check tool filter if toolName is provided
      if (
        eventType === 'SubagentPrompt' &&
        hookDef.toolFilter &&
        hookDef.toolFilter.length > 0 &&
        toolName
      ) {
        if (!hookDef.toolFilter.includes(toolName)) {
          continue;
        }
      }

      // Find directories for this hook
      let directories: string[];
      if (!hookDef.dirsWith || hookDef.dirsWith.length === 0) {
        directories = [projectRoot];
      } else {
        directories = findDirectoriesWithMarkers(projectRoot, hookDef.dirsWith);

        // Apply dirTest filter if specified
        const dirTestCmd = hookDef.dirTest;
        if (dirTestCmd) {
          directories = directories.filter((dir) => {
            try {
              execSync(dirTestCmd, {
                cwd: dir,
                stdio: ['ignore', 'ignore', 'ignore'],
                encoding: 'utf8',
                shell: '/bin/sh',
              });
              return true;
            } catch {
              return false;
            }
          });
        }
      }

      if (directories.length === 0) continue;

      tasks.push({
        plugin: pluginName,
        pluginRoot,
        hookName,
        hookDef,
        directories,
        dependsOn: hookDef.dependsOn || [],
      });
    }
  }

  return tasks;
}

/**
 * Topological sort of hook tasks based on dependencies
 * Returns batches that can be executed in parallel
 */
function resolveDependencies(tasks: HookTask[]): HookTask[][] {
  const taskMap = new Map<string, HookTask>();
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  // Build task lookup and initialize in-degrees
  for (const task of tasks) {
    const key = `${task.plugin}/${task.hookName}`;
    taskMap.set(key, task);
    inDegree.set(key, 0);
    graph.set(key, []);
  }

  // Build dependency graph
  for (const task of tasks) {
    const key = `${task.plugin}/${task.hookName}`;
    for (const dep of task.dependsOn) {
      // Handle wildcard dependencies: { plugin: "*", hook: "*" }
      if (dep.plugin === '*' || dep.hook === '*') {
        // Match all tasks except self AND except other wildcard tasks
        // (to avoid circular dependencies between advisory hooks)
        for (const [depKey, depTask] of taskMap.entries()) {
          if (depKey === key) continue; // Don't depend on self

          // Skip other tasks that also have wildcard dependencies
          // This prevents cycles like: A depends on *, B depends on * → A↔B cycle
          const depTaskHasWildcard = depTask.dependsOn.some(
            (d) => d.plugin === '*' || d.hook === '*'
          );
          if (depTaskHasWildcard) continue;

          // Check if pattern matches
          const matches =
            (dep.plugin === '*' || depTask.plugin === dep.plugin) &&
            (dep.hook === '*' || depTask.hookName === dep.hook);

          if (matches) {
            // Wildcard dependencies are implicitly optional
            if (!taskMap.has(depKey)) continue;
            // Add edge: depTask -> task (depTask must run before task)
            const edges = graph.get(depKey) || [];
            edges.push(key);
            graph.set(depKey, edges);

            // Increment in-degree
            inDegree.set(key, (inDegree.get(key) || 0) + 1);
          }
        }
        continue;
      }

      // Regular dependency (no wildcard)
      const depKey = `${dep.plugin}/${dep.hook}`;

      // Check if dependency exists
      if (!taskMap.has(depKey)) {
        if (dep.optional) {
          continue; // Skip optional missing dependencies
        }
        console.error(
          `Error: Hook ${key} depends on ${depKey}, but it's not available for this event type.`
        );
        continue;
      }

      // Add edge: dep -> task (dep must run before task)
      const edges = graph.get(depKey) || [];
      edges.push(key);
      graph.set(depKey, edges);

      // Increment in-degree
      inDegree.set(key, (inDegree.get(key) || 0) + 1);
    }
  }

  // Kahn's algorithm for topological sort into batches
  const batches: HookTask[][] = [];
  const remaining = new Set(taskMap.keys());

  while (remaining.size > 0) {
    // Find all tasks with no remaining dependencies
    const batch: HookTask[] = [];
    const toRemove: string[] = [];

    for (const key of remaining) {
      if ((inDegree.get(key) || 0) === 0) {
        const task = taskMap.get(key);
        if (task) {
          batch.push(task);
          toRemove.push(key);
        }
      }
    }

    if (batch.length === 0) {
      // Circular dependency detected
      console.error('Error: Circular dependency detected in hooks:');
      for (const key of remaining) {
        console.error(`  - ${key}`);
      }
      break;
    }

    batches.push(batch);

    // Remove processed tasks and update in-degrees
    for (const key of toRemove) {
      remaining.delete(key);
      for (const dependent of graph.get(key) || []) {
        inDegree.set(dependent, (inDegree.get(dependent) || 0) - 1);
      }
    }
  }

  return batches;
}

/**
 * Check if a hook has wildcard dependencies (depends_on: [{plugin: "*", hook: "*"}])
 * Hooks with wildcard deps already handle their ordering explicitly.
 */
function hasWildcardDependencies(task: HookTask): boolean {
  return task.dependsOn.some((dep) => dep.plugin === '*' || dep.hook === '*');
}

/**
 * Inject implicit phase-based dependencies into tasks.
 * Hooks are executed in phase order: format → lint → typecheck → test → advisory.
 * All hooks in phase N must complete before phase N+1 starts.
 *
 * This adds implicit dependencies so that each task depends on ALL tasks in previous phases.
 * Explicit dependsOn relationships are preserved and take precedence.
 *
 * Category is inferred from the hook name (e.g., "lint" → lint, "format" → format).
 *
 * Note: Hooks with wildcard dependencies (plugin: "*" or hook: "*") are excluded from
 * phase injection to avoid circular dependencies.
 *
 * @param tasks - The hook tasks to process
 * @returns Tasks with injected phase dependencies
 */
function injectPhaseDependencies(tasks: HookTask[]): HookTask[] {
  // Separate tasks with wildcard dependencies - they manage their own ordering
  const tasksWithWildcard = tasks.filter(hasWildcardDependencies);
  const tasksWithoutWildcard = tasks.filter((t) => !hasWildcardDependencies(t));

  // Group non-wildcard tasks by phase index
  const tasksByPhase = new Map<number, HookTask[]>();

  for (const task of tasksWithoutWildcard) {
    // Infer category from hook name (e.g., "lint" → lint, "format" → format)
    const category: HookCategory = inferCategoryFromHookName(task.hookName);
    const phaseIndex = PHASE_ORDER.indexOf(category);
    // If category is invalid or not in PHASE_ORDER, default to lint (index 1)
    const phase = phaseIndex === -1 ? 1 : phaseIndex;

    if (!tasksByPhase.has(phase)) {
      tasksByPhase.set(phase, []);
    }
    tasksByPhase.get(phase)?.push(task);
  }

  // Add implicit dependencies to non-wildcard tasks
  const processedTasks = tasksWithoutWildcard.map((task) => {
    // Infer category from hook name
    const category: HookCategory = inferCategoryFromHookName(task.hookName);
    const myPhaseIndex = PHASE_ORDER.indexOf(category);
    const myPhase = myPhaseIndex === -1 ? 1 : myPhaseIndex;

    const implicitDeps: Array<{
      plugin: string;
      hook: string;
      optional: boolean;
    }> = [];

    // Add dependencies on all tasks in earlier phases
    for (let p = 0; p < myPhase; p++) {
      for (const prevTask of tasksByPhase.get(p) ?? []) {
        implicitDeps.push({
          plugin: prevTask.plugin,
          hook: prevTask.hookName,
          optional: true, // Phase dependencies are optional (don't fail if plugin not installed)
        });
      }
    }

    // Merge implicit dependencies with explicit ones
    // Explicit deps come after so they take precedence in deduplication
    return {
      ...task,
      dependsOn: [...implicitDeps, ...task.dependsOn],
    };
  });

  // Return all tasks (wildcard tasks unchanged, others with phase deps)
  return [...processedTasks, ...tasksWithWildcard];
}

/**
 * Execute a single hook in a directory
 */
async function executeHookInDirectory(
  task: HookTask,
  directory: string,
  projectRoot: string,
  payload: HookPayload,
  options: {
    onlyChanged: boolean;
    verbose: boolean;
    cliMode: boolean;
    sessionId: string;
    orchestrationId: string;
    hookType: string;
    isStopHook: boolean;
    logPath: string;
  }
): Promise<HookResult> {
  const startTime = Date.now();
  const relativePath =
    directory === projectRoot ? '.' : directory.replace(`${projectRoot}/`, '');

  // Helper for CLI mode verbose output (always logs to file, optionally to console)
  const cliLog = (message: string, color: keyof typeof colors = 'reset') => {
    const time = new Date().toLocaleTimeString();
    // Always log to file (without colors)
    appendToOrchestrationLog(options.logPath, `[${time}] ${message}\n`);
    // Log to console if in CLI mode
    if (options.cliMode) {
      console.error(
        `${colors.dim}[${time}]${colors.reset} ${colors[color]}${message}${colors.reset}`
      );
    }
  };

  // Helper to log detailed output to file only
  const logToFile = (content: string) => {
    appendToOrchestrationLog(options.logPath, content);
  };

  // Check user overrides for enabled state
  const hookSettings = getPluginHookSettings(
    task.plugin,
    task.hookName,
    directory
  );
  if (hookSettings?.enabled === false) {
    const duration = Date.now() - startTime;
    // Log skipped hook
    const logger = getOrCreateEventLogger();
    logger?.logHookResult(
      task.plugin,
      task.hookName,
      options.hookType,
      relativePath,
      false,
      duration,
      0,
      true,
      '[skipped: disabled by user config]',
      undefined, // error
      undefined, // hookRunId
      task.hookDef.ifChanged,
      task.hookDef.command
    );
    return {
      plugin: task.plugin,
      hook: task.hookName,
      directory: relativePath,
      success: true,
      skipped: true,
      skipReason: 'disabled by user config',
      duration,
    };
  }

  // Check cache if only checking changed files
  // Hooks without ifChanged patterns (like PreToolUse security checks) always run
  if (
    options.onlyChanged &&
    task.hookDef.ifChanged &&
    task.hookDef.ifChanged.length > 0
  ) {
    const hasChanges = await checkForChangesAsync(
      task.plugin,
      task.hookName,
      directory,
      task.hookDef.ifChanged,
      task.pluginRoot,
      {
        sessionId: options.sessionId,
        directory: relativePath,
      }
    );

    if (!hasChanges) {
      const duration = Date.now() - startTime;
      // Log cached skip
      const logger = getOrCreateEventLogger();
      logger?.logHookResult(
        task.plugin,
        task.hookName,
        options.hookType,
        relativePath,
        true, // cached
        duration,
        0,
        true,
        '[skipped: no changes detected]',
        undefined, // error
        undefined, // hookRunId
        task.hookDef.ifChanged,
        task.hookDef.command
      );
      return {
        plugin: task.plugin,
        hook: task.hookName,
        directory: relativePath,
        success: true,
        skipped: true,
        skipReason: 'no changes detected',
        duration,
      };
    }
  }

  // Get resolved command (with user overrides)
  // Also resolve 'han ' prefix to use the current binary for inner commands
  const rawCommand = hookSettings?.command || task.hookDef.command;
  let command = resolveHanCommand(rawCommand);

  // Substitute ${HAN_FILES} with session-modified files from coordinator
  // biome-ignore lint/suspicious/noTemplateCurlyInString: This is intentionally a literal string pattern, not a template
  if (command.includes('${HAN_FILES}')) {
    try {
      const sessionFiles = await getSessionModifiedFiles(options.sessionId);
      if (sessionFiles.success && sessionFiles.allModified.length > 0) {
        // Files from coordinator are already absolute paths
        // Filter to files in current directory and make relative
        const relativeFiles = sessionFiles.allModified
          .filter((absPath) => {
            return absPath.startsWith(`${directory}/`) || absPath === directory;
          })
          .map((absPath) => {
            // Make relative to execution directory
            return relative(directory, absPath);
          });

        command = buildCommandWithFiles(command, relativeFiles);
      } else {
        // No session files or query failed - replace with "." to check all files
        command = buildCommandWithFiles(command, []);
      }
    } catch {
      // Error getting session files - replace with "." to check all files
      command = buildCommandWithFiles(command, []);
    }
  }

  // For Stop hooks: acquire a slot and wait for it (no timeout)
  // Wait mode is fully synchronous - no background deferral
  let slotHandle: Awaited<ReturnType<typeof acquireGlobalSlot>> | null = null;
  if (options.isStopHook) {
    // Acquire slot and wait indefinitely
    slotHandle = await acquireGlobalSlot(
      options.sessionId,
      task.hookName,
      task.plugin,
      0 // No timeout - wait indefinitely
    );
  }

  // Log hook_run event and capture UUID for correlation with result
  // Include ifChanged patterns and command to enable per-file validation tracking
  const logger = getOrCreateEventLogger();
  const hookRunId = logger?.logHookRun(
    task.plugin,
    task.hookName,
    options.hookType,
    relativePath,
    false,
    task.hookDef.ifChanged,
    command
  );
  cliLog(
    `🪝 hook_run: ${task.plugin}/${task.hookName} in ${relativePath}`,
    'cyan'
  );
  // Log the command to file for debugging
  logToFile(`  Command: ${command}\n`);

  if (options.verbose) {
    console.log(
      `\n[${task.plugin}/${task.hookName}] Running in ${relativePath}:`
    );
    console.log(`  $ ${command}\n`);
  }

  // Serialize payload to pass via stdin to child process
  const payloadJson = JSON.stringify(payload);
  const hookEnv = {
    CLAUDE_PLUGIN_ROOT: task.pluginRoot,
    CLAUDE_PROJECT_DIR: projectRoot,
    HAN_SESSION_ID: options.sessionId,
  };

  // For Stop hooks: Wait mode is fully synchronous - run command and wait for completion
  // Log output in real-time for visibility
  if (options.isStopHook) {
    const result = await runCommandSync(
      command,
      directory,
      hookEnv,
      payloadJson
    );

    // Release slot after hook completes
    if (slotHandle) {
      await slotHandle.release();
      slotHandle = null;
    }

    // Process result
    if (result.success) {
      // Always update cache on success (for next run with --only-changed)
      if (task.hookDef.ifChanged && task.hookDef.ifChanged.length > 0) {
        const commandHash = createHash('sha256').update(command).digest('hex');
        await trackFilesAsync(
          task.plugin,
          task.hookName,
          directory,
          task.hookDef.ifChanged,
          task.pluginRoot,
          {
            logger: logger ?? undefined,
            directory: relativePath,
            commandHash,
            sessionId: options.sessionId,
          }
        );
      }

      logger?.logHookResult(
        task.plugin,
        task.hookName,
        options.hookType,
        relativePath,
        false,
        result.duration,
        0,
        true,
        result.output.trim(),
        undefined,
        hookRunId,
        task.hookDef.ifChanged,
        command
      );
      cliLog(
        `✅ hook_result: ${task.plugin}/${task.hookName} passed in ${relativePath} (${formatDuration(result.duration)})`,
        'green'
      );
      // Log output to file
      if (result.output.trim()) {
        logToFile(
          `  Output:\n${result.output
            .trim()
            .split('\n')
            .map((l) => `    ${l}`)
            .join('\n')}\n`
        );
      }

      return {
        plugin: task.plugin,
        hook: task.hookName,
        directory: relativePath,
        success: true,
        output: result.output.trim(),
        duration: result.duration,
      };
    }

    // Hook completed but failed
    logger?.logHookResult(
      task.plugin,
      task.hookName,
      options.hookType,
      relativePath,
      false,
      result.duration,
      result.exitCode,
      false,
      result.output.trim(),
      result.error.trim(),
      hookRunId,
      task.hookDef.ifChanged,
      command
    );
    cliLog(
      `❌ hook_result: ${task.plugin}/${task.hookName} failed in ${relativePath} (${formatDuration(result.duration)})`,
      'red'
    );
    // Log output/error to file
    if (result.output.trim()) {
      logToFile(
        `  Output:\n${result.output
          .trim()
          .split('\n')
          .map((l) => `    ${l}`)
          .join('\n')}\n`
      );
    }
    if (result.error.trim()) {
      logToFile(
        `  Error:\n${result.error
          .trim()
          .split('\n')
          .map((l) => `    ${l}`)
          .join('\n')}\n`
      );
    }

    return {
      plugin: task.plugin,
      hook: task.hookName,
      directory: relativePath,
      success: false,
      output: result.output.trim(),
      error: result.error.trim(),
      duration: result.duration,
    };
  }

  // For non-Stop hooks: Use synchronous execution (blocking is fine)
  try {
    const output = execSync(command, {
      cwd: directory,
      encoding: 'utf-8',
      timeout: 300000, // 5 minute timeout
      input: payloadJson,
      shell: '/bin/bash',
      env: {
        ...process.env,
        ...hookEnv,
      },
    });

    // Only update cache if hook has ifChanged patterns defined
    // Hooks without ifChanged (like PreToolUse security checks) should run every time
    if (task.hookDef.ifChanged && task.hookDef.ifChanged.length > 0) {
      const commandHash = createHash('sha256').update(command).digest('hex');
      await trackFilesAsync(
        task.plugin,
        task.hookName,
        directory,
        task.hookDef.ifChanged,
        task.pluginRoot,
        {
          logger: logger ?? undefined,
          directory: relativePath,
          commandHash,
          sessionId: options.sessionId,
          trackSessionChangesOnly: false, // Track all files the hook validated
        }
      );
    }

    const duration = Date.now() - startTime;

    logger?.logHookResult(
      task.plugin,
      task.hookName,
      options.hookType,
      relativePath,
      false,
      duration,
      0,
      true,
      output.trim(),
      undefined,
      hookRunId,
      task.hookDef.ifChanged,
      command
    );
    cliLog(
      `✅ hook_result: ${task.plugin}/${task.hookName} passed in ${relativePath} (${formatDuration(duration)})`,
      'green'
    );
    // Log output to file
    if (output.trim()) {
      logToFile(
        `  Output:\n${output
          .trim()
          .split('\n')
          .map((l) => `    ${l}`)
          .join('\n')}\n`
      );
    }

    return {
      plugin: task.plugin,
      hook: task.hookName,
      directory: relativePath,
      success: true,
      output: output.trim(),
      duration,
    };
  } catch (error: unknown) {
    const stderr = (error as { stderr?: Buffer })?.stderr?.toString() || '';
    const stdout = (error as { stdout?: Buffer })?.stdout?.toString() || '';
    const exitCode = (error as { status?: number })?.status ?? 1;
    const duration = Date.now() - startTime;

    logger?.logHookResult(
      task.plugin,
      task.hookName,
      options.hookType,
      relativePath,
      false,
      duration,
      exitCode,
      false,
      stdout.trim(),
      stderr.trim(),
      hookRunId,
      task.hookDef.ifChanged,
      command
    );
    cliLog(
      `❌ hook_result: ${task.plugin}/${task.hookName} failed in ${relativePath} (${formatDuration(duration)})`,
      'red'
    );
    // Log output/error to file
    if (stdout.trim()) {
      logToFile(
        `  Output:\n${stdout
          .trim()
          .split('\n')
          .map((l) => `    ${l}`)
          .join('\n')}\n`
      );
    }
    if (stderr.trim()) {
      logToFile(
        `  Error:\n${stderr
          .trim()
          .split('\n')
          .map((l) => `    ${l}`)
          .join('\n')}\n`
      );
    }

    return {
      plugin: task.plugin,
      hook: task.hookName,
      directory: relativePath,
      success: false,
      output: stdout.trim(),
      error: stderr.trim(),
      duration,
    };
  } finally {
    if (slotHandle) {
      await slotHandle.release();
    }
  }
}

/**
 * Read the last hook check state from the event log
 * Returns the most recent check state event for the given hook type
 */
/**
 * Check if Stop hook orchestration is currently active.
 * This indicates we're in a recursive scenario where a Stop hook triggered another Stop hook.
 */
function isStopHookActive(): boolean {
  // Check if HAN_STOP_ORCHESTRATING environment variable is set
  // This is set during wait mode execution to prevent recursion
  return process.env.HAN_STOP_ORCHESTRATING === '1';
}

/**
 * Tools that modify files - if these are used, Stop hooks should run
 * regardless of whether the exchange looks like Q&A
 */
const FILE_MODIFYING_TOOLS = new Set([
  'Edit',
  'Write',
  'NotebookEdit',
  'MultiEdit',
]);

/**
 * Check if the conversation is in a Q&A exchange (not completing work).
 * This detects two scenarios where Stop hooks should be skipped:
 * 1. Agent asked the user a question (waiting for user input) - ALWAYS skip
 * 2. User asked the agent a question AND agent didn't do file work - skip
 *
 * Priority:
 * - If agent's LAST message is a question → ALWAYS skip (waiting for input)
 * - If user asked question AND agent did file work → run hooks (work needs validation)
 * - If user asked question AND no file work → skip (pure conversation)
 */
async function isConversationalExchange(sessionId: string): Promise<boolean> {
  try {
    // Get recent messages to find the last user and last assistant message
    // We need more than 2 because there can be many tool use/result messages
    // between the user's question and the assistant's final response
    const msgs = await messages.list({
      sessionId,
      limit: 20, // Enough to find both roles even with many tool calls
    });

    if (msgs.length === 0) return false;

    // Find the last user message and last assistant message
    let lastUserMsg: (typeof msgs)[0] | null = null;
    let lastAssistantMsg: (typeof msgs)[0] | null = null;
    let hasFileModifications = false;

    for (const msg of msgs) {
      if (msg.role === 'user' && !lastUserMsg) {
        lastUserMsg = msg;
      }
      if (msg.role === 'assistant') {
        if (!lastAssistantMsg) {
          lastAssistantMsg = msg;
        }
        // Check ALL assistant messages for file-modifying tools
        // (agent may have multiple messages with tool uses)
        if (checkMessageForFileModifications(msg)) {
          hasFileModifications = true;
        }
      }
      // Stop looking for user/assistant once we have both AND checked enough for file mods
      if (lastUserMsg && lastAssistantMsg && hasFileModifications) break;
    }

    // PRIORITY 1: If agent's LAST message is a question, ALWAYS skip
    // Agent is waiting for user input - file mods from earlier don't matter yet
    if (lastAssistantMsg && checkMessageForQuestion(lastAssistantMsg)) {
      if (isDebugMode()) {
        console.error(
          `${colors.dim}[isConversationalExchange]${colors.reset} Agent asked question - skipping hooks`
        );
      }
      return true;
    }

    // PRIORITY 2: User asked a question
    if (lastUserMsg && checkMessageForQuestion(lastUserMsg)) {
      // If agent did file work after user's question, run hooks
      if (hasFileModifications) {
        if (isDebugMode()) {
          console.error(
            `${colors.dim}[isConversationalExchange]${colors.reset} User asked question but agent did file work - running hooks`
          );
        }
        return false;
      }
      // No file work - pure Q&A, skip hooks
      return true;
    }

    // No Q&A detected - check if there were file modifications
    if (hasFileModifications) {
      if (isDebugMode()) {
        console.error(
          `${colors.dim}[isConversationalExchange]${colors.reset} File modifications detected - running hooks`
        );
      }
      return false;
    }

    // No questions, no file modifications - this is unusual but run hooks to be safe
    return false;
  } catch (_err) {
    // Error querying - assume not a Q&A exchange
    return false;
  }
}

/**
 * Check if a message contains file-modifying tool uses (Edit, Write, NotebookEdit)
 */
function checkMessageForFileModifications(
  msg: Awaited<ReturnType<typeof messages.list>>[0]
): boolean {
  if (!msg.content) return false;

  try {
    const content = JSON.parse(msg.content);
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'tool_use' && FILE_MODIFYING_TOOLS.has(block.name)) {
          return true;
        }
      }
    }
  } catch {
    // Not JSON, no tool uses
  }

  return false;
}

/**
 * Check if a message contains a question (text or AskUserQuestion tool)
 */
function checkMessageForQuestion(
  msg: Awaited<ReturnType<typeof messages.list>>[0]
): boolean {
  let allText = '';

  if (msg.content) {
    try {
      const content = JSON.parse(msg.content);
      if (Array.isArray(content)) {
        for (const block of content) {
          // For assistant messages: check for AskUserQuestion tool
          if (
            msg.role === 'assistant' &&
            block.type === 'tool_use' &&
            block.name === 'AskUserQuestion'
          ) {
            return true;
          }
          // Collect text from text blocks
          if (block.type === 'text' && block.text) {
            allText += `${block.text} `;
          }
        }
      }
    } catch {
      // Not JSON, treat entire content as text
      if (typeof msg.content === 'string') {
        allText = msg.content;
      }
    }
  }

  // If no text collected, use raw content as fallback
  if (!allText && typeof msg.content === 'string') {
    allText = msg.content;
  }

  // Check for questions in the text
  return allText ? containsQuestion(allText) : false;
}

/**
 * Check if text contains a question
 */
function containsQuestion(text: string): boolean {
  // Normalize whitespace
  const normalized = text.trim().replace(/\s+/g, ' ');

  // 1. Check for question marks anywhere in the text
  if (normalized.includes('?')) {
    return true;
  }

  // 2. Check for common question patterns (case-insensitive)
  // These patterns indicate implied questions even without "?"
  const questionPatterns = [
    /\b(should i|shall i|can i|may i|could i|would i)\b/i,
    /\b(should we|shall we|can we|may we|could we|would we)\b/i,
    /\b(do you want|would you like|do you prefer|would you prefer)\b/i,
    /\b(what do you think|how about|what about)\b/i,
    /\b(which (one|option|approach|method))\b/i,
    /\b(or (do|should|would|could) (i|we|you))\b/i,
    /\b(let me know (if|whether|which))\b/i,
    // Waiting for user input patterns
    /\b(waiting (on|for) your)\b/i,
    /\b(your (choice|decision|input|response|answer))\b/i,
    /\b(please (choose|select|decide|pick))\b/i,
    // Option list patterns (A, B, or C / A) B) C) / 1, 2, or 3)
    /\b[ABC]\s*[,)]\s*[ABC]\s*[,)]\s*(or\s+)?[ABC]\b/i,
    /\b[123]\s*[,)]\s*[123]\s*[,)]\s*(or\s+)?[123]\b/i,
  ];

  for (const pattern of questionPatterns) {
    if (pattern.test(normalized)) {
      return true;
    }
  }

  return false;
}

async function getLastHookCheckState(
  sessionId: string,
  hookType: string
): Promise<{
  fingerprint: string;
  timestamp: string;
  hooks_count: number;
} | null> {
  try {
    // Query the DB for han_events for this session
    const hanEvents = await messages.list({
      sessionId,
      messageType: 'han_event',
      limit: 1000, // Get recent events
    });

    // Filter and find most recent hook_check_state for this hook type
    // Events are returned newest first, so we iterate forward
    for (const msg of hanEvents) {
      if (!msg.content) continue;
      try {
        const event = JSON.parse(msg.content);
        if (
          event.type === 'hook_check_state' &&
          event.data?.hook_type === hookType
        ) {
          return {
            fingerprint: event.data.fingerprint,
            timestamp: event.timestamp || msg.timestamp,
            hooks_count: event.data.hooks_count,
          };
        }
      } catch {
        // Skip invalid JSON
      }
    }
  } catch (_err) {
    // Error querying DB - treat as no previous state
  }

  return null;
}

/**
 * Check mode: Discover hooks and report what would run without executing.
 * This allows the agent to see what validation will happen and explicitly run it.
 *
 * To prevent spamming the same message on every turn, this function tracks the last
 * check state and only outputs if something has changed or enough time has passed.
 */
async function performCheckMode(
  tasks: HookTask[],
  eventType: string,
  projectRoot: string,
  onlyChanged: boolean,
  sessionId: string,
  skipIfQuestioning: boolean,
  degradedMode: boolean,
  degradedReason?: string
): Promise<void> {
  // If flag is set: check if this is a Q&A exchange (user or agent asked a question)
  // If so, skip hooks - no work is being validated, just conversation
  if (skipIfQuestioning && (await isConversationalExchange(sessionId))) {
    if (isDebugMode()) {
      console.error(
        `${colors.dim}[performCheckMode]${colors.reset} Q&A exchange detected - skipping hook check`
      );
    }
    // Exit silently - this is just conversation, not work completion
    process.exit(0);
  }

  // Build list of hooks that would run (checking cache/changes)
  const hooksToRun: Array<{
    plugin: string;
    hook: string;
    directory: string;
    reason: string;
  }> = [];
  const hooksSkipped: Array<{
    plugin: string;
    hook: string;
    directory: string;
    reason: string;
  }> = [];

  for (const task of tasks) {
    for (const directory of task.directories) {
      const relativePath =
        directory === projectRoot
          ? '.'
          : directory.replace(`${projectRoot}/`, '');

      // Check user overrides for enabled state
      const hookSettings = getPluginHookSettings(
        task.plugin,
        task.hookName,
        directory
      );
      if (hookSettings?.enabled === false) {
        hooksSkipped.push({
          plugin: task.plugin,
          hook: task.hookName,
          directory: relativePath,
          reason: 'disabled by user config',
        });
        continue;
      }

      // Check cache if only checking changed files
      if (onlyChanged) {
        // If ifChanged is not specified or empty, check against all session-changed files
        const patternsToCheck =
          task.hookDef.ifChanged && task.hookDef.ifChanged.length > 0
            ? task.hookDef.ifChanged
            : undefined; // undefined means "check all session changes"

        const hasChanges = await checkForChangesAsync(
          task.plugin,
          task.hookName,
          directory,
          patternsToCheck || ['**/*'], // Match all files if no patterns specified
          task.pluginRoot,
          {
            sessionId,
            directory: relativePath,
            checkSessionChangesOnly: !patternsToCheck, // Only check session-changed files
          }
        );

        if (!hasChanges) {
          hooksSkipped.push({
            plugin: task.plugin,
            hook: task.hookName,
            directory: relativePath,
            reason: 'no changes detected (cached)',
          });
          continue;
        }
      }

      // This hook will run
      hooksToRun.push({
        plugin: task.plugin,
        hook: task.hookName,
        directory: relativePath,
        reason: task.hookDef.ifChanged?.length
          ? 'files changed'
          : 'session has changes',
      });
    }
  }

  // Filter out wildcard dependency hooks if no validation hooks need to run
  // These advisory hooks only make sense when there's actual validation happening
  const validationHookCount = hooksToRun.filter((h) => {
    const task = tasks.find(
      (t) => t.plugin === h.plugin && t.hookName === h.hook
    );
    if (!task) return true;
    const hasWildcardDep = task.dependsOn?.some(
      (dep) => dep.plugin === '*' || dep.hook === '*'
    );
    return !hasWildcardDep;
  }).length;

  if (validationHookCount === 0) {
    // No validation hooks need to run, so skip wildcard dependency hooks too
    const filteredHooksToRun: typeof hooksToRun = [];
    for (const h of hooksToRun) {
      const task = tasks.find(
        (t) => t.plugin === h.plugin && t.hookName === h.hook
      );
      if (!task) {
        filteredHooksToRun.push(h);
        continue;
      }
      const hasWildcardDep = task.dependsOn?.some(
        (dep) => dep.plugin === '*' || dep.hook === '*'
      );
      if (hasWildcardDep) {
        hooksSkipped.push({
          plugin: h.plugin,
          hook: h.hook,
          directory: h.directory,
          reason: 'no validation hooks need to run',
        });
      } else {
        filteredHooksToRun.push(h);
      }
    }
    hooksToRun.length = 0;
    hooksToRun.push(...filteredHooksToRun);
  }

  // Compute a fingerprint of the current check state (for deduplication)
  const checkFingerprint = JSON.stringify(
    hooksToRun.map((h) => `${h.plugin}/${h.hook}@${h.directory}`).sort()
  );

  // Recursion detection: Check if Stop hooks are already active
  // This prevents infinite loops when hooks trigger themselves
  if (
    (eventType === 'Stop' || eventType === 'SubagentStop') &&
    isStopHookActive() &&
    hooksToRun.length > 0
  ) {
    console.error(`
${colors.red}⚠️  Recursion detected${colors.reset} - Stop hooks are already running, but validation is needed again.

This usually means a hook triggered file changes that need validation.

${colors.bold}Hooks that need to run:${colors.reset}
${hooksToRun.map((h) => `  - ${h.plugin}/${h.hook} in ${h.directory}`).join('\n')}

${colors.cyan}IMPORTANT:${colors.reset} To break the recursion loop:
1. Use the AskUserQuestion tool to ask: "Stop hook recursion detected. Continue with validation?"
2. If user approves, run: ${colors.bold}han hook orchestrate ${eventType} --wait${colors.reset}

${colors.dim}Note: The wait command automatically sets HAN_STOP_ORCHESTRATING=1 to prevent further recursion.${colors.reset}
`);
    process.exit(2);
  }

  // Get the event logger to check/log state
  const logger = getEventLogger();
  let shouldOutput = true;
  const now = Date.now();
  const RECHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  if (logger) {
    // Query DB for last check state
    const lastCheckState = await getLastHookCheckState(sessionId, eventType);
    if (lastCheckState) {
      // Only suppress output if:
      // 1. Fingerprint matches (same hooks need validation)
      // 2. Less than 5 minutes have passed
      if (
        lastCheckState.fingerprint === checkFingerprint &&
        now - new Date(lastCheckState.timestamp).getTime() < RECHECK_INTERVAL_MS
      ) {
        shouldOutput = false;
      }
    }
  }

  // Output summary
  if (hooksToRun.length === 0) {
    // Log empty check state
    if (logger) {
      logger.logHookCheckState(eventType, '', 0);
    }

    console.error(
      `${colors.green}✓ No validation needed${colors.reset} - all hooks cached or disabled`
    );
    if (hooksSkipped.length > 0 && isDebugMode()) {
      console.error(`${colors.dim}Skipped hooks:${colors.reset}`);
      for (const h of hooksSkipped) {
        console.error(
          `  ${colors.dim}- ${h.plugin}/${h.hook} in ${h.directory}: ${h.reason}${colors.reset}`
        );
      }
    }
    return;
  }

  // Only output if state has changed or enough time has passed
  if (shouldOutput) {
    // Log current check state
    if (logger) {
      logger.logHookCheckState(eventType, checkFingerprint, hooksToRun.length);
    }

    // Create orchestration and queue hooks
    const { orchestrations, pendingHooks } = require('../../db/index.ts');
    const orchestration = orchestrations.create({
      sessionId: sessionId.startsWith('cli-') ? undefined : sessionId,
      hookType: eventType,
      projectRoot,
    });
    const orchestrationId = orchestration.id;

    // Queue all hooks for later execution
    for (const h of hooksToRun) {
      const task = tasks.find(
        (t) => t.plugin === h.plugin && t.hookName === h.hook
      );
      if (!task) continue;

      // Get directory path
      const directory =
        h.directory === '.' ? projectRoot : `${projectRoot}/${h.directory}`;

      // Build command
      const command = resolveHanCommand(task.hookDef.command);

      // Queue the hook
      pendingHooks.queue({
        orchestrationId,
        plugin: h.plugin,
        hookName: h.hook,
        directory,
        ifChanged: task.hookDef.ifChanged
          ? JSON.stringify(task.hookDef.ifChanged)
          : undefined,
        command,
      });
    }

    // Get tasks for hooks that need to run, with phase dependencies injected
    const hooksToRunTasks = hooksToRun
      .map((h) =>
        tasks.find((t) => t.plugin === h.plugin && t.hookName === h.hook)
      )
      .filter((t): t is HookTask => t !== undefined);
    const tasksWithPhaseDeps = injectPhaseDependencies(hooksToRunTasks);
    const executionBatches = resolveDependencies(tasksWithPhaseDeps);

    // Report hooks grouped by execution batch
    console.error(
      `${colors.yellow}Hooks to run${colors.reset} - ${hooksToRun.length} hook(s) in ${executionBatches.length} batch(es):`
    );

    // Collect batches by phase type
    const phaseBatches: HookTask[][] = [];
    const postValidationBatches: HookTask[][] = [];

    for (const batch of executionBatches) {
      const hasWildcard = batch.some((t) =>
        t.dependsOn?.some((d) => d.plugin === '*' || d.hook === '*')
      );
      if (hasWildcard) {
        postValidationBatches.push(batch);
      } else {
        phaseBatches.push(batch);
      }
    }

    // Display phase batches with phase labels
    for (const batch of phaseBatches) {
      const batchPhase =
        batch.length > 0
          ? inferCategoryFromHookName(batch[0].hookName)
          : 'lint';
      console.error(`  ${colors.cyan}${batchPhase}:${colors.reset}`);
      for (const task of batch) {
        const h = hooksToRun.find(
          (hook) => hook.plugin === task.plugin && hook.hook === task.hookName
        );
        if (h) {
          console.error(`    - ${h.plugin}/${h.hook} in ${h.directory}`);
        }
      }
    }

    // Display post-validation batches under a single heading
    if (postValidationBatches.length > 0) {
      console.error(`  ${colors.dim}post-validation:${colors.reset}`);
      for (const batch of postValidationBatches) {
        for (const task of batch) {
          const h = hooksToRun.find(
            (hook) => hook.plugin === task.plugin && hook.hook === task.hookName
          );
          if (h) {
            console.error(`    - ${h.plugin}/${h.hook} in ${h.directory}`);
          }
        }
      }
    }

    if (hooksSkipped.length > 0) {
      console.error(
        `${colors.dim}(${hooksSkipped.length} hook(s) skipped - no changes)${colors.reset}`
      );
    }

    // Tell agent to run the queued hooks with orchestration ID
    console.error(`
${colors.cyan}To run validation, execute:${colors.reset}
  ${colors.bold}han hook orchestrate ${eventType} --wait --orchestration-id=${orchestrationId}${colors.reset}

${colors.dim}The wait command automatically prevents recursion during execution.${colors.reset}`);

    // Add degraded mode warning if applicable
    if (degradedMode && degradedReason) {
      console.error(`
${colors.yellow}⚠ Note: ${degradedReason}${colors.reset}
${colors.dim}Cache checks may be unreliable. Consider running with --all-files to skip caching.${colors.reset}`);
    }

    // Exit with code 2 to indicate action needed (same as validation failures)
    process.exit(2);
  }

  // State unchanged - exit silently (no output spam)
  process.exit(0);
}

/**
 * Main orchestration function
 */
export async function orchestrate(
  eventType: string,
  options: {
    onlyChanged: boolean;
    verbose: boolean;
    failFast: boolean;
    wait: boolean;
    check: boolean;
    orchestrationId?: string;
    skipIfQuestioning?: boolean;
    toolName?: string;
  }
): Promise<void> {
  // Signal handlers: Ensure clean exit when Claude Code terminates this process
  // Without these, async operations may keep the process alive after SIGTERM
  const exitHandler = () => {
    if (isDebugMode()) {
      console.error(
        `${colors.dim}[orchestrate]${colors.reset} Received termination signal, exiting...`
      );
    }
    process.exit(0);
  };
  process.on('SIGTERM', exitHandler);
  process.on('SIGINT', exitHandler);
  process.on('SIGHUP', exitHandler);

  // Recursion prevention: If we're already orchestrating Stop hooks, don't trigger again
  // This prevents infinite loops when user approves Bash commands during Stop execution.
  // BUT: Allow explicit --wait calls through (that's the user-initiated execution command)
  if (
    (eventType === 'Stop' || eventType === 'SubagentStop') &&
    process.env.HAN_STOP_ORCHESTRATING === '1' &&
    !options.wait
  ) {
    if (isDebugMode()) {
      console.error(
        `${colors.dim}[orchestrate]${colors.reset} Skipping ${eventType} - already orchestrating (recursion prevention)`
      );
    }
    return;
  }

  // Canonicalize projectRoot to match paths from native module (which uses fs::canonicalize)
  // This ensures path comparison works correctly on macOS where /var -> /private/var
  const rawProjectRoot = getProjectDir();
  const projectRoot = existsSync(rawProjectRoot)
    ? realpathSync(rawProjectRoot)
    : rawProjectRoot;

  // Read stdin payload or generate CLI payload
  const stdinPayload = readStdinPayload();
  const cliMode = !stdinPayload;

  // Use stdin payload or generate a CLI payload with proper structure
  const payload: HookPayload =
    stdinPayload || generateCliPayload(eventType, projectRoot);

  // Validate event type matches payload (only for real stdin payloads)
  if (
    stdinPayload?.hook_event_name &&
    stdinPayload.hook_event_name !== eventType
  ) {
    console.error(
      `Event mismatch: orchestrate called with "${eventType}" ` +
        `but stdin contains "${stdinPayload.hook_event_name}"`
    );
    process.exit(1);
  }

  // Session ID resolution priority:
  // 1. From orchestration (if --orchestration-id provided) - ensures cache consistency
  // 2. From stdin payload (from Claude Code)
  // 3. From environment variables
  // 4. Generated CLI session ID
  let sessionId = payload.session_id || `cli-${randomUUID()}`;

  // Import orchestrations for session ID lookup and later use
  const { orchestrations } = require('../../db/index.ts');

  // If orchestration ID is provided, load it FIRST to get the correct sessionId
  // This ensures cache reads/writes use the same sessionId that was used during --check
  if (options.orchestrationId) {
    const orch = orchestrations.get(options.orchestrationId);
    if (orch?.sessionId) {
      sessionId = orch.sessionId;
      if (isDebugMode()) {
        console.error(
          `${colors.dim}[orchestrate]${colors.reset} Using session ID from orchestration: ${sessionId}`
        );
      }
    }
  }

  // Initialize event logger with the correct sessionId
  initEventLogger(sessionId, {}, projectRoot);

  // Track degraded mode for health issues
  let degradedMode = false;
  let degradedReason: string | undefined;

  // Verify coordinator health if we'll be using caching
  // This prevents stale cache issues when coordinator has problems
  if (options.onlyChanged && !options.check) {
    const healthResult = await verifyCoordinatorHealth(sessionId, projectRoot);
    if (healthResult.degraded) {
      degradedMode = true;
      degradedReason = healthResult.reason;
      console.error(
        `${colors.yellow}⚠ Running in degraded mode:${colors.reset} ${healthResult.reason}`
      );
    }
  }

  // Set HAN_STOP_ORCHESTRATING=1 automatically for wait mode on Stop events
  // This prevents any hooks triggered during execution from recursing
  if (
    options.wait &&
    (eventType === 'Stop' || eventType === 'SubagentStop') &&
    process.env.HAN_STOP_ORCHESTRATING !== '1'
  ) {
    process.env.HAN_STOP_ORCHESTRATING = '1';
    if (isDebugMode()) {
      console.error(
        `${colors.dim}[orchestrate]${colors.reset} Set HAN_STOP_ORCHESTRATING=1 for recursion prevention`
      );
    }
  }

  if (isDebugMode()) {
    console.error(
      `${colors.dim}[orchestrate]${colors.reset} eventType=${colors.cyan}${eventType}${colors.reset} session_id=${colors.magenta}${sessionId || '(none)'}${colors.reset}`
    );
  }

  // If orchestration ID provided, load and execute queued hooks instead of discovering
  let tasks: HookTask[];
  if (options.orchestrationId) {
    const { pendingHooks } = require('../../db/index.ts');

    // Get queued hooks
    const queuedHooks = pendingHooks.list(options.orchestrationId);

    if (queuedHooks.length === 0) {
      console.error(
        `${colors.yellow}No queued hooks found for orchestration ${options.orchestrationId}${colors.reset}`
      );
      return;
    }

    if (isDebugMode()) {
      console.error(
        `${colors.dim}[orchestrate]${colors.reset} Found ${queuedHooks.length} queued hooks for orchestration ${options.orchestrationId}`
      );
    }

    // Convert queued hooks to HookTask format
    // Resolve actual plugin root for each hook (needed for CLAUDE_PLUGIN_ROOT env var)
    const { plugins, marketplaces } = getMergedPluginsAndMarketplaces();
    tasks = queuedHooks.map(
      (qh: import('../../../../han-native').QueuedHook) => {
        // Resolve the actual plugin root directory
        const marketplace = plugins.get(qh.plugin) || 'han';
        const marketplaceConfig = marketplaces.get(marketplace);
        const resolvedPluginRoot =
          getPluginDir(qh.plugin, marketplace, marketplaceConfig) ||
          projectRoot;

        return {
          plugin: qh.plugin,
          hookName: qh.hookName,
          hookDef: {
            command: qh.command,
            ifChanged: qh.ifChanged ? JSON.parse(qh.ifChanged) : undefined,
          },
          directories: [qh.directory],
          pluginRoot: resolvedPluginRoot,
          dependsOn: [],
        };
      }
    );

    // Validate that this is a wait command
    if (!options.wait) {
      console.error(
        `${colors.yellow}Warning: orchestration-id requires --wait flag${colors.reset}`
      );
      options.wait = true;
    }
  } else {
    // Discover all hook tasks for this event
    tasks = discoverHookTasks(
      eventType,
      payload,
      projectRoot,
      options.toolName
    );
  }

  if (tasks.length === 0) {
    if (cliMode || options.check) {
      console.error(
        `${colors.yellow}No hooks found for event type "${eventType}"${colors.reset}`
      );
    }
    return;
  }

  // Check mode: Just report what would run and tell agent to execute
  // Use a safeguard timeout to prevent indefinite hangs (Claude Code timeout is 30s)
  if (options.check) {
    const CHECK_MODE_TIMEOUT = 25000; // 25 seconds (5s buffer before Claude Code's 30s timeout)
    const timeoutId = setTimeout(() => {
      console.error(
        `${colors.yellow}⚠️  Check mode timeout - exiting to prevent hang${colors.reset}`
      );
      process.exit(0); // Exit cleanly, don't block the session
    }, CHECK_MODE_TIMEOUT);

    try {
      await performCheckMode(
        tasks,
        eventType,
        projectRoot,
        options.onlyChanged,
        sessionId,
        options.skipIfQuestioning ?? false,
        degradedMode,
        degradedReason
      );
    } finally {
      clearTimeout(timeoutId);
    }
    return;
  }

  // Use provided orchestration ID or create new one
  // Note: If orchestrationId was provided, sessionId was already loaded from it earlier
  let orchestrationId: string;
  if (options.orchestrationId) {
    // Reuse the orchestration created by --check
    orchestrationId = options.orchestrationId;
  } else {
    // Create an orchestration record (cancels any existing running orchestration for this session)
    const orchestration = orchestrations.create({
      sessionId: sessionId.startsWith('cli-') ? undefined : sessionId,
      hookType: eventType,
      projectRoot,
    });
    orchestrationId = orchestration.id;
  }

  // Initialize log file for this orchestration
  const logPath = initOrchestrationLog(orchestrationId, eventType, projectRoot);

  if (isDebugMode()) {
    console.error(
      `${colors.dim}[orchestrate]${colors.reset} Created orchestration ${colors.magenta}${orchestrationId}${colors.reset}`
    );
  }

  // Print orchestration ID so user can run `han hook wait <id>` if needed
  console.error(`[orchestration:${orchestrationId}]`);

  if (isDebugMode()) {
    console.error(
      `${colors.dim}[orchestrate]${colors.reset} Found ${colors.bold}${tasks.length}${colors.reset} hook tasks for ${colors.cyan}${eventType}${colors.reset}`
    );
  }

  // Inject phase-based dependencies (format → lint → typecheck → test → advisory)
  // This ensures hooks run in the correct order based on their category
  const tasksWithPhaseDeps = injectPhaseDependencies(tasks);

  // Resolve dependencies into execution batches
  const batches = resolveDependencies(tasksWithPhaseDeps);

  if (isDebugMode()) {
    console.error(
      `${colors.dim}[orchestrate]${colors.reset} Resolved into ${colors.bold}${batches.length}${colors.reset} batches`
    );
    for (let i = 0; i < batches.length; i++) {
      const batchHooks = batches[i].map(
        (t) => `${colors.cyan}${t.plugin}/${t.hookName}${colors.reset}`
      );
      console.error(
        `  ${colors.dim}Batch ${i + 1}:${colors.reset} ${batchHooks.join(', ')}`
      );
    }
  }

  const allResults: HookResult[] = [];
  const outputs: string[] = [];
  let hasFailures = false;
  let aborted = false; // Abort flag for fail-fast

  // Initialize hash cycle detector for recursion detection
  const cycleDetector = new HashCycleDetector();

  // Capture initial file hashes before running any hooks
  // This allows us to detect if hooks cycle files back to their original state
  for (const task of tasks) {
    if (task.hookDef.ifChanged && task.hookDef.ifChanged.length > 0) {
      for (const directory of task.directories) {
        cycleDetector.recordHashes(directory, task.hookDef.ifChanged, null);
      }
    }
  }

  // Execute batches sequentially, hooks within batch in parallel
  for (const batch of batches) {
    // Check abort flag before starting a batch
    if (aborted) break;
    // Run before_all for each hook in the batch (if configured)
    for (const task of batch) {
      const hookSettings = getPluginHookSettings(task.plugin, task.hookName);
      if (hookSettings?.before_all) {
        const beforeAllCmd = resolveHanCommand(hookSettings.before_all);
        if (options.verbose) {
          console.log(
            `\n[${task.plugin}/${task.hookName}] Running before_all:`
          );
          console.log(`  $ ${beforeAllCmd}\n`);
        }
        try {
          execSync(beforeAllCmd, {
            encoding: 'utf-8',
            timeout: 60000,
            stdio: options.verbose ? 'inherit' : ['pipe', 'pipe', 'pipe'],
            shell: '/bin/bash',
            cwd: projectRoot,
            env: {
              ...process.env,
              CLAUDE_PROJECT_DIR: projectRoot,
              CLAUDE_PLUGIN_ROOT: task.pluginRoot,
            },
          });
        } catch (error: unknown) {
          const stderr =
            (error as { stderr?: Buffer })?.stderr?.toString() || '';
          console.error(
            `\n❌ before_all failed for ${task.plugin}/${task.hookName}:\n${stderr}`
          );
          hasFailures = true;
        }
      }
    }

    // Build list of all task/directory combinations for this batch
    const pendingTasks: Array<{ task: HookTask; directory: string }> = [];
    for (const task of batch) {
      for (const directory of task.directories) {
        pendingTasks.push({ task, directory });
      }
    }

    // Execute tasks sequentially with fail-fast
    const batchResults: HookResult[] = [];
    let taskIndex = 0;

    // Helper to schedule the next task if not aborted
    const scheduleNext = (): Promise<HookResult> | null => {
      if (aborted && options.failFast) return null;
      if (taskIndex >= pendingTasks.length) return null;

      const { task, directory } = pendingTasks[taskIndex++];
      const relativePath =
        directory === projectRoot
          ? '.'
          : directory.replace(`${projectRoot}/`, '');

      const promise = (async (): Promise<HookResult> => {
        // Double-check abort flag (may have changed while waiting for slot)
        if (aborted && options.failFast) {
          return {
            plugin: task.plugin,
            hook: task.hookName,
            directory: relativePath,
            success: true,
            skipped: true,
            skipReason: 'aborted due to earlier failure',
            duration: 0,
          };
        }

        const result = await executeHookInDirectory(
          task,
          directory,
          projectRoot,
          payload,
          {
            ...options,
            cliMode,
            sessionId,
            orchestrationId,
            hookType: eventType,
            isStopHook: eventType === 'Stop' || eventType === 'SubagentStop',
            logPath,
          }
        );

        // Set abort flag on failure
        if (!result.success && !result.skipped && options.failFast) {
          aborted = true;
          if (isDebugMode()) {
            console.error(
              `${colors.red}[fail-fast]${colors.reset} Aborting due to failure in ${task.plugin}/${task.hookName}`
            );
          }
        }

        return result;
      })();

      return promise;
    };

    // Execute tasks sequentially (execSync blocks, so no real parallelism anyway)
    // This ensures fail-fast works correctly - no new tasks start after failure
    while (taskIndex < pendingTasks.length && (!aborted || !options.failFast)) {
      const p = scheduleNext();
      if (!p) break;

      const result = await p;
      batchResults.push(result);
    }

    // Mark remaining tasks as skipped if aborted
    while (taskIndex < pendingTasks.length) {
      const { task, directory } = pendingTasks[taskIndex++];
      const relativePath =
        directory === projectRoot
          ? '.'
          : directory.replace(`${projectRoot}/`, '');
      batchResults.push({
        plugin: task.plugin,
        hook: task.hookName,
        directory: relativePath,
        success: true,
        skipped: true,
        skipReason: 'aborted due to earlier failure',
        duration: 0,
      });
    }
    allResults.push(...batchResults);

    // Check for hash cycles (recursion detection)
    // After each batch, record new file hashes and check if any file
    // has returned to a previously seen state
    for (const result of batchResults) {
      if (result.success && !result.skipped) {
        const task = batch.find(
          (t) => t.plugin === result.plugin && t.hookName === result.hook
        );
        if (task?.hookDef.ifChanged && task.hookDef.ifChanged.length > 0) {
          const directory =
            result.directory === '.'
              ? projectRoot
              : `${projectRoot}/${result.directory}`;
          const cycleResult = cycleDetector.recordHashes(
            directory,
            task.hookDef.ifChanged,
            {
              plugin: result.plugin,
              hook: result.hook,
              directory: result.directory,
            }
          );

          if (cycleResult.hasCycle) {
            // Cycle detected - hooks are fighting!
            console.error(cycleDetector.formatCycleReport(cycleResult));
            appendToOrchestrationLog(
              logPath,
              cycleDetector.formatCycleReport(cycleResult)
            );
            process.exit(3); // Exit code 3 = recursion detected
          }
        }
      }
    }

    // Check for failures
    const failures = batchResults.filter((r) => !r.success && !r.skipped);
    if (failures.length > 0) {
      hasFailures = true;
      // Fail fast: abort and stop executing remaining batches
      if (options.failFast) {
        aborted = true;
        break;
      }
    }

    // Collect successful outputs
    for (const result of batchResults) {
      if (result.success && result.output && !result.skipped) {
        outputs.push(result.output);
      }
    }
  }

  // Log summary
  const eventLogger = getEventLogger();
  if (eventLogger) {
    const successful = allResults.filter((r) => r.success && !r.skipped).length;
    const skipped = allResults.filter((r) => r.skipped).length;
    const failed = allResults.filter((r) => !r.success).length;

    if (options.verbose) {
      console.log(
        `\nOrchestration complete: ${successful} passed, ${skipped} skipped, ${failed} failed`
      );
    }

    eventLogger.flush();
  }

  // Output aggregated results
  if (outputs.length > 0) {
    console.log(outputs.join('\n\n'));
  }

  // For Stop/SubagentStop hooks: handle deferred execution and attempt tracking
  if (eventType === 'Stop' || eventType === 'SubagentStop') {
    const deferredHooks = allResults.filter((r) => r.deferred);
    const failedHooks = allResults.filter((r) => !r.success && !r.skipped);
    const isRetryRun = payload.stop_hook_active === true;

    // If this is a retry run, increment attempts for failed hooks and check if stuck
    if (isRetryRun && failedHooks.length > 0) {
      const stuckHooks: Array<{
        plugin: string;
        hookName: string;
        directory: string;
        attempts: number;
        maxAttempts: number;
      }> = [];

      for (const hook of failedHooks) {
        const attemptInfo = hookAttempts.increment(
          sessionId,
          hook.plugin,
          hook.hook,
          hook.directory
        );

        if (attemptInfo.isStuck) {
          stuckHooks.push({
            plugin: hook.plugin,
            hookName: hook.hook,
            directory: hook.directory,
            attempts: attemptInfo.consecutiveFailures,
            maxAttempts: attemptInfo.maxAttempts,
          });
        }
      }

      // If any hooks are stuck, ask user before continuing
      if (stuckHooks.length > 0) {
        console.error(`The following hooks have failed ${stuckHooks[0].maxAttempts} times:
${stuckHooks.map((h) => `  - ${h.plugin}/${h.hookName} in ${h.directory}`).join('\n')}

📄 Full output logged to: ${logPath}

Use AskUserQuestion to ask the user: "Would you like to continue trying to fix these hooks?"
If yes, call mcp__plugin_core_han__increase_max_attempts for each stuck hook:
${stuckHooks.map((h) => `  - session_id: "${sessionId}", plugin: "${h.plugin}", hook_name: "${h.hookName}", directory: "${h.directory}"`).join('\n')}
Then retry fixing the issues.`);
        process.exit(2);
      }
    }

    // If we have deferred hooks (queued for background), handle wait
    if (deferredHooks.length > 0) {
      // Update orchestration with deferred count
      orchestrations.update({
        id: orchestrationId,
        deferredHooks: deferredHooks.length,
      });

      if (options.wait) {
        // Wait inline for deferred hooks
        console.error(`Hooks deferred to background execution:
${deferredHooks.map((h) => `  - ${h.plugin}/${h.hook} (${h.directory})`).join('\n')}

Waiting for hooks to complete...`);
        // Import and call wait logic
        const { waitForOrchestration } = await import('./wait.ts');
        await waitForOrchestration(orchestrationId, {
          pollInterval: 1000,
          timeout: 300000,
        });
        // waitForOrchestration will process.exit() with appropriate code
      } else {
        console.error(`[han hook orchestrate ${eventType}]: [orchestration:${orchestrationId}]
Hooks deferred to background execution:
${deferredHooks.map((h) => `  - ${h.plugin}/${h.hook} (${h.directory})`).join('\n')}

Run \`han hook wait ${orchestrationId}\` to wait for hooks and see their output.
If hooks fail, you will be notified and should fix the issues.`);
        process.exit(2);
      }
    }

    // If we have failed hooks (but not stuck), tell agent to fix them
    if (failedHooks.length > 0) {
      console.error(`
❌ Hook validation failed:
${failedHooks.map((h) => `  - ${h.plugin}/${h.hook} in ${h.directory}`).join('\n')}

📄 Full output logged to: ${logPath}

Read the log file to see error details, then spawn a subagent to fix the issues.
When done, the Stop hook will run again to verify the fixes.`);
      process.exit(2);
    }

    // All hooks passed - reset attempt counters for any hooks that previously failed
    for (const result of allResults) {
      if (result.success && !result.skipped) {
        hookAttempts.reset(
          sessionId,
          result.plugin,
          result.hook,
          result.directory
        );
      }
    }

    // Run wildcard dependency hooks inline after validation passes
    // These hooks were filtered out during queueing and need to run after all validation
    if (options.orchestrationId && options.wait) {
      const orch = orchestrations.get(options.orchestrationId);

      if (orch) {
        // Discover all tasks for the original event type
        const allTasks = discoverHookTasks(
          orch.hookType,
          payload,
          orch.projectRoot
        );

        // Filter to only tasks with wildcard dependencies
        const wildcardTasks = allTasks.filter((task) =>
          task.dependsOn?.some((dep) => dep.plugin === '*' || dep.hook === '*')
        );

        if (wildcardTasks.length > 0) {
          // Sort wildcard tasks by their dependencies on each other
          // (e.g., enforce-iteration depends on check_commits)
          const sortedBatches = resolveDependencies(wildcardTasks);
          const sortedTasks = sortedBatches.flat();

          if (isDebugMode()) {
            console.error(
              `${colors.dim}[orchestrate]${colors.reset} Running ${wildcardTasks.length} wildcard hooks in order: ${sortedTasks.map((t) => `${t.plugin}/${t.hookName}`).join(' → ')}`
            );
          }

          // Execute wildcard dependency hooks sequentially in dependency order
          for (const task of sortedTasks) {
            for (const directory of task.directories) {
              const relativePath = relative(projectRoot, directory);
              const displayDir = relativePath || '.';

              if (isDebugMode()) {
                console.error(
                  `${colors.dim}[orchestrate]${colors.reset} Executing ${task.plugin}/${task.hookName} in ${displayDir}`
                );
              }

              const result = await executeHookInDirectory(
                task,
                directory,
                orch.projectRoot,
                payload,
                {
                  onlyChanged: false, // Always run wildcard hooks
                  verbose: options.verbose,
                  cliMode: options.wait || false,
                  sessionId,
                  orchestrationId,
                  hookType: orch.hookType,
                  isStopHook:
                    orch.hookType === 'Stop' ||
                    orch.hookType === 'SubagentStop',
                  logPath,
                }
              );

              allResults.push(result);

              // If a wildcard hook fails, report it but don't block
              // (these are typically advisory hooks like check_commits)
              if (!result.success && !result.skipped) {
                console.error(
                  `${colors.yellow}⚠️  Advisory hook failed: ${task.plugin}/${task.hookName} in ${displayDir}${colors.reset}`
                );
              }
            }
          }
        }
      }
    }

    // Update orchestration as completed
    const completedCount = allResults.filter(
      (r) => r.success && !r.skipped
    ).length;
    orchestrations.update({
      id: orchestrationId,
      status: 'completed',
      totalHooks: allResults.length,
      completedHooks: completedCount,
    });

    // Clean up queued hooks if this was a --wait execution
    if (options.orchestrationId) {
      const { pendingHooks } = require('../../db/index.ts');
      const deleted = pendingHooks.delete(options.orchestrationId);
      if (isDebugMode() && deleted > 0) {
        console.error(
          `${colors.dim}[orchestrate]${colors.reset} Deleted ${deleted} queued hooks for orchestration ${options.orchestrationId}`
        );
      }
    }

    // All hooks passed - allow stop (exit 0)
    return;
  }

  // For non-Stop hooks, original behavior
  if (hasFailures) {
    const failedHooks = allResults.filter((r) => !r.success && !r.skipped);
    console.error(`
❌ Hook validation failed:
${failedHooks.map((h) => `  - ${h.plugin}/${h.hook} in ${h.directory}`).join('\n')}

📄 Full output logged to: ${logPath}

Read the log file to see error details.`);
    orchestrations.update({
      id: orchestrationId,
      status: 'failed',
      totalHooks: allResults.length,
      completedHooks: allResults.filter((r) => r.success && !r.skipped).length,
      failedHooks: failedHooks.length,
    });
    process.exit(2);
  }

  // Mark orchestration as completed
  orchestrations.update({
    id: orchestrationId,
    status: 'completed',
    totalHooks: allResults.length,
    completedHooks: allResults.filter((r) => r.success && !r.skipped).length,
  });
}

/**
 * Register the orchestrate command
 */
export function registerHookOrchestrate(hookCommand: Command): void {
  hookCommand
    .command('orchestrate <eventType>')
    .description(
      'Orchestrate all hooks for a given Claude Code event type.\n\n' +
        'This is the central entry point for hook execution. It:\n' +
        '  - Discovers all installed plugins and their hooks\n' +
        '  - Filters hooks by event type (Stop, PreToolUse, etc.)\n' +
        '  - Resolves dependencies between hooks\n' +
        '  - Executes hooks with controlled parallelism\n\n' +
        'Event types: Stop, SubagentStop, PreToolUse, PostToolUse,\n' +
        '             SessionStart, UserPromptSubmit, SubagentStart'
    )
    .option(
      '--all-files',
      'Check all files, not just changed files (ignores cache)'
    )
    .option('--no-fail-fast', 'Continue executing even after failures')
    .option('-v, --verbose', 'Show detailed execution output')
    .option(
      '-w, --wait',
      'Wait for deferred hooks to complete (tail logs inline)'
    )
    .option(
      '-c, --check',
      'Check mode: report what hooks would run without executing them'
    )
    .option(
      '--orchestration-id <id>',
      'Run queued hooks from a specific orchestration (use with --wait)'
    )
    .option(
      '--skip-if-questioning',
      'Skip hook check if the last user or agent message contains a question (Q&A exchange, not work)'
    )
    .option(
      '--tool-name <name>',
      'Filter SubagentPrompt hooks by tool name (Task or Skill)'
    )
    .action(
      async (
        eventType: string,
        opts: {
          allFiles?: boolean;
          failFast?: boolean;
          verbose?: boolean;
          wait?: boolean;
          check?: boolean;
          orchestrationId?: string;
          skipIfQuestioning?: boolean;
          toolName?: string;
        }
      ) => {
        await orchestrate(eventType, {
          onlyChanged: !opts.allFiles, // default true (only changed files)
          failFast: opts.failFast !== false,
          verbose: opts.verbose ?? false,
          check: opts.check ?? false,
          wait: opts.wait ?? false,
          orchestrationId: opts.orchestrationId,
          skipIfQuestioning: opts.skipIfQuestioning ?? false,
          toolName: opts.toolName,
        });
      }
    );
}
