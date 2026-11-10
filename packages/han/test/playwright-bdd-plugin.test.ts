import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getHookConfigs } from '../lib/hooks/hook-config.ts';

const plugin = join(import.meta.dir, '../../../plugins/tools/playwright-bdd');
const script = join(plugin, 'scripts/generate.sh');

describe('playwright-bdd hook', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'han-bdd-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('discovers only configs owned by a package declaring playwright-bdd', () => {
    const ordinary = join(root, 'ordinary');
    const bdd = join(root, 'bdd');
    const nested = join(bdd, 'nested');
    const other = join(bdd, 'other');
    for (const dir of [ordinary, nested, other])
      mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(ordinary, 'package.json'),
      JSON.stringify({
        devDependencies: { '@playwright/test': '*' },
        scripts: { 'playwright-bdd': 'echo no' },
      })
    );
    writeFileSync(join(ordinary, 'playwright.config.ts'), '');
    writeFileSync(
      join(bdd, 'package.json'),
      JSON.stringify({ dependencies: { 'playwright-bdd': '*' } })
    );
    writeFileSync(join(nested, 'playwright.bdd.config.ts'), '');
    writeFileSync(join(other, 'package.json'), '{}');
    writeFileSync(join(other, 'playwright.config.js'), '');
    const configs = getHookConfigs(plugin, 'generate', root);
    expect(configs.map((config) => config.directory)).toEqual([nested]);
    expect(configs[0].ifChanged).toContain('**/package.json');
    expect(configs[0].ifChanged).toContain('playwright.bdd.config.*');
  });

  test('prefers dedicated config and passes standard config when alone', () => {
    const bin = join(root, 'bin');
    mkdirSync(bin);
    const output = join(root, 'args');
    const npx = join(bin, 'npx');
    writeFileSync(npx, '#!/bin/sh\nprintf "%s\\n" "$@" > "$BDD_ARGS"\n');
    chmodSync(npx, 0o755);
    const standard = join(root, 'playwright.config.ts');
    const dedicated = join(root, 'playwright.bdd.config.ts');
    writeFileSync(standard, 'standard');
    const run = () =>
      spawnSync('bash', [script], {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          BDD_ARGS: output,
        },
      });
    expect(run().status).toBe(0);
    expect(readFileSync(output, 'utf8')).toBe(
      'bddgen\n--config\nplaywright.config.ts\n'
    );
    writeFileSync(dedicated, 'dedicated');
    expect(run().status).toBe(0);
    expect(readFileSync(output, 'utf8')).toBe(
      'bddgen\n--config\nplaywright.bdd.config.ts\n'
    );
    expect(readFileSync(standard, 'utf8')).toBe('standard');
    expect(readFileSync(dedicated, 'utf8')).toBe('dedicated');
  });
});
