import { expect, test } from 'bun:test';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Exercise discovery in a fresh process so the executable, cwd, home and PATH
// are independent of the test runner and of other tests' module mocks.
test.skipIf(process.platform !== 'win32')(
  'Windows discovery ignores cwd, PATH and cwd packages but keeps installed and development locations',
  () => {
    const root = mkdtempSync(join(tmpdir(), 'han-binary-discovery-'));
    try {
      const bin = join(root, 'installed');
      const cwd = join(root, 'untrusted');
      const home = join(root, 'home');
      const pathDir = join(root, 'path');
      const moduleDir = join(
        root,
        'source',
        'packages',
        'han',
        'lib',
        'coordinator'
      );
      for (const dir of [bin, cwd, home, pathDir, moduleDir])
        mkdirSync(dir, { recursive: true });
      const bun = join(bin, 'bun.exe');
      copyFileSync(process.execPath, bun);
      const modulePath = join(moduleDir, 'binary.ts');
      copyFileSync(
        join(import.meta.dir, '..', 'lib', 'coordinator', 'binary.ts'),
        modulePath
      );
      const jsEntry = join(root, 'entry.js');
      const tsEntry = join(root, 'entry.ts');
      const script = `import { findCoordinatorBinary } from ${JSON.stringify(pathToFileURL(modulePath).href)};\nconsole.log(JSON.stringify(findCoordinatorBinary()));\n`;
      writeFileSync(jsEntry, script);
      writeFileSync(tsEntry, script);
      const env = {
        ...process.env,
        HOME: home,
        USERPROFILE: home,
        PATH: `${pathDir};${join(process.env.SystemRoot || 'C:\\Windows', 'System32')}`,
        NODE_PATH: '',
      };
      const discover = (entry = jsEntry, childEnv = env) => {
        const result = Bun.spawnSync([bun, entry], {
          cwd,
          env: childEnv,
          stdout: 'pipe',
          stderr: 'pipe',
        });
        expect(result.exitCode).toBe(0);
        return JSON.parse(result.stdout.toString().trim());
      };
      // Test each search independently: `where` can return multiple lines.
      writeFileSync(join(cwd, 'han-coordinator.exe'), 'not a trusted helper');
      expect(discover()).toBeNull();
      rmSync(join(cwd, 'han-coordinator.exe'));
      writeFileSync(
        join(pathDir, 'han-coordinator.exe'),
        'not a trusted helper'
      );
      expect(discover()).toBeNull();
      rmSync(join(pathDir, 'han-coordinator.exe'));
      const packageDir = join(
        cwd,
        'node_modules',
        '@thebushidocollective',
        `han-${process.platform}-${process.arch}`
      );
      mkdirSync(packageDir, { recursive: true });
      writeFileSync(join(packageDir, 'package.json'), '{}');
      writeFileSync(
        join(packageDir, 'han-coordinator.exe'),
        'not a trusted helper'
      );
      expect(discover()).toBeNull();
      const rootHelper = join(
        process.env.SystemDrive || 'C:',
        'tmp',
        '.han',
        'bin',
        'han-coordinator.exe'
      );
      if (existsSync(rootHelper))
        throw new Error('Root fixture already exists');
      try {
        mkdirSync(dirname(rootHelper), { recursive: true });
        writeFileSync(rootHelper, 'untrusted root helper', { flag: 'wx' });
        expect(
          discover(jsEntry, { ...env, HOME: '', USERPROFILE: '' })
        ).toBeNull();
      } finally {
        rmSync(rootHelper, { force: true });
      }

      const sibling = join(bin, 'han-coordinator.exe');
      writeFileSync(sibling, 'installed helper');
      expect(realpathSync(discover())).toBe(realpathSync(sibling));
      rmSync(sibling);

      const homeHelper = join(home, '.han', 'bin', 'han-coordinator.exe');
      mkdirSync(dirname(homeHelper), { recursive: true });
      writeFileSync(homeHelper, 'user installation');
      expect(realpathSync(discover())).toBe(realpathSync(homeHelper));
      rmSync(homeHelper);

      const developmentHelper = join(
        root,
        'source',
        'packages',
        'han-rs',
        'target',
        'debug',
        'han-coordinator.exe'
      );
      mkdirSync(dirname(developmentHelper), { recursive: true });
      writeFileSync(developmentHelper, 'development helper');
      expect(realpathSync(discover(tsEntry))).toBe(
        realpathSync(developmentHelper)
      );
      expect(discover()).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
);
