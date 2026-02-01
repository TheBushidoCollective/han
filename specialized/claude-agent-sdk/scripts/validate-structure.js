#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const dirs = ['.claude/agents', '.claude/skills', '.claude/commands'].filter(
  (d) => fs.existsSync(d)
);

if (dirs.length === 0) {
  console.log('ℹ️  No .claude directory found - skipping structure validation');
  process.exit(0);
}

const errors = [];

for (const d of dirs) {
  const files = fs.readdirSync(d, { recursive: true });
  for (const f of files) {
    const fp = path.join(d, f);
    if (fs.statSync(fp).isFile()) {
      if (d.includes('agents') && !f.endsWith('.md')) {
        errors.push(`Agent ${f} must be .md file`);
      }
      if (
        d.includes('skills') &&
        path.basename(f) !== 'SKILL.md' &&
        f.endsWith('.md')
      ) {
        errors.push(`Skill file must be SKILL.md, found: ${f}`);
      }
      if (d.includes('commands') && !f.endsWith('.md')) {
        errors.push(`Command ${f} must be .md file`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error('\n❌ Claude Agent SDK structure validation failed:\n');
  for (const e of errors) {
    console.error(`  • ${e}`);
  }
  process.exit(1);
} else {
  console.log('✅ Claude Agent SDK structure valid');
}
