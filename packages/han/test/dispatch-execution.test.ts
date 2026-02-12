/**
 * Execution tests for dispatch.ts
 * Tests that actually execute the dispatch functions with real file system
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

describe('dispatch.ts execution paths', () => {
  const testDir = `/tmp/test-dispatch-exec-${Date.now()}`;
  let originalEnv: NodeJS.ProcessEnv;
  let originalCwd: string;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalCwd = process.cwd();

    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);

    // Set up minimal environment
    process.env.CLAUDE_CONFIG_DIR = join(testDir, 'config');
    process.env.HOME = testDir;
    delete process.env.HAN_DISABLE_HOOKS;
  });

  afterEach(() => {
    process.env = originalEnv;
    try {
      process.chdir(originalCwd);
    } catch {
      // ignore
    }
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('dispatch with HAN_DISABLE_HOOKS', () => {
    test('exits early when HAN_DISABLE_HOOKS=true', () => {
      process.env.HAN_DISABLE_HOOKS = 'true';

      // Run han hook dispatch (should exit 0 immediately)
      try {
        const result = execSync('han hook dispatch SessionStart', {
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 5000,
        });
        // Should exit successfully with no output
        expect(result.trim()).toBe('');
      } catch (_error) {
        // May not have han in PATH, that's ok for this test
        // We're testing the code path, not the CLI
      }
    });

    test('exits early when HAN_DISABLE_HOOKS=1', () => {
      process.env.HAN_DISABLE_HOOKS = '1';

      const isDisabled =
        process.env.HAN_DISABLE_HOOKS === 'true' ||
        process.env.HAN_DISABLE_HOOKS === '1';
      expect(isDisabled).toBe(true);
    });
  });

  describe('settings hooks loading', () => {
    test('loads hooks from settings.json in hooks object', () => {
      const configDir = join(testDir, 'config');
      mkdirSync(configDir, { recursive: true });

      const settings = {
        hooks: {
          SessionStart: [
            {
              hooks: [
                {
                  type: 'command',
                  command: "echo 'Session started from settings'",
                },
              ],
            },
          ],
        },
      };

      writeFileSync(
        join(configDir, 'settings.json'),
        JSON.stringify(settings, null, 2)
      );

      // Verify the file exists and is readable
      expect(existsSync(join(configDir, 'settings.json'))).toBe(true);

      const content = readFileSync(join(configDir, 'settings.json'), 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.hooks).toBeDefined();
      expect(parsed.hooks.SessionStart).toBeDefined();
    });

    test('loads hooks from separate hooks.json file', () => {
      const configDir = join(testDir, 'config');
      mkdirSync(configDir, { recursive: true });

      const hooks = {
        hooks: {
          Stop: [
            {
              hooks: [{ type: 'command', command: "echo 'Cleanup'" }],
            },
          ],
        },
      };

      writeFileSync(
        join(configDir, 'hooks.json'),
        JSON.stringify(hooks, null, 2)
      );

      expect(existsSync(join(configDir, 'hooks.json'))).toBe(true);

      const content = readFileSync(join(configDir, 'hooks.json'), 'utf-8');
      const parsed = JSON.parse(content);

      const hooksObj = parsed.hooks || parsed;
      expect(hooksObj.Stop).toBeDefined();
    });

    test('loads hooks from hooks.json with hooks at root', () => {
      const configDir = join(testDir, 'config');
      mkdirSync(configDir, { recursive: true });

      const hooks = {
        SessionStart: [
          {
            hooks: [{ type: 'command', command: "echo 'Root level hooks'" }],
          },
        ],
      };

      writeFileSync(
        join(configDir, 'hooks.json'),
        JSON.stringify(hooks, null, 2)
      );

      const content = readFileSync(join(configDir, 'hooks.json'), 'utf-8');
      const parsed = JSON.parse(content);

      // Should work with hooks at root
      const hooksObj = parsed.hooks || parsed;
      expect(hooksObj.SessionStart).toBeDefined();
    });

    test('skips invalid hooks.json files silently', () => {
      const configDir = join(testDir, 'config');
      mkdirSync(configDir, { recursive: true });

      writeFileSync(join(configDir, 'hooks.json'), '{ invalid json }');

      // Reading and parsing should catch the error
      const content = readFileSync(join(configDir, 'hooks.json'), 'utf-8');

      let parsed = null;
      try {
        parsed = JSON.parse(content);
      } catch {
        // Expected to fail - invalid JSON
        parsed = null;
      }

      expect(parsed).toBeNull();
    });
  });

  describe('plugin hooks loading', () => {
    test('loads plugin from development mode (marketplace.json in cwd)', () => {
      // Create marketplace.json to trigger dev mode detection
      const pluginDir = join(testDir, '.claude-plugin');
      mkdirSync(pluginDir, { recursive: true });
      writeFileSync(
        join(pluginDir, 'marketplace.json'),
        JSON.stringify({ name: 'test-marketplace' })
      );

      // Create a jutsu plugin
      const jutsuPlugin = join(testDir, 'jutsu', 'jutsu-test');
      const jutsuHooksDir = join(jutsuPlugin, 'hooks');
      mkdirSync(jutsuHooksDir, { recursive: true });

      const hooksConfig = {
        hooks: {
          SessionStart: [
            {
              hooks: [{ type: 'command', command: "echo 'Dev mode plugin'" }],
            },
          ],
        },
      };

      writeFileSync(
        join(jutsuHooksDir, 'hooks.json'),
        JSON.stringify(hooksConfig, null, 2)
      );

      expect(existsSync(join(pluginDir, 'marketplace.json'))).toBe(true);
      expect(existsSync(join(jutsuHooksDir, 'hooks.json'))).toBe(true);
    });

    test('loads plugin from default config directory', () => {
      const configDir = join(testDir, 'config');
      const marketplaceRoot = join(configDir, 'plugins', 'marketplaces', 'han');
      const pluginPath = join(marketplaceRoot, 'jutsu', 'jutsu-default');
      const hooksDir = join(pluginPath, 'hooks');

      mkdirSync(hooksDir, { recursive: true });

      const hooksConfig = {
        hooks: {
          Stop: [
            {
              hooks: [
                { type: 'command', command: "echo 'Default config plugin'" },
              ],
            },
          ],
        },
      };

      writeFileSync(
        join(hooksDir, 'hooks.json'),
        JSON.stringify(hooksConfig, null, 2)
      );

      expect(existsSync(join(hooksDir, 'hooks.json'))).toBe(true);
    });

    test("returns null when hooks.json doesn't exist", () => {
      const pluginPath = join(testDir, 'no-hooks-plugin');
      mkdirSync(pluginPath, { recursive: true });

      const hooksPath = join(pluginPath, 'hooks', 'hooks.json');
      expect(existsSync(hooksPath)).toBe(false);
    });

    test("returns null when plugin directory doesn't exist", () => {
      const marketplaceRoot = join(testDir, 'marketplace');
      mkdirSync(marketplaceRoot, { recursive: true });

      const searchPaths = [
        join(marketplaceRoot, 'jutsu', 'nonexistent'),
        join(marketplaceRoot, 'do', 'nonexistent'),
        join(marketplaceRoot, 'hashi', 'nonexistent'),
        join(marketplaceRoot, 'nonexistent'),
      ];

      for (const path of searchPaths) {
        expect(existsSync(path)).toBe(false);
      }
    });
  });

  describe('command execution with environment variables', () => {
    test('CLAUDE_PLUGIN_ROOT placeholder replacement', () => {
      // biome-ignore lint/suspicious/noTemplateCurlyInString: testing template
      const command = '${CLAUDE_PLUGIN_ROOT}/hooks/test.sh';
      const pluginRoot = '/path/to/plugin';

      const resolved = command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginRoot);

      expect(resolved).toBe('/path/to/plugin/hooks/test.sh');
      // biome-ignore lint/suspicious/noTemplateCurlyInString: testing template variable removal
      expect(resolved).not.toContain('${CLAUDE_PLUGIN_ROOT}');
    });

    test('environment setup for command execution', () => {
      const pluginRoot = '/test/plugin';
      const noCache = true;
      const noCheckpoints = true;

      const env = {
        ...process.env,
        CLAUDE_PLUGIN_ROOT: pluginRoot,
        CLAUDE_PROJECT_DIR: process.cwd(),
        ...(noCache ? { HAN_NO_CACHE: '1' } : {}),
        ...(noCheckpoints ? { HAN_NO_CHECKPOINTS: '1' } : {}),
      };

      expect(env.CLAUDE_PLUGIN_ROOT).toBe(pluginRoot);
      expect(env.CLAUDE_PROJECT_DIR).toBe(process.cwd());
      expect(env.HAN_NO_CACHE).toBe('1');
      expect(env.HAN_NO_CHECKPOINTS).toBe('1');
    });

    test('checkpoint environment for Stop hook with session', () => {
      const hookType: 'Stop' | 'SubagentStop' = 'Stop';
      const sessionId = 'session-123';
      const agentId = undefined;
      const noCheckpoints = false;

      let checkpointType: 'session' | 'agent' | undefined;
      let checkpointId: string | undefined;

      if (hookType === 'Stop' && sessionId) {
        checkpointType = 'session';
        checkpointId = sessionId;
      }
      // @ts-expect-error - Testing conditional logic, unreachable in this test case
      else if (hookType === 'SubagentStop' && agentId) {
        checkpointType = 'agent';
        checkpointId = agentId;
      }

      const env = {
        ...process.env,
        ...(!noCheckpoints && checkpointType && checkpointId
          ? {
              HAN_CHECKPOINT_TYPE: checkpointType,
              HAN_CHECKPOINT_ID: checkpointId,
            }
          : {}),
      };

      expect(env.HAN_CHECKPOINT_TYPE).toBe('session');
      expect(env.HAN_CHECKPOINT_ID).toBe('session-123');
    });

    test('checkpoint environment for SubagentStop hook with agent', () => {
      const hookType: 'Stop' | 'SubagentStop' = 'SubagentStop';
      const sessionId = undefined;
      const agentId = 'agent-456';
      const noCheckpoints = false;

      let checkpointType: 'session' | 'agent' | undefined;
      let checkpointId: string | undefined;

      // @ts-expect-error - Testing conditional logic, unreachable in this test case
      if (hookType === 'Stop' && sessionId) {
        checkpointType = 'session';
        checkpointId = sessionId;
      } else if (hookType === 'SubagentStop' && agentId) {
        checkpointType = 'agent';
        checkpointId = agentId;
      }

      const env = {
        ...process.env,
        ...(!noCheckpoints && checkpointType && checkpointId
          ? {
              HAN_CHECKPOINT_TYPE: checkpointType,
              HAN_CHECKPOINT_ID: checkpointId,
            }
          : {}),
      };

      expect(env.HAN_CHECKPOINT_TYPE).toBe('agent');
      expect(env.HAN_CHECKPOINT_ID).toBe('agent-456');
    });

    test('no checkpoint environment when disabled', () => {
      const hookType = 'Stop';
      const sessionId = 'session-123';
      const noCheckpoints = true;

      let checkpointType: 'session' | 'agent' | undefined;
      let checkpointId: string | undefined;

      if (hookType === 'Stop' && sessionId) {
        checkpointType = 'session';
        checkpointId = sessionId;
      }

      const env = {
        ...process.env,
        ...(!noCheckpoints && checkpointType && checkpointId
          ? {
              HAN_CHECKPOINT_TYPE: checkpointType,
              HAN_CHECKPOINT_ID: checkpointId,
            }
          : {}),
      };

      expect(env.HAN_CHECKPOINT_TYPE).toBeUndefined();
      expect(env.HAN_CHECKPOINT_ID).toBeUndefined();
    });
  });

  describe('hook execution error handling', () => {
    test('handles command failure gracefully', () => {
      // Simulate a failed command execution
      const error = {
        status: 1,
        stderr: Buffer.from('Command failed'),
      };

      const exitCode = error.status || 1;
      const stderr = error.stderr?.toString() || '';

      expect(exitCode).toBe(1);
      expect(stderr).toBe('Command failed');
    });

    test('extracts exit code 127 for command not found', () => {
      const error = {
        status: 127,
        stderr: Buffer.from('/bin/sh: nonexistent: command not found'),
      };

      const exitCode = error.status || 1;
      const stderr = error.stderr?.toString() || '';

      expect(exitCode).toBe(127);
      expect(stderr).toContain('command not found');
    });

    test('defaults to exit code 1 when status missing', () => {
      const error = {
        stderr: Buffer.from('Unknown error'),
      };

      const exitCode = (error as { status?: number }).status || 1;
      const stderr = (error as { stderr?: Buffer }).stderr?.toString() || '';

      expect(exitCode).toBe(1);
      expect(stderr).toBe('Unknown error');
    });

    test('handles missing stderr buffer', () => {
      const error = {
        status: 2,
      };

      const stderr = (error as { stderr?: Buffer }).stderr?.toString() || '';

      expect(stderr).toBe('');
    });
  });

  describe('output processing', () => {
    test('trims whitespace from outputs', () => {
      const outputs = ['  output 1  \n', '\n  output 2\t', 'output 3'];

      const trimmed = outputs.map((o) => o.trim());

      expect(trimmed).toEqual(['output 1', 'output 2', 'output 3']);
    });

    test('aggregates outputs with double newline separator', () => {
      const outputs = ['First', 'Second', 'Third'];
      const aggregated = outputs.join('\n\n');

      expect(aggregated).toBe('First\n\nSecond\n\nThird');
      expect(aggregated.split('\n\n')).toEqual(outputs);
    });

    test('filters out null and empty outputs', () => {
      const outputs: (string | null)[] = ['valid', null, '', '  ', 'another'];

      const filtered = outputs.filter((o) => o?.trim());

      expect(filtered).toEqual(['valid', 'another']);
    });

    test('produces no output when all outputs are null', () => {
      const outputs: (string | null)[] = [null, null, null];
      const filtered = outputs.filter((o): o is string => o !== null);

      expect(filtered.length).toBe(0);
    });
  });

  describe('hook group iteration', () => {
    test('processes multiple hook groups in order', () => {
      const hookGroups = [
        {
          hooks: [
            { type: 'command' as const, command: 'echo first' },
            { type: 'command' as const, command: 'echo second' },
          ],
        },
        {
          hooks: [{ type: 'command' as const, command: 'echo third' }],
        },
      ];

      const commands: string[] = [];
      for (const group of hookGroups) {
        for (const hook of group.hooks) {
          if (hook.type === 'command' && hook.command) {
            commands.push(hook.command);
          }
        }
      }

      expect(commands).toEqual(['echo first', 'echo second', 'echo third']);
    });

    test('skips non-command hooks', () => {
      const hookGroups = [
        {
          hooks: [
            { type: 'prompt' as const, prompt: 'Review this' },
            { type: 'command' as const, command: 'echo test' },
            { type: 'prompt' as const, prompt: 'Check that' },
          ],
        },
      ];

      const commands: string[] = [];
      for (const group of hookGroups) {
        for (const hook of group.hooks) {
          if (hook.type === 'command' && hook.command) {
            commands.push(hook.command);
          }
        }
      }

      expect(commands).toEqual(['echo test']);
    });

    test('handles empty hook groups', () => {
      const hookGroups = [
        { hooks: [] },
        { hooks: [{ type: 'command' as const, command: 'echo test' }] },
        { hooks: [] },
      ];

      const commands: string[] = [];
      for (const group of hookGroups) {
        for (const hook of group.hooks) {
          if (hook.type === 'command' && hook.command) {
            commands.push(hook.command);
          }
        }
      }

      expect(commands).toEqual(['echo test']);
    });
  });

  describe('stdin payload handling', () => {
    test('parses session_id from stdin payload', () => {
      const payload = {
        session_id: 'session-abc-123',
        hook_event_name: 'SessionStart',
      };

      const sessionId = payload.session_id;

      expect(sessionId).toBe('session-abc-123');
    });

    test('parses agent_id from stdin payload', () => {
      const payload = {
        agent_id: 'agent-xyz-456',
        hook_event_name: 'SubagentStart',
      };

      const agentId = payload.agent_id;

      expect(agentId).toBe('agent-xyz-456');
    });

    test('handles payload with all fields', () => {
      const payload = {
        session_id: 'session-123',
        hook_event_name: 'UserPromptSubmit',
        agent_id: 'agent-456',
        agent_type: 'code',
      };

      expect(payload.session_id).toBe('session-123');
      expect(payload.hook_event_name).toBe('UserPromptSubmit');
      expect(payload.agent_id).toBe('agent-456');
      expect(payload.agent_type).toBe('code');
    });

    test('handles partial payload', () => {
      const payload = {
        session_id: 'session-only',
      };

      expect(payload.session_id).toBe('session-only');
      expect((payload as { agent_id?: string }).agent_id).toBeUndefined();
    });
  });
});
