import { afterEach, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
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
const repo = resolve(packageRoot, '../..');
const entry = join(packageRoot, 'lib/main.ts');
const biome = join(packageRoot, 'node_modules/.bin/biome');
let fixture = '';

afterEach(() => {
  if (fixture) rmSync(fixture, { recursive: true, force: true });
});

test('Stop dispatch selects real workspace projects, ignores dependencies, and does not rewrite authored files', () => {
  fixture = realpathSync(mkdtempSync(join(tmpdir(), 'han-stop-selection-')));
  const project = join(fixture, 'project');
  const config = join(fixture, 'config');
  const bin = join(fixture, 'bin');
  const tmp = join(fixture, 'tmp');
  const log = join(fixture, 'calls');
  const authoredFiles: string[] = [];
  for (const dir of [project, config, bin, tmp])
    mkdirSync(dir, { recursive: true });
  const put = (path: string, contents: string) => {
    const full = join(project, path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, contents);
    authoredFiles.push(full);
    return full;
  };
  const executable = (name: string, source: string) => {
    const path = join(bin, name);
    writeFileSync(path, source);
    chmodSync(path, 0o755);
  };
  const preload = join(fixture, 'preload.ts');
  // Load the module dynamically so the subprocess installs its mock before the CLI starts.
  writeFileSync(
    preload,
    `import { mock } from 'bun:test';\nconst path = ${JSON.stringify(join(packageRoot, 'lib/grpc/client.ts'))};\nconst actual = await import(path);\nmock.module(path, () => ({ ...actual, isCoordinatorHealthy: async () => false }));\n`
  );
  executable(
    'han',
    `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} --preload ${JSON.stringify(preload)} ${JSON.stringify(entry)} "$@"\n`
  );
  executable(
    'npm',
    '#!/bin/sh\nprintf "npm|%s|%s\\n" "$PWD" "$*" >> "$CALL_LOG"\n'
  );
  executable(
    'npx',
    `#!/bin/sh\nprintf 'npx|%s|%s\\n' "$PWD" "$*" >> "$CALL_LOG"\nif [ "$1" = bddgen ]; then exit 0; fi\nif [ "$1" = -y ] && [ "$2" = @biomejs/biome ]; then shift 2; exec ${JSON.stringify(biome)} "$@"; fi\nexit 91\n`
  );
  writeFileSync(
    join(config, 'settings.json'),
    JSON.stringify({
      extraKnownMarketplaces: {
        fixture: { source: { source: 'directory', path: repo } },
      },
      enabledPlugins: {
        'nextjs@fixture': true,
        'playwright-bdd@fixture': true,
        'biome@fixture': true,
      },
    })
  );
  const git = spawnSync('git', ['init', '--quiet', project], {
    encoding: 'utf8',
  });
  expect(git.status).toBe(0);
  put('.gitignore', '/**/node_modules/\n');
  put('app/package.json', JSON.stringify({ dependencies: { next: '16' } }));
  put('app/app/page.tsx', 'export default function Page() { return null; }\n');
  put(
    'not-next/package.json',
    JSON.stringify({ devDependencies: { next: '16' } })
  );
  put(
    'bdd/package.json',
    JSON.stringify({ devDependencies: { 'playwright-bdd': '1' } })
  );
  put('bdd/playwright.config.ts', 'export default {};\n');
  put('bdd/playwright.bdd.config.ts', 'export default {};\n');
  put('ordinary/package.json', '{}');
  put('ordinary/playwright.config.ts', 'export default {};\n');
  put(
    'node_modules/ignored/package.json',
    JSON.stringify({ dependencies: { next: '16', 'playwright-bdd': '1' } })
  );
  put('node_modules/ignored/app/page.tsx', 'export default 1;\n');
  put('node_modules/ignored/playwright.config.ts', 'export default {};\n');
  put('node_modules/ignored/biome.json', '{}');
  put(
    'packages/nested/node_modules/ignored/package.json',
    JSON.stringify({ dependencies: { next: '16' } })
  );
  put(
    'packages/nested/node_modules/ignored/app/page.tsx',
    'export default 1;\n'
  );
  put(
    'biome/biome.json',
    JSON.stringify({ formatter: { indentStyle: 'space', indentWidth: 2 } })
  );
  put('biome/example.js', 'const value=1;\nconsole.log(value);\n');
  const before = new Map(
    authoredFiles.map((file) => [file, readFileSync(file)])
  );
  const assertUnchanged = () => {
    for (const [file, contents] of before)
      expect(readFileSync(file)).toEqual(contents);
  };
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: fixture,
    CLAUDE_CONFIG_DIR: config,
    HAN_DATA_DIR: join(fixture, 'data'),
    XDG_CACHE_HOME: join(fixture, 'cache'),
    XDG_CONFIG_HOME: join(fixture, 'xdg'),
    TMPDIR: tmp,
    PATH: `${bin}:${process.env.PATH}`,
    CALL_LOG: log,
    HAN_NO_CACHE: '1',
    HAN_NO_CHECKPOINTS: '1',
    CLAUDE_CODE_ENABLE_TELEMETRY: '0',
    npm_config_offline: 'true',
  };
  delete env.HAN_DISABLE_HOOKS;
  delete env.CLAUDE_PLUGIN_ROOT;
  delete env.CLAUDE_PROJECT_DIR;
  delete env.CLAUDE_SESSION_ID;
  delete env.HAN_DISPATCH;
  const run = (args: string[]) =>
    spawnSync(process.execPath, ['--preload', preload, entry, ...args], {
      cwd: project,
      env,
      input: JSON.stringify({ hook_event_name: 'Stop' }),
      encoding: 'utf8',
      timeout: 120000,
    });
  const dispatch = run([
    'hook',
    'dispatch',
    'Stop',
    '--no-cache',
    '--no-checkpoints',
  ]);
  expect(dispatch.error).toBeUndefined();
  expect(dispatch.status).toBe(0);
  const calls = readFileSync(log, 'utf8').trim().split('\n').sort();
  expect(calls).toEqual(
    [
      `npm|${join(project, 'app')}|run lint`,
      `npx|${join(project, 'bdd')}|bddgen --config playwright.bdd.config.ts`,
      `npx|${join(project, 'biome')}|-y @biomejs/biome check --error-on-warnings .`,
    ].sort()
  );
  const dispatchFailure = dispatch.stdout.match(
    /Hook `biome\/[^`]+` failed\. Output: ([^\r\n]+)/
  );
  if (!dispatchFailure)
    throw new Error(`Missing Biome dispatch failure: ${dispatch.stdout}`);
  const runnerError = readFileSync(dispatchFailure[1], 'utf8');
  expect(runnerError).toContain('biome');
  const diagnosticFile = runnerError.match(/Output: ([^\r\n]+)/);
  if (!diagnosticFile)
    throw new Error(`Missing validation output path: ${runnerError}`);
  const diagnostic = readFileSync(diagnosticFile[1], 'utf8');
  expect(diagnostic).toContain('example.js');
  expect(diagnostic).toMatch(/format/i);
  assertUnchanged();
  const direct = run(['hook', 'run', 'biome', 'lint', '--async', '--no-cache']);
  expect(direct.error).toBeUndefined();
  expect(`${direct.stdout}\n${direct.stderr}`).toMatch(/format|biome\/lint/i);
  expect(
    direct.status !== 0 ||
      direct.stdout.includes('"decision":"block"') ||
      direct.stdout.includes('"decision": "block"')
  ).toBe(true);
  assertUnchanged();
}, 180000);
