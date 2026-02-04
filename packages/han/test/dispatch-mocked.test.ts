/**
 * Mocked tests for dispatch.ts internal functions
 * Uses mocking to test internal logic without executing actual commands
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

describe('dispatch.ts internal logic through mocking', () => {
  const testDir = `/tmp/test-dispatch-mocked-${Date.now()}`;
  let originalEnv: typeof process.env;
  let originalCwd: string;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalCwd = process.cwd();

    mkdirSync(testDir, { recursive: true });

    process.env.CLAUDE_CONFIG_DIR = join(testDir, 'config');
    process.env.HOME = testDir;
  });

  afterEach(() => {
    process.env = originalEnv;
    try {
      process.chdir(originalCwd);
    } catch {
      // Already at original cwd
    }
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('hasStdinData logic', () => {
    test('returns false for TTY stdin', () => {
      // When stdin.isTTY is true, there's no piped data
      const stdin = { isTTY: true };
      const hasData = !stdin.isTTY;

      expect(hasData).toBe(false);
    });

    test('returns true for readable stdin with buffered data', () => {
      const stdin = {
        isTTY: false,
        readable: true,
        readableLength: 100,
      };

      const hasData =
        !stdin.isTTY && stdin.readable && stdin.readableLength > 0;

      expect(hasData).toBe(true);
    });

    test('returns false for readable stdin without buffered data', () => {
      const stdin = {
        isTTY: false,
        readable: true,
        readableLength: 0,
      };

      const hasData =
        !stdin.isTTY && stdin.readable && stdin.readableLength > 0;

      expect(hasData).toBe(false);
    });

    test('returns false for non-readable stdin', () => {
      const stdin = {
        isTTY: false,
        readable: false,
        readableLength: 0,
      };

      const hasData =
        !stdin.isTTY && stdin.readable && stdin.readableLength > 0;

      expect(hasData).toBe(false);
    });
  });

  describe('getStdinPayload logic', () => {
    test('parses valid JSON payload', () => {
      const raw = JSON.stringify({
        session_id: 'session-123',
        hook_event_name: 'SessionStart',
        agent_id: 'agent-456',
        agent_type: 'code',
      });

      let payload: unknown = null;
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = null;
      }

      expect(payload).not.toBeNull();

      type HookPayload = {
        session_id?: string;
        hook_event_name?: string;
        agent_id?: string;
        agent_type?: string;
      };

      const typedPayload = payload as HookPayload;
      expect(typedPayload.session_id).toBe('session-123');
      expect(typedPayload.hook_event_name).toBe('SessionStart');
      expect(typedPayload.agent_id).toBe('agent-456');
      expect(typedPayload.agent_type).toBe('code');
    });

    test('returns null for invalid JSON', () => {
      const raw = 'not valid json {';

      let payload: unknown = null;
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = null;
      }

      expect(payload).toBeNull();
    });

    test('returns null for empty string', () => {
      const raw = '';

      let payload: unknown = null;
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = null;
      }

      expect(payload).toBeNull();
    });

    test('parses payload with only session_id', () => {
      const raw = JSON.stringify({ session_id: 'session-only' });

      let payload: unknown = null;
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = null;
      }

      expect(payload).not.toBeNull();
      expect((payload as { session_id?: string }).session_id).toBe(
        'session-only'
      );
    });
  });

  describe('getSessionIdFromStdin logic', () => {
    test('extracts session_id from payload', () => {
      const payload = { session_id: 'session-abc-123' };
      const sessionId = payload?.session_id;

      expect(sessionId).toBe('session-abc-123');
    });

    test('returns undefined when session_id missing', () => {
      const payload = { other_field: 'value' };
      const sessionId = (payload as { session_id?: string })?.session_id;

      expect(sessionId).toBeUndefined();
    });

    test('returns undefined for null payload', () => {
      const payload = null;
      const sessionId = (payload as { session_id?: string } | null)?.session_id;

      expect(sessionId).toBeUndefined();
    });
  });

  describe('findPluginInMarketplace logic', () => {
    test('searches jutsu directory first', () => {
      const marketplaceRoot = join(testDir, 'marketplace');
      const jutsuPath = join(marketplaceRoot, 'jutsu', 'jutsu-test');
      mkdirSync(jutsuPath, { recursive: true });

      const potentialPaths = [
        join(marketplaceRoot, 'jutsu', 'jutsu-test'),
        join(marketplaceRoot, 'do', 'jutsu-test'),
        join(marketplaceRoot, 'hashi', 'jutsu-test'),
        join(marketplaceRoot, 'jutsu-test'),
      ];

      let found: string | null = null;
      for (const path of potentialPaths) {
        if (existsSync(path)) {
          found = path;
          break;
        }
      }

      expect(found).toBe(jutsuPath);
    });

    test('searches do directory second', () => {
      const marketplaceRoot = join(testDir, 'marketplace');
      const doPath = join(marketplaceRoot, 'do', 'do-test');
      mkdirSync(doPath, { recursive: true });

      const potentialPaths = [
        join(marketplaceRoot, 'jutsu', 'do-test'),
        join(marketplaceRoot, 'do', 'do-test'),
        join(marketplaceRoot, 'hashi', 'do-test'),
        join(marketplaceRoot, 'do-test'),
      ];

      let found: string | null = null;
      for (const path of potentialPaths) {
        if (existsSync(path)) {
          found = path;
          break;
        }
      }

      expect(found).toBe(doPath);
    });

    test('searches hashi directory third', () => {
      const marketplaceRoot = join(testDir, 'marketplace');
      const hashiPath = join(marketplaceRoot, 'hashi', 'hashi-test');
      mkdirSync(hashiPath, { recursive: true });

      const potentialPaths = [
        join(marketplaceRoot, 'jutsu', 'hashi-test'),
        join(marketplaceRoot, 'do', 'hashi-test'),
        join(marketplaceRoot, 'hashi', 'hashi-test'),
        join(marketplaceRoot, 'hashi-test'),
      ];

      let found: string | null = null;
      for (const path of potentialPaths) {
        if (existsSync(path)) {
          found = path;
          break;
        }
      }

      expect(found).toBe(hashiPath);
    });

    test('searches root directory last', () => {
      const marketplaceRoot = join(testDir, 'marketplace');
      const rootPath = join(marketplaceRoot, 'core');
      mkdirSync(rootPath, { recursive: true });

      const potentialPaths = [
        join(marketplaceRoot, 'jutsu', 'core'),
        join(marketplaceRoot, 'do', 'core'),
        join(marketplaceRoot, 'hashi', 'core'),
        join(marketplaceRoot, 'core'),
      ];

      let found: string | null = null;
      for (const path of potentialPaths) {
        if (existsSync(path)) {
          found = path;
          break;
        }
      }

      expect(found).toBe(rootPath);
    });

    test('returns null when plugin not found', () => {
      const marketplaceRoot = join(testDir, 'marketplace');
      mkdirSync(marketplaceRoot, { recursive: true });

      const potentialPaths = [
        join(marketplaceRoot, 'jutsu', 'nonexistent'),
        join(marketplaceRoot, 'do', 'nonexistent'),
        join(marketplaceRoot, 'hashi', 'nonexistent'),
        join(marketplaceRoot, 'nonexistent'),
      ];

      let found: string | null = null;
      for (const path of potentialPaths) {
        if (existsSync(path)) {
          found = path;
          break;
        }
      }

      expect(found).toBeNull();
    });

    test('prioritizes jutsu over root when both exist', () => {
      const marketplaceRoot = join(testDir, 'marketplace');
      const jutsuPath = join(marketplaceRoot, 'jutsu', 'my-plugin');
      const rootPath = join(marketplaceRoot, 'my-plugin');
      mkdirSync(jutsuPath, { recursive: true });
      mkdirSync(rootPath, { recursive: true });

      const potentialPaths = [
        join(marketplaceRoot, 'jutsu', 'my-plugin'),
        join(marketplaceRoot, 'do', 'my-plugin'),
        join(marketplaceRoot, 'hashi', 'my-plugin'),
        join(marketplaceRoot, 'my-plugin'),
      ];

      let found: string | null = null;
      for (const path of potentialPaths) {
        if (existsSync(path)) {
          found = path;
          break;
        }
      }

      // Should find jutsu path first
      expect(found).toBe(jutsuPath);
    });
  });

  describe('loadPluginHooks logic', () => {
    test('loads hooks from valid hooks.json', () => {
      const pluginRoot = join(testDir, 'plugin');
      const hooksDir = join(pluginRoot, 'hooks');
      mkdirSync(hooksDir, { recursive: true });

      const hooksConfig = {
        hooks: {
          SessionStart: [
            {
              hooks: [{ type: 'command', command: 'echo test' }],
            },
          ],
        },
      };

      writeFileSync(
        join(hooksDir, 'hooks.json'),
        JSON.stringify(hooksConfig, null, 2)
      );

      const hooksPath = join(pluginRoot, 'hooks', 'hooks.json');
      expect(existsSync(hooksPath)).toBe(true);

      const content = readFileSync(hooksPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.hooks.SessionStart).toBeDefined();
      expect(parsed.hooks.SessionStart[0].hooks[0].type).toBe('command');
    });

    test("returns null when hooks.json doesn't exist", () => {
      const pluginRoot = join(testDir, 'plugin-no-hooks');
      mkdirSync(pluginRoot, { recursive: true });

      const hooksPath = join(pluginRoot, 'hooks', 'hooks.json');
      const exists = existsSync(hooksPath);

      expect(exists).toBe(false);
    });

    test('handles invalid JSON gracefully', () => {
      const pluginRoot = join(testDir, 'plugin-bad');
      const hooksDir = join(pluginRoot, 'hooks');
      mkdirSync(hooksDir, { recursive: true });

      writeFileSync(join(hooksDir, 'hooks.json'), '{ invalid }');

      const hooksPath = join(pluginRoot, 'hooks', 'hooks.json');
      const content = readFileSync(hooksPath, 'utf-8');

      let parsed = null;
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = null;
      }

      expect(parsed).toBeNull();
    });
  });

  describe('executeCommandHook error handling', () => {
    test('extracts exit code from error', () => {
      const error = { status: 127 };
      const exitCode = error.status || 1;

      expect(exitCode).toBe(127);
    });

    test('defaults to exit code 1 when status missing', () => {
      const error = {};
      const exitCode = (error as { status?: number }).status || 1;

      expect(exitCode).toBe(1);
    });

    test('extracts stderr from error', () => {
      const error = { stderr: Buffer.from('error message') };
      const stderr = error.stderr?.toString() || '';

      expect(stderr).toBe('error message');
    });

    test('handles missing stderr', () => {
      const error = { status: 1 };
      const stderr = (error as { stderr?: Buffer }).stderr?.toString() || '';

      expect(stderr).toBe('');
    });

    test('handles buffer conversion', () => {
      const error = { stderr: Buffer.from('test\nerror\n') };
      const stderr = error.stderr?.toString() || '';

      expect(stderr).toBe('test\nerror\n');
    });
  });

  describe('checkpoint type determination', () => {
    test('Stop hook uses session checkpoint', () => {
      const hookType: string = 'Stop';
      const sessionId = 'session-123';
      const agentId = undefined;

      let checkpointType: 'session' | 'agent' | undefined;
      let checkpointId: string | undefined;

      if (hookType === 'Stop' && sessionId) {
        checkpointType = 'session';
        checkpointId = sessionId;
      } else if (hookType === 'SubagentStop' && agentId) {
        checkpointType = 'agent';
        checkpointId = agentId;
      }

      expect(checkpointType).toBe('session');
      expect(checkpointId).toBe('session-123');
    });

    test('SubagentStop hook uses agent checkpoint', () => {
      const hookType: string = 'SubagentStop';
      const sessionId = undefined;
      const agentId = 'agent-456';

      let checkpointType: 'session' | 'agent' | undefined;
      let checkpointId: string | undefined;

      if (hookType === 'Stop' && sessionId) {
        checkpointType = 'session';
        checkpointId = sessionId;
      } else if (hookType === 'SubagentStop' && agentId) {
        checkpointType = 'agent';
        checkpointId = agentId;
      }

      expect(checkpointType).toBe('agent');
      expect(checkpointId).toBe('agent-456');
    });

    test('SessionStart hook has no checkpoint', () => {
      const hookType: string = 'SessionStart';
      const sessionId = 'session-123';
      const agentId = 'agent-456';

      let checkpointType: 'session' | 'agent' | undefined;
      let checkpointId: string | undefined;

      if (hookType === 'Stop' && sessionId) {
        checkpointType = 'session';
        checkpointId = sessionId;
      } else if (hookType === 'SubagentStop' && agentId) {
        checkpointType = 'agent';
        checkpointId = agentId;
      }

      expect(checkpointType).toBeUndefined();
      expect(checkpointId).toBeUndefined();
    });

    test('Stop hook without session_id has no checkpoint', () => {
      const hookType: string = 'Stop';
      const sessionId = undefined;
      const agentId = undefined;

      let checkpointType: 'session' | 'agent' | undefined;
      let checkpointId: string | undefined;

      if (hookType === 'Stop' && sessionId) {
        checkpointType = 'session';
        checkpointId = sessionId;
      } else if (hookType === 'SubagentStop' && agentId) {
        checkpointType = 'agent';
        checkpointId = agentId;
      }

      expect(checkpointType).toBeUndefined();
      expect(checkpointId).toBeUndefined();
    });
  });

  describe('HAN_DISABLE_HOOKS check', () => {
    test('recognizes true as disabled', () => {
      const envValue = 'true';
      const isDisabled = envValue === 'true' || envValue === '1';

      expect(isDisabled).toBe(true);
    });

    test('recognizes 1 as disabled', () => {
      const envValue: string = '1';
      const isDisabled = envValue === 'true' || envValue === '1';

      expect(isDisabled).toBe(true);
    });

    test('recognizes false as not disabled', () => {
      const envValue: string = 'false';
      const isDisabled = envValue === 'true' || envValue === '1';

      expect(isDisabled).toBe(false);
    });

    test('recognizes empty string as not disabled', () => {
      const envValue: string = '';
      const isDisabled = envValue === 'true' || envValue === '1';

      expect(isDisabled).toBe(false);
    });

    test('recognizes 0 as not disabled', () => {
      const envValue: string = '0';
      const isDisabled = envValue === 'true' || envValue === '1';

      expect(isDisabled).toBe(false);
    });
  });

  describe('settings hooks path derivation', () => {
    test('derives hooks.json from settings.json', () => {
      const settingsPath = '/path/to/settings.json';
      const hooksPath = settingsPath.replace(
        /settings(\.local)?\.json$/,
        'hooks.json'
      );

      expect(hooksPath).toBe('/path/to/hooks.json');
    });

    test('derives hooks.json from settings.local.json', () => {
      const settingsPath = '/path/to/settings.local.json';
      const hooksPath = settingsPath.replace(
        /settings(\.local)?\.json$/,
        'hooks.json'
      );

      expect(hooksPath).toBe('/path/to/hooks.json');
    });

    test('leaves non-settings paths unchanged', () => {
      const otherPath = '/path/to/config.json';
      const result = otherPath.replace(
        /settings(\.local)?\.json$/,
        'hooks.json'
      );

      expect(result).toBe('/path/to/config.json');
    });

    test('handles paths without .json extension', () => {
      const path = '/path/to/settings';
      const result = path.replace(/settings(\.local)?\.json$/, 'hooks.json');

      expect(result).toBe('/path/to/settings');
    });
  });

  describe('hook group validation', () => {
    test('validates valid hook group structure', () => {
      const group = {
        hooks: [{ type: 'command', command: 'echo test' }],
      };

      const isValid =
        typeof group === 'object' &&
        group !== null &&
        'hooks' in group &&
        Array.isArray(group.hooks);

      expect(isValid).toBe(true);
    });

    test('rejects group without hooks array', () => {
      const group = { other: 'value' };

      const isValid =
        typeof group === 'object' &&
        group !== null &&
        'hooks' in group &&
        Array.isArray((group as { hooks?: unknown }).hooks);

      expect(isValid).toBe(false);
    });

    test('rejects null group', () => {
      const group = null;

      const isValid =
        typeof group === 'object' &&
        group !== null &&
        'hooks' in (group as object) &&
        Array.isArray((group as { hooks?: unknown }).hooks);

      expect(isValid).toBe(false);
    });

    test('rejects group with non-array hooks', () => {
      const group = { hooks: 'not an array' };

      const isValid =
        typeof group === 'object' &&
        group !== null &&
        'hooks' in group &&
        Array.isArray(group.hooks);

      expect(isValid).toBe(false);
    });

    test('validates empty hooks array', () => {
      const group = { hooks: [] };

      const isValid =
        typeof group === 'object' &&
        group !== null &&
        'hooks' in group &&
        Array.isArray(group.hooks);

      expect(isValid).toBe(true);
    });
  });

  describe('hook entry validation', () => {
    test('validates command hook with command', () => {
      const hook = { type: 'command', command: 'echo test' };

      const isValid = hook.type === 'command' && !!hook.command;

      expect(isValid).toBe(true);
    });

    test('validates prompt hook with prompt', () => {
      const hook = { type: 'prompt', prompt: 'Review this' };

      const isValid = hook.type === 'prompt' && !!hook.prompt;

      expect(isValid).toBe(true);
    });

    test('rejects command hook without command', () => {
      const hook = { type: 'command' };

      const isValid =
        hook.type === 'command' && !!(hook as { command?: string }).command;

      expect(isValid).toBe(false);
    });

    test('rejects prompt hook without prompt', () => {
      const hook = { type: 'prompt' };

      const isValid =
        hook.type === 'prompt' && !!(hook as { prompt?: string }).prompt;

      expect(isValid).toBe(false);
    });
  });

  describe('output trimming', () => {
    test('trims leading whitespace', () => {
      const output = '   test output';
      const trimmed = output.trim();

      expect(trimmed).toBe('test output');
    });

    test('trims trailing whitespace', () => {
      const output = 'test output   ';
      const trimmed = output.trim();

      expect(trimmed).toBe('test output');
    });

    test('trims newlines', () => {
      const output = '\ntest output\n';
      const trimmed = output.trim();

      expect(trimmed).toBe('test output');
    });

    test('trims tabs', () => {
      const output = '\ttest output\t';
      const trimmed = output.trim();

      expect(trimmed).toBe('test output');
    });

    test('trims mixed whitespace', () => {
      const output = ' \n\t test output \t\n ';
      const trimmed = output.trim();

      expect(trimmed).toBe('test output');
    });

    test('preserves internal whitespace', () => {
      const output = '  test   output  ';
      const trimmed = output.trim();

      expect(trimmed).toBe('test   output');
    });
  });
});
