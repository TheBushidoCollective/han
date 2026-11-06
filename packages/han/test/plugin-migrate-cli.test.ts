import { afterEach, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const packageRoot = resolve(import.meta.dir, '..');
const entry = join(packageRoot, 'lib/main.ts');
let fixture = '';

afterEach(() => {
  if (fixture) rmSync(fixture, { recursive: true, force: true });
});

describe('han plugin migrate CLI subprocess execution', () => {
  test('migrates settings files, preserves conflicting settings, and is idempotent', () => {
    fixture = realpathSync(mkdtempSync(join(tmpdir(), 'han-migrate-cli-')));
    const home = join(fixture, 'home');
    const project = join(fixture, 'project');
    const userClaudeDir = join(home, '.claude');
    const projectClaudeDir = join(project, '.claude');

    mkdirSync(userClaudeDir, { recursive: true });
    mkdirSync(projectClaudeDir, { recursive: true });

    const userSettingsPath = join(userClaudeDir, 'settings.json');
    const projectSettingsPath = join(projectClaudeDir, 'settings.json');

    // User settings have an old name to migrate and conflicting enabled/disabled entries.
    const initialUserSettings = {
      enabledPlugins: {
        'jutsu-react@han': true,
        'jutsu-typescript@han': true,
        'typescript@han': false,
        'bushido@han': true,
      },
      mcpServers: {
        custom: { command: 'node', args: ['server.js'] },
      },
    };

    // Project settings have an old discipline plugin name to migrate.
    const initialProjectSettings = {
      enabledPlugins: {
        'do-frontend-development@han': true,
      },
    };

    writeFileSync(
      userSettingsPath,
      JSON.stringify(initialUserSettings, null, 2)
    );
    writeFileSync(
      projectSettingsPath,
      JSON.stringify(initialProjectSettings, null, 2)
    );

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: home,
      CLAUDE_CONFIG_DIR: userClaudeDir,
      HAN_DATA_DIR: join(fixture, 'han-data'),
    };
    delete env.CLAUDE_PROJECT_DIR;
    delete env.CLAUDE_PLUGIN_ROOT;
    delete env.CLAUDE_SESSION_ID;

    const runCli = (args: string[]) =>
      spawnSync(process.execPath, [entry, 'plugin', 'migrate', ...args], {
        cwd: project,
        env,
        encoding: 'utf8',
        timeout: 30000,
      });

    // First CLI execution: migrate with explicit project path.
    const firstRun = runCli(['-p', project]);
    expect(firstRun.error).toBeUndefined();
    expect(firstRun.status).toBe(0);

    // Verify stdout shows the migrated plugins.
    expect(firstRun.stdout).toContain('jutsu-react@han -> react@han');
    expect(firstRun.stdout).toContain(
      'do-frontend-development@han -> frontend-development@han'
    );

    // Verify stderr reports the conflicting settings for typescript@han.
    expect(firstRun.stderr).toContain(
      'Conflicting settings for typescript@han'
    );

    // Verify user settings on disk after first migration:
    const migratedUser = JSON.parse(readFileSync(userSettingsPath, 'utf8')) as {
      enabledPlugins: Record<string, boolean>;
      mcpServers: typeof initialUserSettings.mcpServers;
    };
    expect(migratedUser.enabledPlugins['react@han']).toBe(true);
    expect(migratedUser.enabledPlugins['jutsu-react@han']).toBeUndefined();
    expect(migratedUser.enabledPlugins['bushido@han']).toBe(true);
    // Conflicting entries must be preserved to avoid loss of user configuration:
    expect(migratedUser.enabledPlugins['jutsu-typescript@han']).toBe(true);
    expect(migratedUser.enabledPlugins['typescript@han']).toBe(false);
    // Unrelated settings fields must be preserved:
    expect(migratedUser.mcpServers).toEqual(initialUserSettings.mcpServers);

    // Verify project settings on disk after first migration:
    const migratedProject = JSON.parse(
      readFileSync(projectSettingsPath, 'utf8')
    ) as { enabledPlugins: Record<string, boolean> };
    expect(migratedProject.enabledPlugins['frontend-development@han']).toBe(
      true
    );
    expect(
      migratedProject.enabledPlugins['do-frontend-development@han']
    ).toBeUndefined();

    // Snapshot file bytes after first run.
    const userSnapshot = readFileSync(userSettingsPath, 'utf8');
    const projectSnapshot = readFileSync(projectSettingsPath, 'utf8');

    // Second CLI execution: idempotence check.
    const secondRun = runCli(['-p', project]);
    expect(secondRun.error).toBeUndefined();
    expect(secondRun.status).toBe(0);

    // Verify no newly migrated plugin announcements.
    expect(secondRun.stdout).not.toContain('Migrated plugin names:');

    // Stderr still notes unresolved conflict, but files remain untouched.
    expect(secondRun.stderr).toContain(
      'Conflicting settings for typescript@han'
    );
    expect(readFileSync(userSettingsPath, 'utf8')).toBe(userSnapshot);
    expect(readFileSync(projectSettingsPath, 'utf8')).toBe(projectSnapshot);

    // Third CLI execution: verbose mode on already migrated settings.
    const verboseRun = runCli(['-p', project, '-v']);
    expect(verboseRun.error).toBeUndefined();
    expect(verboseRun.status).toBe(0);
    expect(readFileSync(userSettingsPath, 'utf8')).toBe(userSnapshot);
    expect(readFileSync(projectSettingsPath, 'utf8')).toBe(projectSnapshot);
  });
});
