#!/usr/bin/env bun
/**
 * Converts han-config.json files to han-plugin.yml format
 *
 * This script converts JSON configuration files to YAML format, transforming
 * camelCase keys to snake_case for better YAML conventions.
 *
 * Usage:
 *   # Convert a single plugin
 *   bun run scripts/convert-plugin-config.ts jutsu/jutsu-bun
 *
 *   # Convert all plugins
 *   bun run scripts/convert-plugin-config.ts --all
 *
 * Key transformations:
 *   - dirsWith → dirs_with
 *   - dirTest → dir_test
 *   - ifChanged → if_changed
 *   - idleTimeout → idle_timeout
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { stringify } from 'yaml';

const __dirname = dirname(new URL(import.meta.url).pathname);
const rootDir = resolve(__dirname, '..', '..', '..');

interface HookConfig {
  command: string;
  dirsWith?: string[];
  dirTest?: string;
  ifChanged?: string[];
  idleTimeout?: number;
  description?: string;
}

interface HanConfig {
  hooks: Record<string, HookConfig>;
}

/**
 * Converts camelCase keys to snake_case
 */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Converts a hook configuration object from camelCase to snake_case
 */
function convertHookConfig(config: HookConfig): Record<string, unknown> {
  const converted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    const snakeKey = toSnakeCase(key);
    converted[snakeKey] = value;
  }

  return converted;
}

/**
 * Converts a han-config.json to han-plugin.yml format
 */
function convertConfig(config: HanConfig): Record<string, unknown> {
  const converted: Record<string, unknown> = {
    hooks: {},
  };

  for (const [hookName, hookConfig] of Object.entries(config.hooks)) {
    (converted.hooks as Record<string, unknown>)[hookName] =
      convertHookConfig(hookConfig);
  }

  return converted;
}

/**
 * Converts a single plugin's han-config.json to han-plugin.yml
 */
function convertPlugin(pluginPath: string): boolean {
  const configPath = join(pluginPath, 'han-config.json');
  const outputPath = join(pluginPath, 'han-plugin.yml');

  try {
    const configJson = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configJson) as HanConfig;

    const converted = convertConfig(config);
    const yaml = stringify(converted, {
      lineWidth: 0, // Disable line wrapping
      defaultStringType: 'QUOTE_DOUBLE',
      defaultKeyType: 'PLAIN',
    });

    writeFileSync(outputPath, yaml, 'utf-8');
    console.log(`✓ Converted ${pluginPath}`);
    console.log(`  ${configPath} → ${outputPath}`);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error(`✗ No han-config.json found in ${pluginPath}`);
    } else {
      console.error(`✗ Error converting ${pluginPath}:`, error);
    }
    return false;
  }
}

/**
 * Recursively finds all directories containing han-config.json
 */
function findPluginsWithConfig(baseDir: string): string[] {
  const plugins: string[] = [];

  try {
    const entries = readdirSync(baseDir);

    for (const entry of entries) {
      const fullPath = join(baseDir, entry);

      try {
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          const configPath = join(fullPath, 'han-config.json');
          try {
            statSync(configPath);
            plugins.push(fullPath);
          } catch {
            // No han-config.json in this directory, continue
          }
        }
      } catch {
        // Skip inaccessible paths
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${baseDir}:`, error);
  }

  return plugins;
}

/**
 * Finds all plugins with han-config.json in jutsu/, do/, and hashi/ directories
 */
function findAllPlugins(): string[] {
  const pluginDirs = ['jutsu', 'do', 'hashi'];
  const plugins: string[] = [];

  for (const dir of pluginDirs) {
    const fullPath = join(rootDir, dir);
    try {
      statSync(fullPath);
      plugins.push(...findPluginsWithConfig(fullPath));
    } catch {
      // Directory doesn't exist, skip
    }
  }

  return plugins;
}

/**
 * Main execution
 */
function main() {
  const args = Bun.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage:');
    console.error('  bun run scripts/convert-plugin-config.ts <plugin-path>');
    console.error('  bun run scripts/convert-plugin-config.ts --all');
    console.error('');
    console.error('Examples:');
    console.error('  bun run scripts/convert-plugin-config.ts jutsu/jutsu-bun');
    console.error('  bun run scripts/convert-plugin-config.ts --all');
    process.exit(1);
  }

  if (args[0] === '--all') {
    console.log('Finding all plugins with han-config.json...');
    const plugins = findAllPlugins();

    if (plugins.length === 0) {
      console.log('No plugins found with han-config.json');
      process.exit(0);
    }

    console.log(`Found ${plugins.length} plugin(s) to convert\n`);

    let successCount = 0;
    let failCount = 0;

    for (const plugin of plugins) {
      if (convertPlugin(plugin)) {
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log(`\nConversion complete:`);
    console.log(`  ✓ ${successCount} successful`);
    if (failCount > 0) {
      console.log(`  ✗ ${failCount} failed`);
      process.exit(1);
    }
  } else {
    const pluginPath = resolve(rootDir, args[0]);
    const success = convertPlugin(pluginPath);
    process.exit(success ? 0 : 1);
  }
}

main();
