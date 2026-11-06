import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const root = resolve(import.meta.dir, '../..');
const base = process.env.PR_BASE_SHA;
if (!base || !/^[a-f0-9]{40}$/.test(base))
  throw new Error('Missing PR base SHA');
const previous = 'https://thebushido.co';
const expected = 'https://withbushido.ai';
const tracked = execFileSync('git', ['ls-files', '-z', '--', '*.json'], {
  cwd: root,
})
  .toString()
  .split('\0')
  .filter(Boolean);
const manifests = tracked.filter(
  (file) =>
    file.endsWith('/.claude-plugin/plugin.json') ||
    /^plugins\/bridges\/[^/]+\/package\.json$/.test(file)
);
let checked = 0;
for (const file of manifests) {
  const current = JSON.parse(readFileSync(resolve(root, file), 'utf8'));
  if (current.author?.url === previous)
    throw new Error(`Old author URL: ${file}`);
  if (current.author?.url === expected) checked++;
}
if (checked === 0) throw new Error('No author manifests use the expected URL');
const changed = execFileSync(
  'git',
  [
    'diff',
    '--name-only',
    '--diff-filter=M',
    '-z',
    base,
    'HEAD',
    '--',
    '*.json',
  ],
  { cwd: root }
)
  .toString()
  .split('\0')
  .filter(Boolean);
for (const file of changed.filter((path) => manifests.includes(path))) {
  const old = JSON.parse(
    execFileSync('git', ['show', `${base}:${file}`], { cwd: root }).toString()
  );
  if (old.author?.url !== previous && old.author?.url !== expected) continue;
  const current = JSON.parse(readFileSync(resolve(root, file), 'utf8'));
  if (current.author?.url !== expected)
    throw new Error(`Wrong author URL: ${file}`);
}
console.log(`Checked ${checked} author manifests with the expected URL`);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
  const footer = page.locator('footer');
  const link = footer.getByRole('link', { name: 'The Bushido Collective' });
  if (
    !(await link.isVisible()) ||
    (await link.getAttribute('href')) !== expected
  ) {
    throw new Error('Visible footer link has the wrong destination');
  }
  await footer.screenshot({ path: 'domain-footer.png' });
  const response = await page.request.get(
    'http://127.0.0.1:3000/marketplace.json'
  );
  if (!response.ok()) throw new Error(`Marketplace HTTP ${response.status()}`);
  const marketplace = await response.json();
  if (marketplace.owner?.url !== expected)
    throw new Error('Served marketplace owner URL is wrong');
  console.log(`Visible footer and served marketplace owner: ${expected}`);
} finally {
  await browser.close();
}
