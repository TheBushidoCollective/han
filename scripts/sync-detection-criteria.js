#!/usr/bin/env node
/**
 * Sync detection criteria from han-plugin.yml files to marketplace.json
 *
 * This script reads all plugin han-plugin.yml files and extracts detection
 * criteria (dirs_with, dir_test) to embed in marketplace.json for fast
 * marker-based plugin auto-detection.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

/**
 * Extract unique detection criteria from a plugin's han-plugin.yml
 * @param {string} pluginSource - Relative source path (e.g., "./jutsu/jutsu-typescript")
 * @returns {Object|null} Detection criteria or null if none found
 */
function extractDetectionCriteria(pluginSource) {
  // Remove leading "./" from source path
  const relativePath = pluginSource.replace(/^\.\//, '');
  const hanPluginPath = join(rootDir, relativePath, 'han-plugin.yml');

  if (!existsSync(hanPluginPath)) {
    return null;
  }

  try {
    const config = YAML.parse(readFileSync(hanPluginPath, 'utf-8'));
    const hooks = config.hooks || {};

    // Collect unique dirs_with patterns and dir_test commands from all hooks
    const allDirsWith = new Set();
    const allDirTests = new Set();

    for (const [_hookName, hookConfig] of Object.entries(hooks)) {
      if (hookConfig.dirs_with) {
        for (const pattern of hookConfig.dirs_with) {
          // Clean up patterns - remove quotes that might be in the config
          const cleanPattern = pattern.replace(/^['"]|['"]$/g, '');
          allDirsWith.add(cleanPattern);
        }
      }
      if (hookConfig.dir_test) {
        allDirTests.add(hookConfig.dir_test);
      }
    }

    // Only return detection criteria if we found something
    if (allDirsWith.size === 0 && allDirTests.size === 0) {
      return null;
    }

    const detection = {};
    if (allDirsWith.size > 0) {
      detection.dirsWith = Array.from(allDirsWith).sort();
    }
    if (allDirTests.size > 0) {
      detection.dirTest = Array.from(allDirTests).sort();
    }

    return detection;
  } catch (error) {
    console.error(`Warning: Error reading ${hanPluginPath}: ${error.message}`);
    return null;
  }
}

/**
 * Main sync function
 */
function syncDetectionCriteria() {
  const marketplacePath = join(rootDir, '.claude-plugin', 'marketplace.json');

  if (!existsSync(marketplacePath)) {
    console.error('Error: marketplace.json not found');
    process.exit(1);
  }

  const marketplace = JSON.parse(readFileSync(marketplacePath, 'utf-8'));
  let updated = 0;
  let unchanged = 0;
  let removed = 0;

  for (const plugin of marketplace.plugins) {
    const detection = extractDetectionCriteria(plugin.source);

    // Check if detection criteria changed
    const currentDetection = JSON.stringify(plugin.detection || null);
    const newDetection = JSON.stringify(detection);

    if (currentDetection !== newDetection) {
      if (detection) {
        plugin.detection = detection;
        updated++;
        console.log(`✓ Updated ${plugin.name}: ${JSON.stringify(detection)}`);
      } else if (plugin.detection) {
        delete plugin.detection;
        removed++;
        console.log(`✓ Removed detection from ${plugin.name}`);
      }
    } else {
      unchanged++;
    }
  }

  // Write back marketplace.json with proper formatting
  writeFileSync(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`);

  console.log(`\nSummary:`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Removed: ${removed}`);
  console.log(`  Unchanged: ${unchanged}`);
  console.log(`  Total plugins: ${marketplace.plugins.length}`);
}

syncDetectionCriteria();
