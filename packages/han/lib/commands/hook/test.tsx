/**
 * Hook Test Command
 *
 * Runs hooks with simulated Claude Code input to help debug hook failures.
 * Can test hooks from both Han plugins and Claude Code settings.
 */

import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Command } from 'commander';
import { Box, render, Text } from 'ink';
import type React from 'react';
import {
  getClaudeConfigDir,
  getMergedPluginsAndMarketplaces,
  getSettingsPaths,
  type MarketplaceConfig,
  readSettingsFile,
  type SettingsScope,
} from '../../config/claude-settings.ts';
import {
  getHookEvents,
  loadPluginConfig,
  type PluginHookDefinition,
} from '../../hooks/index.ts';

/**
 * Hook types where stdout is meant to inject context into Claude's conversation.
 * These are the hooks affected by the Claude Code plugin output capture bug.
 * See: https://github.com/anthropics/claude-code/issues/12151
 */
const CONTEXT_INJECTING_HOOK_TYPES = [
  'SessionStart',
  'UserPromptSubmit',
  'PreCompact',
  'Notification',
];

/**
 * Hook entry from Claude Code settings (legacy format)
 */
interface LegacyHookEntry {
  type: 'command' | 'prompt';
  command?: string;
  prompt?: string;
  timeout?: number;
}

/**
 * Unified hook representation for testing
 */
interface TestableHook {
  source: 'settings' | 'plugin' | 'claude-plugin';
  sourcePath: string;
  pluginName?: string;
  marketplace?: string;
  scope?: SettingsScope;
  hookType: string;
  name: string;
  command: string;
  timeout?: number;
  type: 'command' | 'prompt';
  /**
   * True if this hook is from a Claude Code plugin's hooks/hooks.json.
   * These hooks have a bug where output is not captured for context-injecting hook types.
   */
  isClaudePlugin?: boolean;
}

/**
 * Test execution result
 */
interface TestResult {
  hook: TestableHook;
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  duration: number;
  timedOut: boolean;
}

/**
 * Phase timing stats
 */
interface PhaseStats {
  hookType: string;
  hookCount: number;
  passed: number;
  failed: number;
  totalDuration: number;
  startTime?: number;
}

/**
 * Find plugin in a marketplace root directory
 */
function findPluginInMarketplace(
  marketplaceRoot: string,
  pluginName: string
): string | null {
  const potentialPaths = [
    join(marketplaceRoot, 'jutsu', pluginName),
    join(marketplaceRoot, 'do', pluginName),
    join(marketplaceRoot, 'hashi', pluginName),
    join(marketplaceRoot, pluginName),
  ];

  if (pluginName === 'core') {
    potentialPaths.push(join(marketplaceRoot, 'core'));
  }

  for (const path of potentialPaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  return null;
}

function resolveToAbsolute(path: string): string {
  if (path.startsWith('/')) {
    return path;
  }
  return join(process.cwd(), path);
}

function getPluginDir(
  pluginName: string,
  marketplace: string,
  marketplaceConfig: MarketplaceConfig | undefined
): string | null {
  if (marketplaceConfig?.source?.source === 'directory') {
    const directoryPath = marketplaceConfig.source.path;
    if (directoryPath) {
      const absolutePath = resolveToAbsolute(directoryPath);
      const found = findPluginInMarketplace(absolutePath, pluginName);
      if (found) {
        return found;
      }
    }
  }

  const cwd = process.cwd();
  if (existsSync(join(cwd, '.claude-plugin', 'marketplace.json'))) {
    const found = findPluginInMarketplace(cwd, pluginName);
    if (found) {
      return found;
    }
  }

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
 * Collect all hooks from Claude Code settings
 */
function collectSettingsHooks(): TestableHook[] {
  const hooks: TestableHook[] = [];

  for (const { scope, path } of getSettingsPaths()) {
    // Check settings.json for hooks
    const settings = readSettingsFile(path);
    if (settings?.hooks) {
      for (const [hookType, hookGroups] of Object.entries(
        settings.hooks as Record<string, unknown>
      )) {
        if (!Array.isArray(hookGroups)) continue;

        for (const group of hookGroups) {
          if (
            typeof group === 'object' &&
            group !== null &&
            'hooks' in group &&
            Array.isArray(group.hooks)
          ) {
            for (let i = 0; i < group.hooks.length; i++) {
              const h = group.hooks[i] as LegacyHookEntry;
              hooks.push({
                source: 'settings',
                sourcePath: path,
                scope,
                hookType,
                name: `settings-${hookType}-${i + 1}`,
                command: h.command || h.prompt || '',
                timeout: h.timeout,
                type: h.type,
              });
            }
          }
        }
      }
    }

    // Also check hooks.json
    const hooksJsonPath = path.replace(
      /settings(\.local)?\.json$/,
      'hooks.json'
    );
    if (hooksJsonPath !== path && existsSync(hooksJsonPath)) {
      try {
        const content = readFileSync(hooksJsonPath, 'utf-8');
        const hooksJson = JSON.parse(content) as Record<string, unknown>;
        const hooksObj =
          hooksJson.hooks && typeof hooksJson.hooks === 'object'
            ? (hooksJson.hooks as Record<string, unknown>)
            : hooksJson;

        for (const [hookType, hookGroups] of Object.entries(hooksObj)) {
          if (!Array.isArray(hookGroups)) continue;

          for (const group of hookGroups) {
            if (
              typeof group === 'object' &&
              group !== null &&
              'hooks' in group &&
              Array.isArray(group.hooks)
            ) {
              for (let i = 0; i < group.hooks.length; i++) {
                const h = group.hooks[i] as LegacyHookEntry;
                hooks.push({
                  source: 'settings',
                  sourcePath: hooksJsonPath,
                  scope,
                  hookType,
                  name: `hooks-json-${hookType}-${i + 1}`,
                  command: h.command || h.prompt || '',
                  timeout: h.timeout,
                  type: h.type,
                });
              }
            }
          }
        }
      } catch {
        // Invalid JSON, skip
      }
    }
  }

  return hooks;
}

/**
 * Check if a hook applies to the current directory based on dirs_with markers
 */
function hookAppliesHere(hookDef: PluginHookDefinition): boolean {
  const dirsWith = hookDef.dirsWith;
  if (!dirsWith || dirsWith.length === 0) {
    return true; // No dirs_with filter means hook applies everywhere
  }

  const cwd = process.cwd();
  for (const marker of dirsWith) {
    if (existsSync(join(cwd, marker))) {
      return true;
    }
  }
  return false;
}

/**
 * Collect all hooks from Han plugins
 */
function collectPluginHooks(): TestableHook[] {
  const hooks: TestableHook[] = [];
  const { plugins, marketplaces } = getMergedPluginsAndMarketplaces();

  for (const [pluginName, marketplace] of plugins.entries()) {
    const marketplaceConfig = marketplaces.get(marketplace);
    const pluginRoot = getPluginDir(pluginName, marketplace, marketplaceConfig);

    if (!pluginRoot) continue;

    const config = loadPluginConfig(pluginRoot, false);
    if (!config?.hooks) continue;

    for (const [hookName, hookDef] of Object.entries(config.hooks)) {
      const def = hookDef as PluginHookDefinition;

      // Skip hooks that don't apply to current directory (dirs_with check)
      if (!hookAppliesHere(def)) {
        continue;
      }

      const events = getHookEvents(def);
      for (const event of events) {
        hooks.push({
          source: 'plugin',
          sourcePath: pluginRoot,
          pluginName,
          marketplace,
          hookType: event,
          name: hookName,
          command: def.command,
          timeout: def.timeout,
          type: 'command',
        });
      }
    }
  }

  return hooks;
}

/**
 * Claude Code plugin hooks.json format
 */
interface ClaudePluginHooksJson {
  description?: string;
  hooks?: Record<
    string,
    Array<{
      matcher?: string;
      hooks: Array<{
        type: 'command' | 'prompt';
        command?: string;
        prompt?: string;
        timeout?: number;
      }>;
    }>
  >;
}

/**
 * Collect hooks from Claude Code plugin hooks.json files.
 * These are the hooks that Claude Code directly executes from plugins.
 *
 * IMPORTANT: These hooks have a bug where stdout is not captured for
 * context-injecting hook types (SessionStart, UserPromptSubmit, etc.)
 * See: https://github.com/anthropics/claude-code/issues/12151
 */
function collectClaudePluginHooks(): TestableHook[] {
  const hooks: TestableHook[] = [];
  const configDir = getClaudeConfigDir();
  if (!configDir) return hooks;

  const pluginCacheDir = join(configDir, 'plugins', 'cache');
  if (!existsSync(pluginCacheDir)) return hooks;

  try {
    const marketplaces = readdirSync(pluginCacheDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const marketplace of marketplaces) {
      const marketplaceDir = join(pluginCacheDir, marketplace);
      const plugins = readdirSync(marketplaceDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      for (const pluginName of plugins) {
        const pluginDir = join(marketplaceDir, pluginName);
        const versions = readdirSync(pluginDir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
          .sort()
          .reverse();

        if (versions.length === 0) continue;

        const latestVersion = versions[0];
        const hooksJsonPath = join(
          pluginDir,
          latestVersion,
          'hooks',
          'hooks.json'
        );

        if (!existsSync(hooksJsonPath)) continue;

        try {
          const content = readFileSync(hooksJsonPath, 'utf-8');
          const hooksJson = JSON.parse(content) as ClaudePluginHooksJson;

          if (!hooksJson.hooks) continue;

          for (const [hookType, hookGroups] of Object.entries(
            hooksJson.hooks
          )) {
            let hookIndex = 0;
            for (const group of hookGroups) {
              for (const hook of group.hooks) {
                hookIndex++;
                hooks.push({
                  source: 'claude-plugin',
                  sourcePath: hooksJsonPath,
                  pluginName: `${pluginName}@${marketplace}`,
                  hookType,
                  name: `hook-${hookIndex}`,
                  command: hook.command || hook.prompt || '',
                  timeout: hook.timeout,
                  type: hook.type,
                  isClaudePlugin: true,
                });
              }
            }
          }
        } catch {
          // Invalid JSON, skip
        }
      }
    }
  } catch {
    // Directory read failed, skip
  }

  return hooks;
}

/**
 * Generate example stdin payload like Claude Code would send.
 * Based on official Claude Code hook documentation.
 */
function generateStdinPayload(hookType: string): string {
  const sessionId = `test-session-${Date.now()}`;
  const transcriptPath = `~/.claude/projects/test-project/${sessionId}.jsonl`;

  // Common fields for all hooks
  const basePayload: Record<string, unknown> = {
    session_id: sessionId,
    transcript_path: transcriptPath,
    cwd: process.cwd(),
    permission_mode: 'default',
    hook_event_name: hookType,
  };

  // Add hook-specific fields per Claude Code documentation
  switch (hookType) {
    case 'PreToolUse':
      basePayload.tool_name = 'Write';
      basePayload.tool_input = {
        file_path: '/tmp/test-file.txt',
        content: 'test content',
      };
      basePayload.tool_use_id = `toolu_01TEST${Date.now()}`;
      break;

    case 'PostToolUse':
      basePayload.tool_name = 'Write';
      basePayload.tool_input = {
        file_path: '/tmp/test-file.txt',
        content: 'test content',
      };
      basePayload.tool_response = {
        filePath: '/tmp/test-file.txt',
        success: true,
      };
      basePayload.tool_use_id = `toolu_01TEST${Date.now()}`;
      break;

    case 'PostToolUseFailure':
      basePayload.tool_name = 'Bash';
      basePayload.tool_input = {
        command: 'exit 1',
        description: 'Test failing command',
      };
      basePayload.tool_response = {
        exit_code: 1,
        stderr: 'Command failed',
      };
      basePayload.tool_use_id = `toolu_01TEST${Date.now()}`;
      break;

    case 'PermissionRequest':
      basePayload.tool_name = 'Bash';
      basePayload.tool_input = {
        command: 'rm -rf /tmp/test',
        description: 'Test permission request',
      };
      basePayload.tool_use_id = `toolu_01TEST${Date.now()}`;
      break;

    case 'UserPromptSubmit':
      basePayload.prompt = 'Test prompt for hook execution';
      break;

    case 'Stop':
      basePayload.stop_hook_active = false;
      break;

    case 'SubagentStart':
      basePayload.agent_id = `agent-${Date.now()}`;
      basePayload.agent_type = 'Explore';
      break;

    case 'SubagentStop':
      basePayload.stop_hook_active = false;
      basePayload.agent_id = `agent-${Date.now()}`;
      basePayload.agent_transcript_path = `${transcriptPath}/subagents/agent-${Date.now()}.jsonl`;
      break;

    case 'SessionStart':
      basePayload.source = 'startup';
      basePayload.model = 'claude-sonnet-4-20250514';
      break;

    case 'SessionEnd':
      basePayload.reason = 'exit';
      break;

    case 'PreCompact':
      basePayload.trigger = 'manual';
      basePayload.custom_instructions = '';
      break;

    case 'Setup':
      basePayload.trigger = 'init';
      break;

    case 'Notification':
      basePayload.message = 'Claude needs your permission';
      basePayload.notification_type = 'permission_prompt';
      break;
  }

  return JSON.stringify(basePayload, null, 2);
}

/**
 * Execute a single hook and return the result
 */
async function executeHook(
  hook: TestableHook,
  stdinPayload: string
): Promise<TestResult> {
  const startTime = Date.now();

  // Prompt hooks are just text, not executed
  if (hook.type === 'prompt') {
    return {
      hook,
      success: true,
      exitCode: 0,
      stdout: `[Prompt hook - text output only]\n${hook.command}`,
      stderr: '',
      duration: 0,
      timedOut: false,
    };
  }

  return new Promise((resolve) => {
    const configDir = getClaudeConfigDir();
    const claudeBinDir = join(configDir, 'bin');
    const pathSeparator = process.platform === 'win32' ? ';' : ':';
    const enhancedPath = `${claudeBinDir}${pathSeparator}${process.env.PATH || ''}`;

    // Resolve CLAUDE_PLUGIN_ROOT in the command
    const pluginRoot = hook.sourcePath;
    const resolvedCommand = hook.command.replace(
      /\$\{CLAUDE_PLUGIN_ROOT\}/g,
      pluginRoot
    );

    const child = spawn(resolvedCommand, {
      shell: '/bin/sh',
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: configDir,
        CLAUDE_PLUGIN_ROOT: pluginRoot,
        CLAUDE_PROJECT_DIR: process.cwd(),
        PATH: enhancedPath,
      },
    });

    // Write stdin payload
    if (child.stdin) {
      child.stdin.write(stdinPayload);
      child.stdin.end();
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timeoutMs = (hook.timeout || 30) * 1000;

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timeoutHandle);
      const duration = Date.now() - startTime;
      resolve({
        hook,
        success: code === 0 && !timedOut,
        exitCode: code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        duration,
        timedOut,
      });
    });

    child.on('error', (error) => {
      clearTimeout(timeoutHandle);
      const duration = Date.now() - startTime;
      resolve({
        hook,
        success: false,
        exitCode: null,
        stdout: '',
        stderr: error.message,
        duration,
        timedOut: false,
      });
    });
  });
}

/**
 * UI Component for test results
 */
interface TestUIProps {
  hooks: TestableHook[];
  results: Map<string, TestResult>;
  phaseStats: Map<string, PhaseStats>;
  currentPhase: string | null;
  currentHook: TestableHook | null;
  showPayload: boolean;
  stdinPayload: string;
  isComplete: boolean;
  totalDuration: number;
}

/**
 * Check if a hook is affected by the Claude Code plugin output capture bug.
 * Plugin hooks on context-injecting hook types have their output silently discarded.
 */
function isAffectedByOutputBug(hook: TestableHook): boolean {
  return (
    hook.isClaudePlugin === true &&
    CONTEXT_INJECTING_HOOK_TYPES.includes(hook.hookType)
  );
}

const TestResultDisplay: React.FC<{ result: TestResult }> = ({ result }) => {
  const statusColor = result.success ? 'green' : 'red';
  const statusIcon = result.success ? '✓' : '✗';
  const affectedByBug = isAffectedByOutputBug(result.hook);

  // Determine source color and label
  let sourceColor: string;
  let sourceLabel: string;
  if (result.hook.source === 'claude-plugin') {
    sourceColor = 'magenta';
    sourceLabel = `${result.hook.pluginName}/${result.hook.name}`;
  } else if (result.hook.source === 'plugin') {
    sourceColor = 'cyan';
    sourceLabel = `${result.hook.pluginName}/${result.hook.name}`;
  } else {
    sourceColor = 'yellow';
    sourceLabel = `settings/${result.hook.name}`;
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={statusColor} bold>
          {statusIcon}
        </Text>
        <Text> </Text>
        <Text color={sourceColor}>{sourceLabel}</Text>
        {result.hook.source === 'claude-plugin' && (
          <Text dimColor> [Claude plugin]</Text>
        )}
        <Text dimColor> ({result.duration}ms)</Text>
        {result.timedOut && <Text color="red"> [TIMEOUT]</Text>}
        {result.exitCode !== null && result.exitCode !== 0 && (
          <Text color="red"> [exit {result.exitCode}]</Text>
        )}
      </Box>

      {/* Command */}
      <Box marginLeft={3}>
        <Text dimColor>Command: </Text>
        <Text color="gray">{result.hook.command.slice(0, 60)}</Text>
        {result.hook.command.length > 60 && <Text color="gray">...</Text>}
      </Box>

      {/* Stdout */}
      {result.stdout && (
        <Box marginLeft={3} flexDirection="column">
          <Text dimColor>stdout:</Text>
          <Box marginLeft={2}>
            <Text color="white">
              {result.stdout.slice(0, 500)}
              {result.stdout.length > 500 ? '...' : ''}
            </Text>
          </Box>
        </Box>
      )}

      {/* Bug warning - what Claude would actually see */}
      {affectedByBug && result.stdout && (
        <Box marginLeft={3} flexDirection="column">
          <Box>
            <Text color="red" bold>
              ⚠ Claude would see:
            </Text>
            <Text color="red"> (nothing - output discarded)</Text>
          </Box>
          <Box marginLeft={2}>
            <Text dimColor>
              Bug: Plugin hooks.json output not captured for{' '}
              {result.hook.hookType}
            </Text>
          </Box>
          <Box marginLeft={2}>
            <Text dimColor>
              See: github.com/anthropics/claude-code/issues/12151
            </Text>
          </Box>
        </Box>
      )}

      {/* Stderr */}
      {result.stderr && (
        <Box marginLeft={3} flexDirection="column">
          <Text color="red">stderr:</Text>
          <Box marginLeft={2}>
            <Text color="red">
              {result.stderr.slice(0, 500)}
              {result.stderr.length > 500 ? '...' : ''}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = ((ms % 60000) / 1000).toFixed(1);
  return `${mins}m ${secs}s`;
}

const PhaseStatsDisplay: React.FC<{
  stats: PhaseStats;
  isCurrent: boolean;
}> = ({ stats, isCurrent }) => {
  const allPassed = stats.failed === 0 && stats.passed > 0;
  const statusColor = allPassed ? 'green' : stats.failed > 0 ? 'red' : 'gray';
  const statusIcon = allPassed ? '✓' : stats.failed > 0 ? '✗' : '○';

  return (
    <Box>
      <Text color={statusColor} bold>
        {statusIcon}
      </Text>
      <Text> </Text>
      <Text color={isCurrent ? 'yellow' : 'white'} bold>
        {stats.hookType}
      </Text>
      <Text dimColor>
        {' '}
        ({stats.hookCount} hook{stats.hookCount !== 1 ? 's' : ''})
      </Text>
      {stats.totalDuration > 0 && (
        <Text color="cyan"> {formatDuration(stats.totalDuration)}</Text>
      )}
      {isCurrent && <Text color="yellow"> ← running</Text>}
    </Box>
  );
};

const HookTestUI: React.FC<TestUIProps> = ({
  hooks,
  results,
  phaseStats,
  currentPhase,
  currentHook,
  showPayload,
  stdinPayload,
  isComplete,
  totalDuration,
}) => {
  const passed = Array.from(results.values()).filter((r) => r.success).length;
  const failed = Array.from(results.values()).filter((r) => !r.success).length;

  // Sort phases in logical order
  const eventOrder = [
    'Setup',
    'SessionStart',
    'UserPromptSubmit',
    'PreToolUse',
    'PermissionRequest',
    'PostToolUse',
    'PostToolUseFailure',
    'SubagentStart',
    'SubagentStop',
    'Stop',
    'PreCompact',
    'SessionEnd',
    'Notification',
  ];
  const sortedPhases = Array.from(phaseStats.values()).sort((a, b) => {
    const aIdx = eventOrder.indexOf(a.hookType);
    const bIdx = eventOrder.indexOf(b.hookType);
    if (aIdx === -1 && bIdx === -1) return a.hookType.localeCompare(b.hookType);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>{'═'.repeat(60)}</Text>
      <Text bold>HOOK TEST - Simulating Claude Code Hook Execution</Text>
      <Text bold>{'═'.repeat(60)}</Text>

      {showPayload && (
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>Stdin payload sent to hooks:</Text>
          <Box marginLeft={2}>
            <Text color="gray">{stdinPayload}</Text>
          </Box>
        </Box>
      )}

      {/* Phase Overview */}
      <Box flexDirection="column" marginTop={1}>
        <Text bold>Phases:</Text>
        <Box flexDirection="column" marginLeft={2}>
          {sortedPhases.map((stats) => (
            <PhaseStatsDisplay
              key={stats.hookType}
              stats={stats}
              isCurrent={stats.hookType === currentPhase}
            />
          ))}
        </Box>
      </Box>

      {/* Current hook indicator */}
      {currentHook && !isComplete && (
        <Box marginTop={1}>
          <Text dimColor>
            Running:{' '}
            <Text color="yellow">
              {currentHook.pluginName || 'settings'}/{currentHook.name}
            </Text>
          </Text>
        </Box>
      )}

      {/* Detailed results */}
      <Box flexDirection="column" marginTop={1}>
        {Array.from(results.values()).map((result) => (
          <TestResultDisplay
            key={`${result.hook.source}-${result.hook.hookType}-${result.hook.name}`}
            result={result}
          />
        ))}
      </Box>

      {isComplete && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>{'═'.repeat(60)}</Text>
          <Text bold>SUMMARY</Text>
          <Box flexDirection="column" marginLeft={2}>
            <Box>
              <Text dimColor>Total hooks: </Text>
              <Text bold>{hooks.length}</Text>
            </Box>
            <Box>
              <Text dimColor>Passed: </Text>
              <Text color="green" bold>
                {passed}
              </Text>
            </Box>
            <Box>
              <Text dimColor>Failed: </Text>
              <Text color={failed > 0 ? 'red' : 'gray'} bold>
                {failed}
              </Text>
            </Box>
            <Box>
              <Text dimColor>Total time: </Text>
              <Text color="cyan" bold>
                {formatDuration(totalDuration)}
              </Text>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

/**
 * Main test runner
 */
async function runHookTest(
  hookType?: string,
  options: { payload?: boolean; command?: string } = {}
): Promise<void> {
  const claudePluginHooks = collectClaudePluginHooks();
  const settingsHooks = collectSettingsHooks();
  const pluginHooks = collectPluginHooks();
  // Claude plugin hooks first (they execute first in Claude Code)
  const allHooks = [...claudePluginHooks, ...settingsHooks, ...pluginHooks];

  // Filter by hook type if specified
  let hooksToTest = hookType
    ? allHooks.filter(
        (h) => h.hookType.toLowerCase() === hookType.toLowerCase()
      )
    : allHooks;

  // Filter by specific command if specified
  if (options.command) {
    const cmdFilter = options.command;
    hooksToTest = hooksToTest.filter((h) => h.command.includes(cmdFilter));
  }

  if (hooksToTest.length === 0) {
    console.log('No hooks found matching criteria.');
    if (hookType) {
      console.log(`Hook type: ${hookType}`);
    }
    if (options.command) {
      console.log(`Command filter: ${options.command}`);
    }
    console.log('\nAvailable hook types:');
    const types = [...new Set(allHooks.map((h) => h.hookType))].sort();
    for (const t of types) {
      const count = allHooks.filter((h) => h.hookType === t).length;
      console.log(`  ${t}: ${count} hook(s)`);
    }
    return;
  }

  // Generate stdin payload
  const testHookType = hookType || hooksToTest[0]?.hookType || 'SessionStart';
  const stdinPayload = generateStdinPayload(testHookType);

  // Check if we have a TTY for interactive UI
  const isTTY = process.stdin.isTTY && process.stdout.isTTY;

  if (isTTY) {
    // Interactive mode with Ink UI
    await runWithUI(hooksToTest, stdinPayload, options.payload ?? false);
  } else {
    // Non-interactive mode
    await runWithConsole(hooksToTest, stdinPayload, options.payload ?? false);
  }
}

async function runWithUI(
  hooks: TestableHook[],
  stdinPayload: string,
  showPayload: boolean
): Promise<void> {
  return new Promise((resolve) => {
    const results = new Map<string, TestResult>();
    const phaseStats = new Map<string, PhaseStats>();
    let currentPhase: string | null = null;
    let currentHook: TestableHook | null = null;
    let isComplete = false;
    let totalDuration = 0;
    const overallStartTime = Date.now();

    // Group hooks by type and initialize phase stats
    const hooksByType = new Map<string, TestableHook[]>();
    for (const hook of hooks) {
      const existing = hooksByType.get(hook.hookType) || [];
      existing.push(hook);
      hooksByType.set(hook.hookType, existing);

      if (!phaseStats.has(hook.hookType)) {
        phaseStats.set(hook.hookType, {
          hookType: hook.hookType,
          hookCount: 0,
          passed: 0,
          failed: 0,
          totalDuration: 0,
        });
      }
      const stats = phaseStats.get(hook.hookType);
      if (stats) stats.hookCount++;
    }

    const doRender = () => {
      rerender(
        <HookTestUI
          hooks={hooks}
          results={results}
          phaseStats={phaseStats}
          currentPhase={currentPhase}
          currentHook={currentHook}
          showPayload={showPayload}
          stdinPayload={stdinPayload}
          isComplete={isComplete}
          totalDuration={totalDuration}
        />
      );
    };

    const { rerender, unmount } = render(
      <HookTestUI
        hooks={hooks}
        results={results}
        phaseStats={phaseStats}
        currentPhase={currentPhase}
        currentHook={currentHook}
        showPayload={showPayload}
        stdinPayload={stdinPayload}
        isComplete={isComplete}
        totalDuration={totalDuration}
      />
    );

    const handleSigInt = () => {
      unmount();
      process.exit(130);
    };
    process.on('SIGINT', handleSigInt);

    (async () => {
      let hasFailures = false;

      // Run hooks grouped by phase (hook type)
      for (const [hookType, phaseHooks] of hooksByType) {
        currentPhase = hookType;
        const phaseStartTime = Date.now();
        const stats = phaseStats.get(hookType);
        if (!stats) continue;

        for (const hook of phaseHooks) {
          currentHook = hook;
          doRender();

          const result = await executeHook(
            hook,
            generateStdinPayload(hook.hookType)
          );
          const key = `${hook.source}-${hook.hookType}-${hook.name}`;
          results.set(key, result);

          // Update phase stats
          if (result.success) {
            stats.passed++;
          } else {
            stats.failed++;
            hasFailures = true;
          }

          doRender();
        }

        // Record phase duration
        stats.totalDuration = Date.now() - phaseStartTime;
        doRender();
      }

      isComplete = true;
      currentPhase = null;
      currentHook = null;
      totalDuration = Date.now() - overallStartTime;
      doRender();

      setTimeout(() => {
        process.off('SIGINT', handleSigInt);
        unmount();
        resolve();
        process.exit(hasFailures ? 1 : 0);
      }, 100);
    })();
  });
}

async function runWithConsole(
  hooks: TestableHook[],
  _stdinPayload: string,
  showPayload: boolean
): Promise<void> {
  const overallStartTime = Date.now();

  console.log('═'.repeat(60));
  console.log('HOOK TEST - Simulating Claude Code Hook Execution');
  console.log('═'.repeat(60));

  // Group hooks by type
  const hooksByType = new Map<string, TestableHook[]>();
  for (const hook of hooks) {
    const existing = hooksByType.get(hook.hookType) || [];
    existing.push(hook);
    hooksByType.set(hook.hookType, existing);
  }

  // Sort phases
  const eventOrder = [
    'Setup',
    'SessionStart',
    'UserPromptSubmit',
    'PreToolUse',
    'PermissionRequest',
    'PostToolUse',
    'PostToolUseFailure',
    'SubagentStart',
    'SubagentStop',
    'Stop',
    'PreCompact',
    'SessionEnd',
    'Notification',
  ];
  const sortedPhases = Array.from(hooksByType.keys()).sort((a, b) => {
    const aIdx = eventOrder.indexOf(a);
    const bIdx = eventOrder.indexOf(b);
    if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  console.log(`\nPhases: ${sortedPhases.join(', ')}`);
  console.log(`Testing ${hooks.length} hook(s)...\n`);

  let totalPassed = 0;
  let totalFailed = 0;
  const phaseResults: {
    phase: string;
    passed: number;
    failed: number;
    duration: number;
  }[] = [];

  for (const hookType of sortedPhases) {
    const phaseHooks = hooksByType.get(hookType);
    if (!phaseHooks) continue;
    const phaseStartTime = Date.now();
    const payload = generateStdinPayload(hookType);

    console.log(`─ ${hookType} (${phaseHooks.length} hooks)`);

    if (showPayload) {
      console.log(
        '  Payload:',
        `${payload.replace(/\n/g, ' ').slice(0, 100)}...`
      );
    }

    let phasePassed = 0;
    let phaseFailed = 0;

    for (const hook of phaseHooks) {
      const result = await executeHook(hook, payload);
      const statusIcon = result.success ? '✓' : '✗';
      let source: string;
      let sourceTag = '';
      if (hook.source === 'claude-plugin') {
        source = `${hook.pluginName}/${hook.name}`;
        sourceTag = ' [Claude plugin]';
      } else if (hook.source === 'plugin') {
        source = `${hook.pluginName}/${hook.name}`;
      } else {
        source = `settings/${hook.name}`;
      }

      console.log(
        `  ${statusIcon} ${source}${sourceTag} (${result.duration}ms)`
      );

      if (result.stdout && result.stdout.length > 0) {
        const preview = result.stdout.slice(0, 100).replace(/\n/g, ' ');
        console.log(
          `    stdout: ${preview}${result.stdout.length > 100 ? '...' : ''}`
        );
      }

      // Show bug warning for affected hooks
      const affectedByBug = isAffectedByOutputBug(hook);
      if (affectedByBug && result.stdout && result.stdout.length > 0) {
        console.log(`    ⚠ Claude would see: (nothing - output discarded)`);
        console.log(
          `    Bug: Plugin hooks.json output not captured for ${hook.hookType}`
        );
        console.log(`    See: github.com/anthropics/claude-code/issues/12151`);
      }

      if (result.stderr && result.stderr.length > 0) {
        const preview = result.stderr.slice(0, 100).replace(/\n/g, ' ');
        console.log(
          `    stderr: ${preview}${result.stderr.length > 100 ? '...' : ''}`
        );
      }
      if (result.timedOut) {
        console.log('    [TIMEOUT]');
      }
      if (result.exitCode !== null && result.exitCode !== 0) {
        console.log(`    [exit ${result.exitCode}]`);
      }

      if (result.success) {
        phasePassed++;
        totalPassed++;
      } else {
        phaseFailed++;
        totalFailed++;
      }
    }

    const phaseDuration = Date.now() - phaseStartTime;
    phaseResults.push({
      phase: hookType,
      passed: phasePassed,
      failed: phaseFailed,
      duration: phaseDuration,
    });

    console.log(`  Phase total: ${formatDuration(phaseDuration)}\n`);
  }

  const totalDuration = Date.now() - overallStartTime;

  console.log('═'.repeat(60));
  console.log('SUMMARY');
  console.log('─'.repeat(60));

  // Phase timing breakdown
  console.log('\nPhase Timing:');
  for (const { phase, passed, failed, duration } of phaseResults) {
    const status = failed > 0 ? '✗' : '✓';
    console.log(
      `  ${status} ${phase}: ${passed}/${passed + failed} passed, ${formatDuration(duration)}`
    );
  }

  console.log('\nTotals:');
  console.log(`  Hooks: ${hooks.length}`);
  console.log(`  Passed: ${totalPassed}`);
  console.log(`  Failed: ${totalFailed}`);
  console.log(`  Total time: ${formatDuration(totalDuration)}`);

  process.exit(totalFailed > 0 ? 1 : 0);
}

export function registerHookTest(hookCommand: Command): void {
  hookCommand
    .command('test [hookType]')
    .description(
      'Test hooks by running them with simulated Claude Code input.\n' +
        'Shows all hooks (Han plugins + Claude Code settings) and their actual output.\n\n' +
        'This helps debug hook failures by running hooks exactly as Claude Code would.\n\n' +
        'Examples:\n' +
        '  han hook test                    # Test all hooks\n' +
        '  han hook test SessionStart       # Test only SessionStart hooks\n' +
        '  han hook test Stop --payload     # Show the stdin payload sent to hooks\n' +
        '  han hook test --command "han"    # Test hooks containing \'han\' in command'
    )
    .option('--payload', 'Show the stdin JSON payload sent to hooks')
    .option(
      '--command <substring>',
      'Filter to hooks whose command contains this string'
    )
    .action(
      (
        hookType: string | undefined,
        options: { payload?: boolean; command?: string }
      ) => {
        runHookTest(hookType, options);
      }
    );
}
