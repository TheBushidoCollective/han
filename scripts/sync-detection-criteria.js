#!/usr/bin/env node
/**
 * Sync detection criteria from han-config.json files to marketplace.json
 *
 * This script reads all plugin han-config.json files and extracts detection
 * criteria (dirsWith, dirTest) to embed in marketplace.json for fast
 * marker-based plugin auto-detection.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

/**
 * Extract unique detection criteria from a plugin's han-config.json
 * @param {string} pluginSource - Relative source path (e.g., "./jutsu/jutsu-typescript")
 * @returns {Object|null} Detection criteria or null if none found
 */
function extractDetectionCriteria(pluginSource) {
  // Remove leading "./" from source path
  const relativePath = pluginSource.replace(/^\.\//, '');
  const hanConfigPath = join(rootDir, relativePath, 'han-config.json');

  if (!existsSync(hanConfigPath)) {
    return null;
  }

  try {
    const config = JSON.parse(readFileSync(hanConfigPath, 'utf-8'));
    const hooks = config.hooks || {};

    // Collect unique dirsWith patterns and dirTest commands from all hooks
    const allDirsWith = new Set();
    const allDirTests = new Set();

    for (const [_hookName, hookConfig] of Object.entries(hooks)) {
      if (hookConfig.dirsWith) {
        for (const pattern of hookConfig.dirsWith) {
          // Clean up patterns - remove quotes that might be in the config
          const cleanPattern = pattern.replace(/^['"]|['"]$/g, '');
          allDirsWith.add(cleanPattern);
        }
      }
      if (hookConfig.dirTest) {
        allDirTests.add(hookConfig.dirTest);
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
    console.error(`Warning: Error reading ${hanConfigPath}: ${error.message}`);
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
