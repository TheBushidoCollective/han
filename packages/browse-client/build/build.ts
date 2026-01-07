#!/usr/bin/env bun
/**
 * Production build script using Bun's bundler with HTML entrypoint
 *
 * This replaces Vite for production builds, using:
 * - Bun's HTML loader for automatic asset discovery
 * - Custom relay plugin for GraphQL transforms
 * - Custom pages plugin for file-based routing
 */
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pagesPlugin } from './pages-plugin';
import { relayPlugin } from './relay-plugin';
import { rnwCompatPlugin } from './rnw-compat-plugin';

const projectRoot = dirname(import.meta.dir);
const outDir = join(projectRoot, 'out');
const pagesDir = join(projectRoot, 'src', 'pages');

// Clean output directory
try {
  rmSync(outDir, { recursive: true });
} catch {
  // Directory may not exist
}

console.log('Building browse-client with Bun...');
console.log(`  Output: ${outDir}`);

const result = await Bun.build({
  entrypoints: [join(projectRoot, 'index.html')],
  outdir: outDir,
  minify: true,
  splitting: true,
  sourcemap: 'external',
  target: 'browser',
  publicPath: '/', // Use absolute paths for SPA routing compatibility
  plugins: [
    rnwCompatPlugin(),
    relayPlugin({ devMode: false }),
    pagesPlugin({ pagesDir }),
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    global: 'globalThis',
  },
  loader: {
    '.css': 'css',
    '.svg': 'file',
    '.png': 'file',
    '.jpg': 'file',
    '.jpeg': 'file',
    '.gif': 'file',
    '.woff': 'file',
    '.woff2': 'file',
  },
});

if (!result.success) {
  console.error('Build failed:');
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Report build artifacts
console.log('\nBuild complete:');
for (const output of result.outputs) {
  const size = output.size;
  const sizeStr =
    size > 1024 * 1024
      ? `${(size / 1024 / 1024).toFixed(2)} MB`
      : `${(size / 1024).toFixed(1)} KB`;
  console.log(`  ${output.path.replace(outDir, 'out')} (${sizeStr})`);
}
