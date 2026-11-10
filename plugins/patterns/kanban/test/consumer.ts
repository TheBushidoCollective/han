import { strict as assert } from 'node:assert';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { resolvePluginPaths } from '../../../bridges/opencode/src/discovery';
import {
  discoverAllSkills,
  formatSkillList,
  loadSkillContent,
} from '../../../bridges/opencode/src/skills';

const root = resolve(import.meta.dir, '../../../..');

if (process.argv[2] === '--probe') {
  const project = process.env.PROOF_PROJECT;
  const plugin = process.env.PROOF_PLUGIN;
  assert.ok(project);
  assert.ok(plugin);
  const skills = discoverAllSkills(resolvePluginPaths(project));
  if (process.env.PROOF_ENABLED === 'false') {
    assert.equal(skills.length, 0, 'disabled plugin must not be discovered');
  } else {
    assert.equal(skills.length, 1);
    const skill = skills[0];
    assert.equal(skill.pluginName, 'kanban');
    assert.equal(skill.name, 'ledger-tasks-yylo');
    assert.equal(
      skill.filePath,
      join(plugin, 'skills/ledger-tasks-yylo/SKILL.md')
    );
    assert.match(formatSkillList(skills), /ledger-tasks-yylo/);
    assert.match(loadSkillContent(skill), /YYLO Ledger CLI Reference/);
    console.log(
      `Discovered and loaded ${skill.pluginName}:${skill.name} at ${skill.filePath}`
    );
  }
} else {
  const fixture = mkdtempSync(join(tmpdir(), 'kanban-consumer-'));
  try {
    const home = join(fixture, 'home');
    const project = join(fixture, 'project');
    const marketplace = join(home, '.claude/plugins/marketplaces/han');
    const plugin = join(marketplace, 'plugins/patterns/kanban');
    mkdirSync(join(marketplace, '.claude-plugin'), { recursive: true });
    mkdirSync(join(marketplace, 'plugins/patterns'), { recursive: true });
    mkdirSync(project, { recursive: true });
    copyFileSync(
      join(root, '.claude-plugin/marketplace.json'),
      join(marketplace, '.claude-plugin/marketplace.json')
    );
    symlinkSync(join(root, 'plugins/patterns/kanban'), plugin, 'dir');

    for (const enabled of [false, true]) {
      writeFileSync(
        join(home, '.claude/settings.json'),
        JSON.stringify({ enabledPlugins: { 'kanban@han': enabled } })
      );
      const result = Bun.spawnSync(
        [process.execPath, import.meta.path, '--probe'],
        {
          cwd: project,
          env: {
            ...process.env,
            HOME: home,
            CLAUDE_CONFIG_DIR: join(home, '.claude'),
            PROOF_PROJECT: project,
            PROOF_PLUGIN: plugin,
            PROOF_ENABLED: String(enabled),
          },
          stdout: 'inherit',
          stderr: 'inherit',
        }
      );
      assert.equal(
        result.exitCode,
        0,
        `consumer probe failed with enabled=${enabled}`
      );
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}
