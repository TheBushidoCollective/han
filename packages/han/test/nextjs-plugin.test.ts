import { afterEach, describe, expect, test } from 'bun:test';
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dir, '../../..');
const plugin = parse(
  readFileSync(join(root, 'plugins/frameworks/nextjs/han-plugin.yml'), 'utf8')
);
const hook = plugin.hooks.lint as {
  command: string;
  dir_test: string;
  if_changed: string[];
};
const fixtures: string[] = [];

function fixture(manifest: unknown): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'han-next-plugin-')));
  fixtures.push(dir);
  writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest));
  return dir;
}

function run(command: string, cwd: string, env = process.env) {
  return Bun.spawnSync(['sh', '-c', command], {
    cwd,
    env,
    stdout: 'pipe',
    stderr: 'pipe',
  });
}

afterEach(() => {
  for (const dir of fixtures.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe('Next.js lint hook', () => {
  test('does not select a dependency without application evidence or a textual false positive', () => {
    expect(
      run(hook.dir_test, fixture({ devDependencies: { next: '^16' } })).exitCode
    ).not.toBe(0);
    const dir = fixture({
      description: '"next": "16"',
      dependencies: { 'next-themes': '1' },
    });
    mkdirSync(join(dir, 'app'));
    expect(run(hook.dir_test, dir).exitCode).not.toBe(0);
  });

  for (const layout of ['app', 'pages', 'src/app', 'src/pages']) {
    test(`selects ${layout} with Next in devDependencies`, () => {
      const dir = fixture({ devDependencies: { next: '^16' } });
      mkdirSync(join(dir, layout), { recursive: true });
      expect(run(hook.dir_test, dir).exitCode).toBe(0);
    });
  }

  for (const config of [
    'next.config.js',
    'next.config.mjs',
    'next.config.ts',
  ]) {
    test(`selects ${config} with Next in dependencies`, () => {
      const dir = fixture({ dependencies: { next: '^16' } });
      writeFileSync(join(dir, config), '');
      expect(run(hook.dir_test, dir).exitCode).toBe(0);
    });
  }

  test('does not select malformed manifests or files masquerading as app directories', () => {
    const dir = fixture({ dependencies: { next: '1' } });
    writeFileSync(join(dir, 'app'), '');
    expect(run(hook.dir_test, dir).exitCode).not.toBe(0);
    writeFileSync(join(dir, 'package.json'), '{');
    expect(run(hook.dir_test, dir).exitCode).not.toBe(0);
  });

  test('executes the project lint script and propagates failures and missing scripts', () => {
    expect(hook.command).toBe('npm run lint');
    const dir = fixture({ scripts: { lint: 'node -e "process.exit(42)"' } });
    expect(run(hook.command, dir).exitCode).toBe(42);
    expect(run(hook.command, fixture({})).exitCode).not.toBe(0);
  });

  test('website script is non-writing and executes from the website directory', () => {
    const website = join(root, 'website');
    const manifest = JSON.parse(
      readFileSync(join(website, 'package.json'), 'utf8')
    );
    expect(manifest.scripts.lint).toBe('biome check --error-on-warnings .');
    expect(run(hook.dir_test, website).exitCode).toBe(0);
    const dir = fixture(manifest);
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    writeFileSync(
      join(bin, 'biome'),
      '#!/bin/sh\nprintf "%s\\n" "$PWD" "$*"\n'
    );
    chmodSync(join(bin, 'biome'), 0o755);
    const result = run(hook.command, dir, {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain(
      `${dir}\ncheck --error-on-warnings .`
    );
  });

  test('tracks project and linter configuration changes', () => {
    for (const path of [
      'package.json',
      'next.config.{js,mjs,ts}',
      'biome.json',
      'biome.jsonc',
      'eslint.config.*',
    ]) {
      expect(hook.if_changed).toContain(path);
    }
    expect(hook.command).not.toContain('next lint');
  });
});
