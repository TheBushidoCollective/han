import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

test('a release with no valid coordinator pin refuses an installed sibling', () => {
  const root = mkdtempSync(join(tmpdir(), 'han-release-pin-'));
  try {
    const bin = join(root, 'bin');
    const moduleDir = join(root, 'lib', 'coordinator');
    mkdirSync(bin, { recursive: true });
    mkdirSync(moduleDir, { recursive: true });
    const bun = join(bin, process.platform === 'win32' ? 'bun.exe' : 'bun');
    copyFileSync(process.execPath, bun);
    const candidate =
      process.platform === 'win32' ? 'han-coordinator.exe' : 'han-coordinator';
    writeFileSync(join(bin, candidate), 'untrusted coordinator');
    const modulePath = join(moduleDir, 'binary.ts');
    copyFileSync(
      join(import.meta.dir, '..', 'lib', 'coordinator', 'binary.ts'),
      modulePath
    );
    writeFileSync(
      join(root, 'lib', 'build-info.generated.ts'),
      "export const HAN_BUILD_KIND = 'release';\nexport const COORDINATOR_SHA256 = null;\n"
    );
    const entry = join(root, 'entry.js');
    writeFileSync(
      entry,
      `import { findCoordinatorBinary } from ${JSON.stringify(pathToFileURL(modulePath).href)};\nconsole.log(JSON.stringify(findCoordinatorBinary()));\n`
    );
    const result = Bun.spawnSync([bun, entry], {
      cwd: root,
      env: { ...process.env, HOME: root, USERPROFILE: root },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout.toString().trim())).toBeNull();
  } finally {
    rmSync(root, {
      recursive: true,
      force: true,
      maxRetries: 30,
      retryDelay: 100,
    });
  }
});

test('release candidates must match the pin and have safe permissions', () => {
  const root = mkdtempSync(join(tmpdir(), 'han-release-candidate-'));
  try {
    const bin = join(root, 'bin');
    const moduleDir = join(root, 'lib', 'coordinator');
    mkdirSync(bin, { recursive: true });
    mkdirSync(moduleDir, { recursive: true });
    const bun = join(bin, process.platform === 'win32' ? 'bun.exe' : 'bun');
    copyFileSync(process.execPath, bun);
    const candidate = join(
      bin,
      process.platform === 'win32' ? 'han-coordinator.exe' : 'han-coordinator'
    );
    const original = 'verified coordinator';
    writeFileSync(candidate, original);
    const pin = createHash('sha256').update(original).digest('hex');
    const modulePath = join(moduleDir, 'binary.ts');
    copyFileSync(
      join(import.meta.dir, '..', 'lib', 'coordinator', 'binary.ts'),
      modulePath
    );
    writeFileSync(
      join(root, 'lib', 'build-info.generated.ts'),
      `export const HAN_BUILD_KIND = 'release';\nexport const COORDINATOR_SHA256 = '${pin}';\n`
    );
    const entry = join(root, 'entry.js');
    writeFileSync(
      entry,
      `import { findCoordinatorBinary } from ${JSON.stringify(pathToFileURL(modulePath).href)};\nconsole.log(JSON.stringify(findCoordinatorBinary()));\n`
    );
    const discover = () => {
      const result = Bun.spawnSync([bun, entry], {
        cwd: root,
        env: { ...process.env, HOME: root, USERPROFILE: root },
        stdout: 'pipe',
        stderr: 'pipe',
      });
      expect(result.exitCode).toBe(0);
      return JSON.parse(result.stdout.toString().trim());
    };
    expect(discover()).toBe(candidate);
    writeFileSync(candidate, 'tampered coordinator');
    expect(discover()).toBeNull();
    writeFileSync(candidate, original);
    if (process.platform !== 'win32') {
      chmodSync(bin, 0o777);
      expect(discover()).toBeNull();
    }
  } finally {
    rmSync(root, {
      recursive: true,
      force: true,
      maxRetries: 30,
      retryDelay: 100,
    });
  }
});
