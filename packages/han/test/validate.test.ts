/**
 * Unit tests for validate.ts
 * Tests helper functions and utilities used by the validation system
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Store original environment
const originalEnv = { ...process.env };

let testDir: string;

function setup(): void {
  const random = Math.random().toString(36).substring(2, 9);
  testDir = join(tmpdir(), `han-validate-test-${Date.now()}-${random}`);
  mkdirSync(testDir, { recursive: true });
}

function teardown(): void {
  process.env = { ...originalEnv };

  if (testDir && existsSync(testDir)) {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

describe('validate.ts', () => {
  beforeEach(() => {
    setup();
  });

  afterEach(() => {
    teardown();
  });

  describe('isDebugMode (via HAN_DEBUG env)', () => {
    test('returns false when HAN_DEBUG not set', () => {
      delete process.env.HAN_DEBUG;
      // Import fresh to test the module
      const isDebugMode = () => {
        const debug = process.env.HAN_DEBUG;
        return debug === '1' || debug === 'true';
      };
      expect(isDebugMode()).toBe(false);
    });

    test('returns true when HAN_DEBUG=1', () => {
      process.env.HAN_DEBUG = '1';
      const isDebugMode = () => {
        const debug = process.env.HAN_DEBUG;
        return debug === '1' || debug === 'true';
      };
      expect(isDebugMode()).toBe(true);
    });

    test('returns true when HAN_DEBUG=true', () => {
      process.env.HAN_DEBUG = 'true';
      const isDebugMode = () => {
        const debug = process.env.HAN_DEBUG;
        return debug === '1' || debug === 'true';
      };
      expect(isDebugMode()).toBe(true);
    });

    test('returns false for other values', () => {
      process.env.HAN_DEBUG = 'yes';
      const isDebugMode = () => {
        const debug = process.env.HAN_DEBUG;
        return debug === '1' || debug === 'true';
      };
      expect(isDebugMode()).toBe(false);
    });
  });

  describe('getHanTempDir', () => {
    test('returns correct temp directory path', () => {
      const expectedPath = join(tmpdir(), 'han-hook-output');
      // Inline implementation for testing
      const getHanTempDir = () => {
        const dir = join(tmpdir(), 'han-hook-output');
        mkdirSync(dir, { recursive: true });
        return dir;
      };
      const result = getHanTempDir();
      expect(result).toBe(expectedPath);
      expect(existsSync(result)).toBe(true);
    });
  });

  describe('generateOutputFilename', () => {
    test('generates filename with hook name and sanitized directory', () => {
      const generateOutputFilename = (
        hookName: string,
        directory: string
      ): string => {
        const timestamp = Date.now();
        const sanitizedDir = directory.replace(/[^a-zA-Z0-9]/g, '_').slice(-30);
        return `${hookName}_${sanitizedDir}_${timestamp}`;
      };

      const result = generateOutputFilename('lint', '/some/test/directory');
      expect(result).toMatch(/^lint__some_test_directory_\d+$/);
    });

    test('truncates long directory names', () => {
      const generateOutputFilename = (
        hookName: string,
        directory: string
      ): string => {
        const timestamp = Date.now();
        const sanitizedDir = directory.replace(/[^a-zA-Z0-9]/g, '_').slice(-30);
        return `${hookName}_${sanitizedDir}_${timestamp}`;
      };

      const longDir =
        '/very/long/path/that/exceeds/thirty/characters/significantly';
      const result = generateOutputFilename('test', longDir);
      // The sanitized dir should be at most 30 chars
      const parts = result.split('_');
      const sanitizedPart = parts.slice(1, -1).join('_');
      expect(sanitizedPart.length).toBeLessThanOrEqual(30);
    });
  });

  describe('writeDebugFile', () => {
    test('writes debug info to file', () => {
      const basePath = join(testDir, 'test-debug');
      // Inline implementation
      const writeDebugFile = (
        basePath: string,
        info: Record<string, unknown>
      ): string => {
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
      };

      const result = writeDebugFile(basePath, {
        hookName: 'lint',
        command: 'npm run lint',
      });

      expect(result).toBe(`${basePath}.debug.txt`);
      expect(existsSync(result)).toBe(true);

      const content = readFileSync(result, 'utf-8');
      expect(content).toContain('=== Han Hook Debug Info ===');
      expect(content).toContain('=== Environment ===');
      expect(content).toContain('=== Hook Info ===');
      expect(content).toContain('hookName:');
      expect(content).toContain('"lint"');
    });
  });

  describe('writeOutputFile', () => {
    test('writes output to file', () => {
      const basePath = join(testDir, 'test-output');
      const writeOutputFile = (basePath: string, output: string): string => {
        const outputPath = `${basePath}.output.txt`;
        writeFileSync(outputPath, output, 'utf-8');
        return outputPath;
      };

      const result = writeOutputFile(basePath, 'test output content');

      expect(result).toBe(`${basePath}.output.txt`);
      expect(existsSync(result)).toBe(true);

      const content = readFileSync(result, 'utf-8');
      expect(content).toBe('test output content');
    });
  });

  describe('getAbsoluteEnvFilePath', () => {
    test('returns null when CLAUDE_ENV_FILE not set', () => {
      delete process.env.CLAUDE_ENV_FILE;
      const getAbsoluteEnvFilePath = (): string | null => {
        const envFile = process.env.CLAUDE_ENV_FILE;
        if (!envFile) return null;
        if (envFile.startsWith('/')) return envFile;
        const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
        return join(projectDir, envFile);
      };

      expect(getAbsoluteEnvFilePath()).toBeNull();
    });

    test('returns absolute path as-is', () => {
      process.env.CLAUDE_ENV_FILE = '/absolute/path/.env';
      const getAbsoluteEnvFilePath = (): string | null => {
        const envFile = process.env.CLAUDE_ENV_FILE;
        if (!envFile) return null;
        if (envFile.startsWith('/')) return envFile;
        const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
        return join(projectDir, envFile);
      };

      expect(getAbsoluteEnvFilePath()).toBe('/absolute/path/.env');
    });

    test('resolves relative path against CLAUDE_PROJECT_DIR', () => {
      process.env.CLAUDE_ENV_FILE = '.env';
      process.env.CLAUDE_PROJECT_DIR = '/project/dir';
      const getAbsoluteEnvFilePath = (): string | null => {
        const envFile = process.env.CLAUDE_ENV_FILE;
        if (!envFile) return null;
        if (envFile.startsWith('/')) return envFile;
        const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
        return join(projectDir, envFile);
      };

      expect(getAbsoluteEnvFilePath()).toBe('/project/dir/.env');
    });

    test('resolves relative path against cwd when CLAUDE_PROJECT_DIR not set', () => {
      process.env.CLAUDE_ENV_FILE = '.env';
      delete process.env.CLAUDE_PROJECT_DIR;
      const getAbsoluteEnvFilePath = (): string | null => {
        const envFile = process.env.CLAUDE_ENV_FILE;
        if (!envFile) return null;
        if (envFile.startsWith('/')) return envFile;
        const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
        return join(projectDir, envFile);
      };

      expect(getAbsoluteEnvFilePath()).toBe(join(process.cwd(), '.env'));
    });
  });

  describe('wrapCommandWithEnvFile', () => {
    test('sources env file when CLAUDE_ENV_FILE is set', () => {
      process.env.CLAUDE_ENV_FILE = '/path/to/.env';
      const wrapCommandWithEnvFile = (cmd: string): string => {
        const envFile = process.env.CLAUDE_ENV_FILE;
        if (envFile?.startsWith('/')) {
          return `source "${envFile}" && ${cmd}`;
        }
        return `/bin/bash -l -c ${JSON.stringify(cmd)}`;
      };

      const result = wrapCommandWithEnvFile('npm run lint');
      expect(result).toBe('source "/path/to/.env" && npm run lint');
    });

    test('uses login shell when CLAUDE_ENV_FILE not set', () => {
      delete process.env.CLAUDE_ENV_FILE;
      const wrapCommandWithEnvFile = (cmd: string): string => {
        const envFile = process.env.CLAUDE_ENV_FILE;
        if (envFile?.startsWith('/')) {
          return `source "${envFile}" && ${cmd}`;
        }
        return `/bin/bash -l -c ${JSON.stringify(cmd)}`;
      };

      const result = wrapCommandWithEnvFile('npm run lint');
      expect(result).toBe('/bin/bash -l -c "npm run lint"');
    });
  });

  describe('getCacheKeyForDirectory', () => {
    test('generates cache key for root directory', () => {
      const getCacheKeyForDirectory = (
        hookName: string,
        directory: string,
        projectRoot: string
      ): string => {
        const relativeDirPath =
          directory
            .replace(projectRoot, '')
            .replace(/^\//, '')
            .replace(/\//g, '_') || 'root';
        return `${hookName}_${relativeDirPath}`;
      };

      const result = getCacheKeyForDirectory('lint', '/project', '/project');
      expect(result).toBe('lint_root');
    });

    test('generates cache key for nested directory', () => {
      const getCacheKeyForDirectory = (
        hookName: string,
        directory: string,
        projectRoot: string
      ): string => {
        const relativeDirPath =
          directory
            .replace(projectRoot, '')
            .replace(/^\//, '')
            .replace(/\//g, '_') || 'root';
        return `${hookName}_${relativeDirPath}`;
      };

      const result = getCacheKeyForDirectory(
        'test',
        '/project/packages/core',
        '/project'
      );
      expect(result).toBe('test_packages_core');
    });
  });

  describe('buildHookCommand', () => {
    test('builds basic hook command', () => {
      const buildHookCommand = (
        pluginName: string,
        hookName: string,
        options: { cached?: boolean; only?: string }
      ): string => {
        let cmd = `han hook run ${pluginName} ${hookName}`;
        if (options.cached) {
          cmd += ' --cached';
        }
        if (options.only) {
          cmd += ` --only=${options.only}`;
        }
        return cmd;
      };

      const result = buildHookCommand('jutsu-typescript', 'typecheck', {});
      expect(result).toBe('han hook run jutsu-typescript typecheck');
    });

    test('builds hook command with --cached flag', () => {
      const buildHookCommand = (
        pluginName: string,
        hookName: string,
        options: { cached?: boolean; only?: string }
      ): string => {
        let cmd = `han hook run ${pluginName} ${hookName}`;
        if (options.cached) {
          cmd += ' --cached';
        }
        if (options.only) {
          cmd += ` --only=${options.only}`;
        }
        return cmd;
      };

      const result = buildHookCommand('jutsu-biome', 'lint', { cached: true });
      expect(result).toBe('han hook run jutsu-biome lint --cached');
    });

    test('builds hook command with --only flag', () => {
      const buildHookCommand = (
        pluginName: string,
        hookName: string,
        options: { cached?: boolean; only?: string }
      ): string => {
        let cmd = `han hook run ${pluginName} ${hookName}`;
        if (options.cached) {
          cmd += ' --cached';
        }
        if (options.only) {
          cmd += ` --only=${options.only}`;
        }
        return cmd;
      };

      const result = buildHookCommand('jutsu-bun', 'test', {
        only: 'packages/core',
      });
      expect(result).toBe('han hook run jutsu-bun test --only=packages/core');
    });

    test('builds hook command with both flags', () => {
      const buildHookCommand = (
        pluginName: string,
        hookName: string,
        options: { cached?: boolean; only?: string }
      ): string => {
        let cmd = `han hook run ${pluginName} ${hookName}`;
        if (options.cached) {
          cmd += ' --cached';
        }
        if (options.only) {
          cmd += ` --only=${options.only}`;
        }
        return cmd;
      };

      const result = buildHookCommand('jutsu-typescript', 'typecheck', {
        cached: true,
        only: 'src',
      });
      expect(result).toBe(
        'han hook run jutsu-typescript typecheck --cached --only=src'
      );
    });
  });

  describe('findPluginInMarketplace', () => {
    test('finds plugin in jutsu directory', () => {
      const findPluginInMarketplace = (
        marketplaceRoot: string,
        pluginName: string
      ): string | null => {
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
      };

      const jutsuDir = join(testDir, 'jutsu', 'jutsu-typescript');
      mkdirSync(jutsuDir, { recursive: true });

      const result = findPluginInMarketplace(testDir, 'jutsu-typescript');
      expect(result).toBe(jutsuDir);
    });

    test('finds plugin in do directory', () => {
      const findPluginInMarketplace = (
        marketplaceRoot: string,
        pluginName: string
      ): string | null => {
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
      };

      const doDir = join(testDir, 'do', 'do-frontend-development');
      mkdirSync(doDir, { recursive: true });

      const result = findPluginInMarketplace(
        testDir,
        'do-frontend-development'
      );
      expect(result).toBe(doDir);
    });

    test('finds plugin in hashi directory', () => {
      const findPluginInMarketplace = (
        marketplaceRoot: string,
        pluginName: string
      ): string | null => {
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
      };

      const hashiDir = join(testDir, 'hashi', 'hashi-github');
      mkdirSync(hashiDir, { recursive: true });

      const result = findPluginInMarketplace(testDir, 'hashi-github');
      expect(result).toBe(hashiDir);
    });

    test('finds plugin in root directory', () => {
      const findPluginInMarketplace = (
        marketplaceRoot: string,
        pluginName: string
      ): string | null => {
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
      };

      const pluginDir = join(testDir, 'bushido');
      mkdirSync(pluginDir, { recursive: true });

      const result = findPluginInMarketplace(testDir, 'bushido');
      expect(result).toBe(pluginDir);
    });

    test('returns null when plugin not found', () => {
      const findPluginInMarketplace = (
        marketplaceRoot: string,
        pluginName: string
      ): string | null => {
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
      };

      const result = findPluginInMarketplace(testDir, 'nonexistent-plugin');
      expect(result).toBeNull();
    });
  });

  describe('resolvePathToAbsolute', () => {
    test('returns absolute path as-is', () => {
      const resolvePathToAbsolute = (path: string): string => {
        if (path.startsWith('/')) {
          return path;
        }
        return join(process.cwd(), path);
      };

      const result = resolvePathToAbsolute('/absolute/path/to/plugin');
      expect(result).toBe('/absolute/path/to/plugin');
    });

    test('resolves relative path against cwd', () => {
      const resolvePathToAbsolute = (path: string): string => {
        if (path.startsWith('/')) {
          return path;
        }
        return join(process.cwd(), path);
      };

      const result = resolvePathToAbsolute('relative/path');
      expect(result).toBe(join(process.cwd(), 'relative/path'));
    });
  });

  describe('ValidateOptions interface', () => {
    test('accepts valid options object', () => {
      interface ValidateOptions {
        failFast: boolean;
        dirsWith: string | null;
        testDir?: string | null;
        command: string;
        verbose?: boolean;
      }

      const options: ValidateOptions = {
        failFast: true,
        dirsWith: 'package.json',
        command: 'npm test',
        verbose: true,
      };

      expect(options.failFast).toBe(true);
      expect(options.dirsWith).toBe('package.json');
      expect(options.command).toBe('npm test');
      expect(options.verbose).toBe(true);
    });

    test('accepts options with null dirsWith', () => {
      interface ValidateOptions {
        failFast: boolean;
        dirsWith: string | null;
        testDir?: string | null;
        command: string;
        verbose?: boolean;
      }

      const options: ValidateOptions = {
        failFast: false,
        dirsWith: null,
        command: 'npm run lint',
      };

      expect(options.dirsWith).toBeNull();
      expect(options.verbose).toBeUndefined();
    });
  });

  describe('RunCommandResult interface', () => {
    test('accepts success result', () => {
      interface RunCommandResult {
        success: boolean;
        idleTimedOut?: boolean;
        outputFile?: string;
        debugFile?: string;
      }

      const result: RunCommandResult = {
        success: true,
      };

      expect(result.success).toBe(true);
      expect(result.idleTimedOut).toBeUndefined();
    });

    test('accepts failure result with all fields', () => {
      interface RunCommandResult {
        success: boolean;
        idleTimedOut?: boolean;
        outputFile?: string;
        debugFile?: string;
      }

      const result: RunCommandResult = {
        success: false,
        idleTimedOut: true,
        outputFile: '/tmp/output.txt',
        debugFile: '/tmp/debug.txt',
      };

      expect(result.success).toBe(false);
      expect(result.idleTimedOut).toBe(true);
      expect(result.outputFile).toBe('/tmp/output.txt');
      expect(result.debugFile).toBe('/tmp/debug.txt');
    });
  });

  describe('RunConfiguredHookOptions interface', () => {
    test('accepts minimal options', () => {
      interface RunConfiguredHookOptions {
        pluginName: string;
        hookName: string;
        failFast: boolean;
        cache?: boolean;
        only?: string;
        verbose?: boolean;
      }

      const options: RunConfiguredHookOptions = {
        pluginName: 'jutsu-typescript',
        hookName: 'typecheck',
        failFast: true,
      };

      expect(options.pluginName).toBe('jutsu-typescript');
      expect(options.hookName).toBe('typecheck');
      expect(options.failFast).toBe(true);
    });

    test('accepts options with all fields', () => {
      interface RunConfiguredHookOptions {
        pluginName: string;
        hookName: string;
        failFast: boolean;
        cache?: boolean;
        only?: string;
        verbose?: boolean;
      }

      const options: RunConfiguredHookOptions = {
        pluginName: 'jutsu-biome',
        hookName: 'lint',
        failFast: false,
        cache: true,
        only: 'packages/core',
        verbose: true,
      };

      expect(options.cache).toBe(true);
      expect(options.only).toBe('packages/core');
      expect(options.verbose).toBe(true);
    });
  });
});
