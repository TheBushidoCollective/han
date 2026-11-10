const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const writer = path.join(__dirname, 'update-package-version.cjs');
const run = (command, args, cwd, env = {}) => execFileSync(command, args, {
  cwd,
  env: { ...process.env, ...env },
  stdio: 'pipe',
  encoding: 'utf8',
});

test('version bump preserves a root-formatted manifest and all other values', () => {
  const dir = fs.mkdtempSync(path.join(root, '.version-fixture-'));
  try {
    const manifest = path.join(dir, 'package.json');
    fs.copyFileSync(path.join(root, 'packages/han/package.json'), manifest);
    run('biome', ['format', '--write', manifest], root);
    const before = fs.readFileSync(manifest, 'utf8');
    const data = JSON.parse(before);
    run('node', [writer, manifest, '987.654.321'], root);
    const after = fs.readFileSync(manifest, 'utf8');
    assert.deepEqual(JSON.parse(after), { ...data, version: '987.654.321' });
    assert.equal(after, before.replace(JSON.stringify(data.version), '"987.654.321"'));
    run('biome', ['format', manifest], root);
    assert.notEqual(spawnSync('node', [writer, manifest, 'not-a-version']).status, 0);
    assert.equal(fs.readFileSync(manifest, 'utf8'), after);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('website bump regenerates on a competing push and does not bump twice', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'han-release-fixture-'));
  try {
    const remote = path.join(dir, 'remote.git');
    const first = path.join(dir, 'first');
    const rival = path.join(dir, 'rival');
    run('git', ['init', '--bare', '--initial-branch=main', remote], dir);
    run('git', ['clone', remote, first], dir);
    run('git', ['config', 'user.email', 'fixture@example.invalid'], first);
    run('git', ['config', 'user.name', 'Fixture'], first);
    fs.mkdirSync(path.join(first, '.github/scripts'), { recursive: true });
    fs.mkdirSync(path.join(first, 'website'));
    for (const file of ['bump-website-version.sh', 'update-package-version.cjs']) {
      fs.copyFileSync(path.join(__dirname, file), path.join(first, '.github/scripts', file));
    }
    fs.writeFileSync(path.join(first, '.github/scripts/generate-changelog.sh'), '#!/bin/bash\nset -e\nprintf "version %s\\n" "$2" >> website/CHANGELOG.md\n');
    fs.writeFileSync(path.join(first, 'website/package.json'), '{\n  "name": "version",\n  "version": "1.2.3"\n}\n');
    fs.writeFileSync(path.join(first, 'website/CHANGELOG.md'), 'initial\n');
    run('git', ['add', '.'], first);
    run('git', ['commit', '-m', 'initial'], first);
    run('git', ['push', 'origin', 'main'], first);
    run('git', ['clone', remote, rival], dir);
    run('git', ['config', 'user.email', 'fixture@example.invalid'], rival);
    run('git', ['config', 'user.name', 'Fixture'], rival);
    fs.appendFileSync(path.join(rival, 'website/CHANGELOG.md'), 'concurrent\n');
    run('git', ['add', '.'], rival);
    run('git', ['commit', '-m', 'concurrent change'], rival);
    const hook = path.join(first, '.git/hooks/pre-push');
    fs.writeFileSync(hook, `#!/bin/sh\nif [ ! -e '${dir}/pushed' ]; then\n  touch '${dir}/pushed'\n  git -C '${rival}' push origin main\nfi\n`, { mode: 0o755 });
    const env = { BUMP_TYPE: 'patch', SOURCE_SHA: 'a'.repeat(40) };
    run('bash', ['.github/scripts/bump-website-version.sh'], first, env);
    assert.equal(JSON.parse(fs.readFileSync(path.join(first, 'website/package.json'))).version, '1.2.4');
    assert.equal(fs.readFileSync(path.join(first, 'website/CHANGELOG.md'), 'utf8'), 'initial\nconcurrent\nversion 1.2.4\n');
    const head = run('git', ['rev-parse', 'HEAD'], first).trim();
    run('bash', ['.github/scripts/bump-website-version.sh'], first, env);
    assert.equal(run('git', ['rev-parse', 'HEAD'], first).trim(), head);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
