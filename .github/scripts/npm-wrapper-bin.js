#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { dirname, join } = require('node:path');

const platform = process.platform;
const arch = process.arch;

// Map Node.js platform/arch to our package names
const platformMap = {
  'darwin-arm64': 'darwin-arm64',
  'darwin-x64': 'darwin-x64',
  'linux-arm64': 'linux-arm64',
  'linux-x64': 'linux-x64',
  'win32-x64': 'win32-x64',
};

const key = `${platform}-${arch}`;
const pkgName = platformMap[key];

if (!pkgName) {
  console.error(`Unsupported platform: ${platform}-${arch}`);
  process.exit(1);
}

const pkg = `@thebushidocollective/han-${pkgName}`;
const binName = platform === 'win32' ? 'han.exe' : 'han';

/**
 * Find the platform binary using require.resolve (the canonical way to locate
 * packages in Node.js). This works regardless of whether npm hoisted the
 * optional dependency or kept it nested.
 */
function findBinaryViaResolve() {
  try {
    const pkgJson = require.resolve(`${pkg}/package.json`);
    const binPath = join(dirname(pkgJson), binName);
    if (existsSync(binPath)) return binPath;
  } catch {
    // Package not resolvable
  }
  return null;
}

/**
 * Hardcoded path fallbacks for environments where require.resolve may not
 * traverse into the expected node_modules tree (e.g., npx cache quirks).
 */
function findBinaryViaHardcodedPaths() {
  const candidates = [
    // Hoisted (standard npm layout)
    join(__dirname, '..', '@thebushidocollective', `han-${pkgName}`, binName),
    // Nested under wrapper
    join(
      __dirname,
      'node_modules',
      '@thebushidocollective',
      `han-${pkgName}`,
      binName
    ),
  ];
  return candidates.find((p) => existsSync(p)) || null;
}

/**
 * Last resort: install the platform package on-demand and re-check all
 * locations (both hoisted and nested) after the install.
 */
function installAndFind() {
  try {
    execFileSync('npm', ['install', '--no-save', '--ignore-scripts', pkg], {
      stdio: 'pipe',
      cwd: __dirname,
    });
  } catch {
    // Install failed - fall through to checks anyway
  }
  // Re-check all locations after install
  return findBinaryViaResolve() || findBinaryViaHardcodedPaths();
}

// Resolution chain: resolve → hardcoded paths → install-and-retry
let binPath = findBinaryViaResolve() || findBinaryViaHardcodedPaths();

if (!binPath) {
  binPath = installAndFind();
}

if (!binPath) {
  console.error(`Error: han binary not found for ${key}`);
  console.error(`Package: ${pkg}`);
  console.error('');
  console.error(
    'Try:  npx clear-npx-cache && npx -y @thebushidocollective/han --version'
  );
  process.exit(1);
}

// Execute the binary with all arguments
try {
  execFileSync(binPath, process.argv.slice(2), { stdio: 'inherit' });
} catch (e) {
  process.exit(e.status || 1);
}
