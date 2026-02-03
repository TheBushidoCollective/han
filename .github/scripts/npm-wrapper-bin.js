#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

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

// Try to find the binary in node_modules
const binName = platform === 'win32' ? 'han.exe' : 'han';
const paths = [
  // Installed as dependency
  join(__dirname, '..', '@thebushidocollective', `han-${pkgName}`, binName),
  // npx cache location
  join(
    __dirname,
    'node_modules',
    '@thebushidocollective',
    `han-${pkgName}`,
    binName
  ),
];

let binPath = paths.find((p) => existsSync(p));

if (!binPath) {
  // Try to install the platform package on-demand
  try {
    const pkg = `@thebushidocollective/han-${pkgName}`;
    console.error(`Installing ${pkg}...`);
    execFileSync('npm', ['install', '--no-save', pkg], {
      stdio: 'inherit',
      cwd: __dirname,
    });
    binPath = join(
      __dirname,
      'node_modules',
      '@thebushidocollective',
      `han-${pkgName}`,
      binName
    );
  } catch (e) {
    console.error(`Failed to install platform package: ${e.message}`);
    process.exit(1);
  }
}

if (!existsSync(binPath)) {
  console.error(`Binary not found at ${binPath}`);
  process.exit(1);
}

// Execute the binary with all arguments
try {
  execFileSync(binPath, process.argv.slice(2), { stdio: 'inherit' });
} catch (e) {
  process.exit(e.status || 1);
}
