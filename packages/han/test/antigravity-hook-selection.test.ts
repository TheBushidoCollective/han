import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repo = resolve(import.meta.dir, '../../..');
const bridge = join(repo, 'plugins/bridges/antigravity/src');

test('Antigravity discovers and matches actual Next and BDD project gates', () => {
  const root = mkdtempSync(join(tmpdir(), 'han-antigravity-hooks-'));
  try {
    const project = join(root, 'project');
    const marketplace = join(project, '.claude-plugin');
    mkdirSync(marketplace, { recursive: true });
    mkdirSync(join(project, '.claude'), { recursive: true });
    const plugins = [
      {
        name: 'nextjs',
        source: './nextjs',
        original: 'plugins/frameworks/nextjs',
      },
      {
        name: 'playwright-bdd',
        source: './playwright-bdd',
        original: 'plugins/tools/playwright-bdd',
      },
    ];
    for (const plugin of plugins) {
      const dir = join(project, plugin.source);
      mkdirSync(dir, { recursive: true });
      copyFileSync(
        join(repo, plugin.original, 'han-plugin.yml'),
        join(dir, 'han-plugin.yml')
      );
    }
    writeFileSync(
      join(marketplace, 'marketplace.json'),
      JSON.stringify({ name: 'han', plugins })
    );
    writeFileSync(
      join(project, '.claude/settings.json'),
      JSON.stringify({
        enabledPlugins: { 'nextjs@han': true, 'playwright-bdd@han': true },
      })
    );
    const probe = `
      const { discoverHooks } = await import(${JSON.stringify(join(bridge, 'discovery.ts'))});
      const { matchStopHooks } = await import(${JSON.stringify(join(bridge, 'matcher.ts'))});
      const hooks = discoverHooks(process.cwd());
      console.log(JSON.stringify({ discovered: hooks.map(h => h.pluginName).sort(), matched: matchStopHooks(hooks, process.cwd()).map(h => h.pluginName).sort() }));
    `;
    const run = () => {
      const child = spawnSync(process.execPath, ['-e', probe], {
        cwd: project,
        encoding: 'utf8',
        env: { ...process.env, HOME: join(root, 'home') },
        timeout: 30000,
      });
      expect(child.error).toBeUndefined();
      expect(child.status).toBe(0);
      return JSON.parse(child.stdout.trim()) as {
        discovered: string[];
        matched: string[];
      };
    };
    const manifest = join(project, 'package.json');
    const config = join(project, 'playwright.config.ts');
    writeFileSync(
      manifest,
      JSON.stringify({
        devDependencies: { next: '16', '@playwright/test': '1' },
      })
    );
    writeFileSync(config, 'export default {};\n');
    const source = readFileSync(config, 'utf8');
    expect(run()).toEqual({
      discovered: ['nextjs', 'playwright-bdd'],
      matched: [],
    });
    expect(existsSync(join(project, '-'))).toBe(false);
    mkdirSync(join(project, 'app'));
    expect(run()).toEqual({
      discovered: ['nextjs', 'playwright-bdd'],
      matched: ['nextjs'],
    });
    writeFileSync(
      manifest,
      JSON.stringify({ devDependencies: { next: '16', 'playwright-bdd': '1' } })
    );
    expect(run()).toEqual({
      discovered: ['nextjs', 'playwright-bdd'],
      matched: ['nextjs', 'playwright-bdd'],
    });
    expect(readFileSync(config, 'utf8')).toBe(source);
    expect(existsSync(join(project, '-'))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
