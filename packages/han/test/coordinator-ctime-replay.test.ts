import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

test('Coordinator selection ctime replay: rewriting candidate with same size and restored mtime is rejected', () => {
  const root = mkdtempSync(join(tmpdir(), 'han-ctime-replay-'));
  try {
    const binDir = join(root, 'bin');
    const moduleDir = join(
      root,
      'source',
      'packages',
      'han',
      'lib',
      'coordinator'
    );
    mkdirSync(binDir, { recursive: true });
    mkdirSync(moduleDir, { recursive: true });

    const binarySuffix = process.platform === 'win32' ? '.exe' : '';
    const cliBin = join(binDir, `han${binarySuffix}`);
    copyFileSync(process.execPath, cliBin);

    const coordinatorBin = join(binDir, `han-coordinator${binarySuffix}`);
    const originalContent = 'CORRECT_COORDINATOR_PAYLOAD_VALID_PIN_BYTES_12345';
    writeFileSync(coordinatorBin, originalContent);
    const pinSha256 = createHash('sha256')
      .update(originalContent)
      .digest('hex');

    const modulePath = join(moduleDir, 'binary.ts');
    copyFileSync(
      join(import.meta.dir, '..', 'lib', 'coordinator', 'binary.ts'),
      modulePath
    );

    writeFileSync(
      join(moduleDir, '..', 'build-info.generated.ts'),
      `export const HAN_BUILD_KIND: 'release' | 'dev' = 'release';\n` +
        `export const HAN_VERSION = '3.23.0';\n` +
        `export const COORDINATOR_SHA256: string | null = ${JSON.stringify(pinSha256)};\n` +
        `export const DETECT_PLUGINS_PROMPT = 'prompt';\n`
    );

    const runnerScript = join(root, 'runner.mjs');
    writeFileSync(
      runnerScript,
      `import { statSync, utimesSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { findCoordinatorBinary } from ${JSON.stringify(pathToFileURL(modulePath).href)};

const first = findCoordinatorBinary();
if (!first) {
  console.log(JSON.stringify({ step: 'first', result: null }));
  process.exit(1);
}

const st = statSync(first);
// Overwrite file with tampered payload of exact same size
const tampered = 'TAMPERED_COORDINATOR_PAYLOAD_FAKE_PIN_BYTES_12345';
if (tampered.length !== ${originalContent.length}) {
  throw new Error('Test setup error: length mismatch');
}
writeFileSync(first, tampered);

// Restore original mtime and atime
utimesSync(first, st.atime, st.mtime);

// Second lookup: cache key must differ because ctime changed on write
const second = findCoordinatorBinary();
console.log(JSON.stringify({ step: 'second', first, second }));
`
    );

    const proc = Bun.spawnSync([cliBin, runnerScript], {
      cwd: root,
      env: {
        ...process.env,
        HOME: root,
        USERPROFILE: root,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    });

    expect(proc.exitCode).toBe(0);
    const output = proc.stdout.toString().trim();
    const result = JSON.parse(output);

    expect(result.first).toBe(coordinatorBin);
    // Because ctime changed when we overwrote the file, the cache was invalidated,
    // the hash was recomputed, and the tampered file was rejected (returned null)
    expect(result.second).toBeNull();
  } finally {
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});
