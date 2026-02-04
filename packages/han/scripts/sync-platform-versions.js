#!/usr/bin/env node
/**
 * Syncs the optionalDependencies versions with the main package version.
 * Run this after bumping the version in package.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(__dirname, '..', 'package.json');

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;

const platformPackages = [
  '@thebushidocollective/han-darwin-arm64',
  '@thebushidocollective/han-darwin-x64',
  '@thebushidocollective/han-linux-x64',
  '@thebushidocollective/han-linux-arm64',
  '@thebushidocollective/han-win32-x64',
];

// Update optionalDependencies
if (!packageJson.optionalDependencies) {
  packageJson.optionalDependencies = {};
}

for (const pkg of platformPackages) {
  packageJson.optionalDependencies[pkg] = version;
}

writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, '\t')}\n`);

console.log(`Updated optionalDependencies to version ${version}`);
