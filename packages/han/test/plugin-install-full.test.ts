/**
 * Tests for plugin-install.ts
 * Full coverage tests with mocked dependencies
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from 'bun:test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Mock the marketplace-cache module to avoid network calls
const mockPlugins = [
  {
    name: 'core',
    description: 'Core plugin',
    category: 'Core',
    keywords: ['core'],
  },
  {
    name: 'bushido',
    description: 'Bushido principles',
    category: 'Core',
    keywords: ['bushido'],
  },
  {
    name: 'typescript',
    description: 'TypeScript type checking',
    category: 'Technique',
    keywords: ['typescript', 'types'],
  },
  {
    name: 'react',
    description: 'React patterns',
    category: 'Technique',
    keywords: ['react', 'jsx'],
  },
  {
    name: 'github',
    description: 'GitHub integration',
    category: 'Bridge',
    keywords: ['github', 'git'],
  },
  {
    name: 'accessibility',
    description: 'Accessibility testing',
    category: 'Discipline',
    keywords: ['a11y', 'wcag'],
  },
];

mock.module('../lib/marketplace-cache.ts', () => ({
  getMarketplacePlugins: mock(() =>
    Promise.resolve({
      plugins: mockPlugins,
      fromCache: true,
    })
  ),
  updateMarketplaceCache: mock(() => Promise.resolve(mockPlugins)),
  getCacheAge: mock(() => 0),
  hasCachedMarketplace: mock(() => true),
}));

// Mock the plugin-selector-wrapper to avoid Ink UI
mock.module('../lib/plugins/plugin-selector-wrapper.tsx', () => ({
  showPluginSelector: mock(() => Promise.resolve(['typescript'])),
}));

// Skip Claude CLI so tests use direct settings modification (respects our test directory)
process.env.HAN_SKIP_CLAUDE_CLI = '1';

// Import after mocks are set up
import { installPlugin, installPlugins } from '../lib/plugins/index.ts';

describe('plugin-install.ts', () => {
  const testDir = `/tmp/test-plugin-install-full-${Date.now()}`;
  let consoleLogSpy: ReturnType<typeof spyOn>;
  let consoleErrorSpy: ReturnType<typeof spyOn>;
  let processExitSpy: ReturnType<typeof spyOn>;
  let logs: string[] = [];
  let errors: string[] = [];
  let exitCode: number | null = null;
  let originalEnv: string | undefined;
  let originalCwd: () => string;

  beforeEach(() => {
    // Save original environment
    originalEnv = process.env.CLAUDE_CONFIG_DIR;
    originalCwd = process.cwd;

    // Set up test environment
    process.env.CLAUDE_CONFIG_DIR = join(testDir, 'project');
    process.cwd = () => join(testDir, 'project');

    // Create directories
    mkdirSync(join(testDir, 'project'), { recursive: true });
    mkdirSync(join(testDir, 'project', '.claude'), { recursive: true });

    // Capture console output
    logs = [];
    errors = [];
    exitCode = null;
    consoleLogSpy = spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });
    consoleErrorSpy = spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.join(' '));
    });
    processExitSpy = spyOn(process, 'exit').mockImplementation((code) => {
      exitCode = code as number;
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();

    // Restore environment
    if (originalEnv) {
      process.env.CLAUDE_CONFIG_DIR = originalEnv;
    } else {
      delete process.env.CLAUDE_CONFIG_DIR;
    }
    process.cwd = originalCwd;

    rmSync(testDir, { recursive: true, force: true });
  });

  describe('installPlugins', () => {
    test('exits with error when no plugin names provided', async () => {
      try {
        await installPlugins([]);
      } catch {
        // process.exit throws
      }

      expect(errors.join('\n')).toContain('No plugin names provided');
      expect(exitCode).toBe(1);
    });

    test('always includes bushido as dependency', async () => {
      // Create empty settings
      writeFileSync(
        join(testDir, 'project', '.claude', 'settings.json'),
        JSON.stringify({})
      );

      await installPlugins(['typescript'], 'project');

      const settings = JSON.parse(
        readFileSync(
          join(testDir, 'project', '.claude', 'settings.json'),
          'utf-8'
        )
      );
      expect(settings.enabledPlugins['bushido@han']).toBe(true);
      expect(settings.enabledPlugins['typescript@han']).toBe(true);
    });

    test('installs valid plugins', async () => {
      writeFileSync(
        join(testDir, 'project', '.claude', 'settings.json'),
        JSON.stringify({})
      );

      await installPlugins(['typescript'], 'project');

      const allLogs = logs.join('\n');
      expect(allLogs).toContain('Installed');
      expect(allLogs).toContain('typescript');

      const settings = JSON.parse(
        readFileSync(
          join(testDir, 'project', '.claude', 'settings.json'),
          'utf-8'
        )
      );
      expect(settings.enabledPlugins['typescript@han']).toBe(true);
    });

    test('adds Han marketplace to settings', async () => {
      writeFileSync(
        join(testDir, 'project', '.claude', 'settings.json'),
        JSON.stringify({})
      );

      await installPlugins(['typescript'], 'project');

      const settings = JSON.parse(
        readFileSync(
          join(testDir, 'project', '.claude', 'settings.json'),
          'utf-8'
        )
      );
      expect(settings.extraKnownMarketplaces?.han).toBeDefined();
      expect(settings.extraKnownMarketplaces.han.source.repo).toBe(
        'thebushidocollective/han'
      );
    });

    test('reports already installed plugins', async () => {
      writeFileSync(
        join(testDir, 'project', '.claude', 'settings.json'),
        JSON.stringify({
          enabledPlugins: {
            'typescript@han': true,
            'bushido@han': true,
          },
          extraKnownMarketplaces: {
            han: {
              source: { source: 'github', repo: 'thebushidocollective/han' },
            },
          },
        })
      );

      await installPlugins(['typescript'], 'project');

      const allLogs = logs.join('\n');
      expect(allLogs).toContain('Already installed');
    });

    test('installs multiple plugins at once', async () => {
      writeFileSync(
        join(testDir, 'project', '.claude', 'settings.json'),
        JSON.stringify({})
      );

      await installPlugins(['typescript', 'github'], 'project');

      const settings = JSON.parse(
        readFileSync(
          join(testDir, 'project', '.claude', 'settings.json'),
          'utf-8'
        )
      );
      expect(settings.enabledPlugins['typescript@han']).toBe(true);
      expect(settings.enabledPlugins['github@han']).toBe(true);
      expect(settings.enabledPlugins['bushido@han']).toBe(true);
    });

    test('shows restart message after installation', async () => {
      writeFileSync(
        join(testDir, 'project', '.claude', 'settings.json'),
        JSON.stringify({})
      );

      await installPlugins(['typescript'], 'project');

      const allLogs = logs.join('\n');
      expect(allLogs).toContain('restart Claude Code');
    });

    test('works with project scope', async () => {
      writeFileSync(
        join(testDir, 'project', '.claude', 'settings.json'),
        JSON.stringify({})
      );

      await installPlugins(['typescript'], 'project');

      const settings = JSON.parse(
        readFileSync(
          join(testDir, 'project', '.claude', 'settings.json'),
          'utf-8'
        )
      );
      expect(settings.enabledPlugins['typescript@han']).toBe(true);
    });

    test('works with local scope', async () => {
      writeFileSync(
        join(testDir, 'project', '.claude', 'settings.local.json'),
        JSON.stringify({})
      );

      await installPlugins(['typescript'], 'local');

      const settings = JSON.parse(
        readFileSync(
          join(testDir, 'project', '.claude', 'settings.local.json'),
          'utf-8'
        )
      );
      expect(settings.enabledPlugins['typescript@han']).toBe(true);
    });
  });

  describe('installPlugin', () => {
    test('is convenience wrapper for installPlugins', async () => {
      writeFileSync(
        join(testDir, 'project', '.claude', 'settings.json'),
        JSON.stringify({})
      );

      await installPlugin('typescript', 'project');

      const settings = JSON.parse(
        readFileSync(
          join(testDir, 'project', '.claude', 'settings.json'),
          'utf-8'
        )
      );
      expect(settings.enabledPlugins['typescript@han']).toBe(true);
    });
  });

  describe('showAvailablePlugins output', () => {
    test('shows categorized plugins on invalid plugin error', async () => {
      writeFileSync(
        join(testDir, 'project', '.claude', 'settings.json'),
        JSON.stringify({})
      );

      try {
        // Try to install multiple invalid plugins (triggers the error path)
        await installPlugins(['invalid1', 'invalid2'], 'project');
      } catch {
        // process.exit throws
      }

      const allErrors = errors.join('\n');
      expect(allErrors).toContain('not found in Han marketplace');
      expect(allErrors).toContain('Available plugins');
    });
  });

  describe('searchForPlugin internal function', () => {
    test.skip('searches by name match', async () => {
      // TODO: This test is skipped because Bun's mock.module doesn't properly
      // intercept imports when the module (shared.ts) imports from marketplace-cache.ts
      // at the top level. The mock is set up but fetchMarketplace() still calls
      // the real getMarketplacePlugins(). The search functionality is still tested
      // in integration tests via real marketplace calls.
      writeFileSync(
        join(testDir, 'project', '.claude', 'settings.json'),
        JSON.stringify({})
      );

      await installPlugins(['ts'], 'project');

      const settings = JSON.parse(
        readFileSync(
          join(testDir, 'project', '.claude', 'settings.json'),
          'utf-8'
        )
      );
      expect(settings.enabledPlugins['typescript@han']).toBe(true);
    });
  });
});
