import { expect, test } from 'bun:test';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('release build rejects missing coordinator and dashboard before compilation', () => {
  const root = mkdtempSync(join(tmpdir(), 'han-release-inputs-'));
  try {
    const scripts = join(root, 'scripts');
    const prompts = join(root, 'lib', 'analyze');
    mkdirSync(scripts, { recursive: true });
    mkdirSync(prompts, { recursive: true });
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ version: '3.22.0' })
    );
    writeFileSync(join(prompts, 'detect-plugins-prompt.md'), 'fixture');
    const script = join(scripts, 'build-bundle.js');
    copyFileSync(
      join(import.meta.dir, '..', 'scripts', 'build-bundle.js'),
      script
    );
    const missingCoordinator = Bun.spawnSync(
      [process.execPath, script, '--release', '--version', '3.22.0'],
      { cwd: root, stdout: 'pipe', stderr: 'pipe', timeout: 120_000 }
    );
    expect(missingCoordinator.exitCode).not.toBe(0);
    expect(missingCoordinator.stderr.toString()).toContain(
      'Release build requires an existing coordinator file'
    );
    const coordinator = join(root, 'coordinator');
    writeFileSync(coordinator, 'coordinator fixture');
    const missingDashboard = Bun.spawnSync(
      [
        process.execPath,
        script,
        '--release',
        '--version',
        '3.22.0',
        '--coordinator',
        coordinator,
      ],
      { cwd: root, stdout: 'pipe', stderr: 'pipe', timeout: 120_000 }
    );
    expect(missingDashboard.exitCode).not.toBe(0);
    expect(missingDashboard.stderr.toString()).toContain(
      'Release build requires a dashboard with index.html'
    );
  } finally {
    rmSync(root, {
      recursive: true,
      force: true,
      maxRetries: 30,
      retryDelay: 100,
    });
  }
});
