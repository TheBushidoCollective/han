import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { buildCommandWithFiles } from '../lib/hooks/transcript-filter.ts';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const pluginFile = join(
  packageRoot,
  '../../plugins/validation/biome/han-plugin.yml'
);
const definition = parse(readFileSync(pluginFile, 'utf8')).hooks.lint as {
  command: string;
  event: string[];
};
const clean = 'const value = 1;\nconsole.log(value);\n';
const dirty = 'const value=1;\nconsole.log(value);\n';

describe('Biome validation hook', () => {
  let project: string;

  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), 'han-biome-'));
    writeFileSync(
      join(project, 'biome.json'),
      JSON.stringify({
        formatter: { indentStyle: 'space', indentWidth: 2 },
      })
    );
    writeFileSync(join(project, 'package.json'), '{"private":true}');
    mkdirSync(join(project, 'node_modules', '@biomejs'), { recursive: true });
    symlinkSync(
      join(packageRoot, 'node_modules', '@biomejs', 'biome'),
      join(project, 'node_modules', '@biomejs', 'biome'),
      'dir'
    );
    mkdirSync(join(project, 'node_modules', '.bin'), { recursive: true });
    symlinkSync(
      join(packageRoot, 'node_modules', '.bin', 'biome'),
      join(project, 'node_modules', '.bin', 'biome')
    );
  });
  function resolveStop(mode: string) {
    // The runner must load after the subprocess installs its isolated session mock.
    const script = `
      import { mock } from 'bun:test';
      const dataPath = ${JSON.stringify(join(packageRoot, 'lib/grpc/data-access.ts'))};
      const actual = await import(dataPath);
      mock.module(dataPath, () => ({
        ...actual,
        getSessionModifiedFiles: async () => {
          if (process.env.TEST_MODE === 'error') throw new Error('query failed');
          return { modifiedFiles: process.env.TEST_MODE === 'outside'
            ? [process.env.OUTSIDE_FILE] : [] };
        },
      }));
      const { substituteHanFilesForStop } = await import(${JSON.stringify(join(packageRoot, 'lib/hook-runner.ts'))});
      const result = await substituteHanFilesForStop(
        ${JSON.stringify(definition.command)},
        { directory: process.cwd(), ifChanged: ['**/*.{js,jsx,ts,tsx,json,jsonc}'] },
        process.env.TEST_MODE === 'missing' ? undefined : 'test-session',
        process.cwd(),
      );
      console.log(JSON.stringify(result));
    `;
    const child = spawnSync('bun', ['-e', script], {
      cwd: project,
      encoding: 'utf8',
      env: {
        ...process.env,
        TEST_MODE: mode,
        OUTSIDE_FILE: join(project, 'outside.txt'),
        HAN_NO_CHECKPOINTS: mode === 'disabled' ? '1' : '0',
      },
      timeout: 30000,
    });
    expect(child.status).toBe(0);
    return JSON.parse(child.stdout.trim()) as {
      command: string;
      skipped: boolean;
    };
  }

  test.each([
    'missing',
    'empty',
    'error',
    'disabled',
  ])('Stop fallback for %s validates without writing', (mode) => {
    const file = join(project, 'example.js');
    writeFileSync(file, dirty);
    const resolved = resolveStop(mode);
    expect(resolved.skipped).toBe(false);
    const result = run(resolved.command);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('format');
    expect(readFileSync(file, 'utf8')).toBe(dirty);
  });

  test('Stop skips a known session set with no matching files', () => {
    writeFileSync(join(project, 'outside.txt'), 'not a matching file');
    expect(resolveStop('outside').skipped).toBe(true);
  });

  afterEach(() => rmSync(project, { recursive: true, force: true }));

  function run(command: string) {
    return spawnSync('sh', ['-c', command], {
      cwd: project,
      encoding: 'utf8',
      env: { ...process.env, npm_config_offline: 'true' },
      timeout: 30000,
    });
  }

  test('validates clean files and rejects formatting without changing bytes', () => {
    const file = join(project, 'example.js');
    writeFileSync(file, clean);
    expect(
      run(buildCommandWithFiles(definition.command, ['example.js'])).status
    ).toBe(0);
    writeFileSync(file, dirty);
    const result = run(
      buildCommandWithFiles(definition.command, ['example.js'])
    );
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('format');
    expect(readFileSync(file, 'utf8')).toBe(dirty);
  });

  test('full-tree fallback validates without writing', () => {
    const file = join(project, 'example.js');
    writeFileSync(file, dirty);
    const result = run(buildCommandWithFiles(definition.command, []));
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('format');
    expect(readFileSync(file, 'utf8')).toBe(dirty);
  });

  test('post-edit target reports its diagnostics and leaves both files untouched', () => {
    expect(definition.event).toContain('PostToolUse:Edit|Write|NotebookEdit');
    writeFileSync(join(project, 'edited.js'), dirty);
    writeFileSync(join(project, 'other.js'), dirty);
    const result = run(
      buildCommandWithFiles(definition.command, ['edited.js'])
    );
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('edited.js');
    expect(`${result.stdout}${result.stderr}`).not.toContain('other.js');
    expect(readFileSync(join(project, 'edited.js'), 'utf8')).toBe(dirty);
    expect(readFileSync(join(project, 'other.js'), 'utf8')).toBe(dirty);
  });

  test('explicit formatting only changes the selected file', () => {
    writeFileSync(join(project, 'edited.js'), dirty);
    writeFileSync(join(project, 'other.js'), dirty);
    const result = run('npx -y @biomejs/biome check --write edited.js');
    expect(result.status).toBe(0);
    expect(readFileSync(join(project, 'edited.js'), 'utf8')).not.toBe(dirty);
    expect(readFileSync(join(project, 'other.js'), 'utf8')).toBe(dirty);
  });
});
