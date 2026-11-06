import { afterEach, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  assertRuntime,
  parseOptions,
} from '../scripts/prove-installed-coordinator.ts';

const root = resolve(import.meta.dir, '../../..');
const scratch: string[] = [];
function temp(): string {
  const path = mkdtempSync(join(tmpdir(), 'han-distribution-test-'));
  scratch.push(path);
  return path;
}
afterEach(() => {
  for (const path of scratch.splice(0))
    rmSync(path, { recursive: true, force: true });
});

describe('distribution', () => {
  test('installed proof requires explicit artifacts and exact embedded runtime', () => {
    const args = [
      '--cli',
      '/artifact/han',
      '--coordinator',
      '/artifact/han-coordinator',
      '--bun-version',
      '1.4.4',
      '--bun-revision',
      'abc123',
      '--evidence-dir',
      '/evidence',
    ];
    expect(parseOptions(args).coordinator).toBe('/artifact/han-coordinator');
    expect(() => parseOptions(args.slice(0, -2))).toThrow();
    expect(() => parseOptions([...args, '--cli', '/another'])).toThrow();
    expect(() => parseOptions([...args, '--unknown', 'value'])).toThrow();
    const output = 'han 1.0.0\n  Bun: 1.4.4 (abc123)\n';
    expect(() => assertRuntime(output, '1.4.4', 'abc123')).not.toThrow();
    expect(() => assertRuntime(output, '1.4.5', 'abc123')).toThrow();
    expect(() => assertRuntime(output, '1.4.4', 'wrong')).toThrow();
    expect(() =>
      assertRuntime('han 1.4.4 (abc123)', '1.4.4', 'abc123')
    ).toThrow();
  });

  test.each([
    ['linux-x64', 'han-linux-x64', ''],
    ['linux-arm64', 'han-linux-arm64', ''],
    ['darwin-x64', 'han-darwin-x64', ''],
    ['darwin-arm64', 'han-darwin-arm64', ''],
    ['win32-x64', 'han-windows-x64', '.exe'],
  ])('npm packages require the matching pair for %s', (platform, artifact, suffix) => {
    const dir = temp();
    mkdirSync(join(dir, 'artifact'));
    writeFileSync(join(dir, 'artifact', `${artifact}${suffix}`), 'cli');
    const run = () =>
      Bun.spawnSync(
        [
          'bash',
          join(root, '.github/scripts/create-npm-platform-package.sh'),
          'v9.8.7',
          platform,
          artifact,
        ],
        { cwd: dir }
      );
    expect(run().exitCode).not.toBe(0);
    writeFileSync(
      join(dir, 'artifact', `han-coordinator-${artifact.slice(4)}${suffix}`),
      'coordinator'
    );
    expect(run().exitCode).toBe(0);
    expect(readFileSync(join(dir, 'package', `han${suffix}`), 'utf8')).toBe(
      'cli'
    );
    expect(
      readFileSync(join(dir, 'package', `han-coordinator${suffix}`), 'utf8')
    ).toBe('coordinator');
  });

  test.skipIf(process.platform === 'win32')(
    'installer requires both checksummed assets before replacing an existing pair',
    () => {
      const dir = temp();
      const bin = join(dir, 'bin');
      const fixtures = join(dir, 'fixtures');
      const fakeBin = join(dir, 'fake-bin');
      mkdirSync(bin);
      mkdirSync(fixtures);
      mkdirSync(fakeBin);
      const platform = `${process.platform}-${process.arch === 'arm64' ? 'arm64' : 'x64'}`;
      for (const [name, content] of [
        [`han-${platform}`, 'new cli'],
        [`han-coordinator-${platform}`, 'new coordinator'],
      ]) {
        writeFileSync(join(fixtures, name), content);
        writeFileSync(
          join(fixtures, `${name}.sha256`),
          `${createHash('sha256').update(content).digest('hex')}  ${name}\n`
        );
      }
      const curl = join(fakeBin, 'curl');
      writeFileSync(
        curl,
        '#!/bin/sh\nwhile [ "$#" -gt 0 ]; do case "$1" in -o) dest="$2"; shift 2;; http*) url="$1"; shift;; *) shift;; esac; done\ncp "$FIXTURES/$(basename "$url")" "$dest"\n'
      );
      chmodSync(curl, 0o755);
      writeFileSync(join(bin, 'han'), 'old cli');
      writeFileSync(join(bin, 'han-coordinator'), 'old coordinator');
      const run = () =>
        Bun.spawnSync(['bash', join(root, 'website/public/install.sh')], {
          env: {
            ...process.env,
            PATH: `${fakeBin}:/usr/bin:/bin`,
            HOME: dir,
            FIXTURES: fixtures,
            HAN_VERSION: '9.8.7',
            HAN_INSTALL_DIR: bin,
          },
        });
      writeFileSync(
        join(fixtures, `han-coordinator-${platform}.sha256`),
        `${'0'.repeat(64)}\n`
      );
      expect(run().exitCode).not.toBe(0);
      expect(readFileSync(join(bin, 'han'), 'utf8')).toBe('old cli');
      expect(readFileSync(join(bin, 'han-coordinator'), 'utf8')).toBe(
        'old coordinator'
      );
      const coordinator = readFileSync(
        join(fixtures, `han-coordinator-${platform}`)
      );
      writeFileSync(
        join(fixtures, `han-coordinator-${platform}.sha256`),
        `${createHash('sha256').update(coordinator).digest('hex')}\n`
      );
      expect(run().exitCode).toBe(0);
      expect(readFileSync(join(bin, 'han'), 'utf8')).toBe('new cli');
      const releaseDir = resolve(realpathSync(join(bin, 'han')), '..');
      expect(readFileSync(join(releaseDir, 'han-coordinator'), 'utf8')).toBe(
        'new coordinator'
      );
      expect(readFileSync(join(bin, 'han-coordinator'), 'utf8')).toBe(
        'old coordinator'
      );
      expect(existsSync(join(bin, 'han'))).toBe(true);
      const mv = join(fakeBin, 'mv');
      writeFileSync(
        mv,
        '#!/bin/sh\ncase "$*" in *han-link*) exit 1;; esac\nexec /bin/mv "$@"\n'
      );
      chmodSync(mv, 0o755);
      expect(run().exitCode).not.toBe(0);
      expect(realpathSync(join(bin, 'han'))).toBe(join(releaseDir, 'han'));
      expect(readFileSync(join(releaseDir, 'han-coordinator'), 'utf8')).toBe(
        'new coordinator'
      );
    }
  );

  test('retired HTTP endpoint never returns key material', async () => {
    // Exercise the separately deployed certificate server's module boundary.
    const { handleRequest } = await import(join(root, 'cert-server/server.ts'));
    const server = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch: handleRequest,
    });
    try {
      const response = await fetch(
        `http://127.0.0.1:${server.port}/coordinator/latest`
      );
      expect(response.status).toBe(410);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.error).toBe('UPGRADE_REQUIRED');
      expect(body.key).toBeUndefined();
      expect(body.cert).toBeUndefined();
    } finally {
      server.stop(true);
    }
  });
});
