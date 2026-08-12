/**
 * Plugin Validation Command
 *
 * Validates plugin structure and configuration files.
 * Run in a plugin directory to validate that plugin.
 *
 * Usage: han plugin validate
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Command } from 'commander';
import { parse as parseYaml } from 'yaml';
import { validatePluginConfig } from '../../config/config-validator.ts';
import { generateHooksForPlugin } from './generate-hooks.ts';

export interface ValidationIssue {
  type: 'error' | 'warning';
  path: string;
  message: string;
}

export interface PluginValidationResult {
  pluginPath: string;
  pluginName: string;
  issues: ValidationIssue[];
  valid: boolean;
}

/**
 * Find all files matching a name recursively
 */
function findFiles(dir: string, filename: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath, filename));
    } else if (entry.name === filename) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Top-level fields recognized by the Claude Code plugin manifest schema.
 *
 * Source: https://code.claude.com/docs/en/plugins-reference
 * Claude Code ignores top-level fields it does not recognize, so anything
 * outside this set is reported as a warning rather than an error.
 */
const RECOGNIZED_MANIFEST_FIELDS: Record<string, true> = {
  $schema: true,
  name: true,
  displayName: true,
  version: true,
  description: true,
  author: true,
  homepage: true,
  repository: true,
  license: true,
  keywords: true,
  metadata: true,
  defaultEnabled: true,
  strict: true,
  skills: true,
  commands: true,
  agents: true,
  workflows: true,
  hooks: true,
  mcpServers: true,
  outputStyles: true,
  lspServers: true,
  experimental: true,
  userConfig: true,
  channels: true,
  dependencies: true,
};

/**
 * Component keys that belong under the manifest's `experimental` key.
 * Declaring them at the top level still works, but a future Claude Code
 * release will require `experimental.*`.
 */
const EXPERIMENTAL_COMPONENT_KEYS: readonly string[] = ['themes', 'monitors'];

/**
 * Validate a single plugin directory
 */
export function validatePlugin(pluginPath: string): PluginValidationResult {
  const issues: ValidationIssue[] = [];
  const pluginName = basename(pluginPath);

  // Check .claude-plugin directory exists
  const claudePluginDir = join(pluginPath, '.claude-plugin');
  if (!existsSync(claudePluginDir)) {
    issues.push({
      type: 'error',
      path: pluginPath,
      message: 'Missing .claude-plugin/ directory',
    });
    return { pluginPath, pluginName, issues, valid: false };
  }

  // Check plugin.json exists
  const pluginJsonPath = join(claudePluginDir, 'plugin.json');
  if (!existsSync(pluginJsonPath)) {
    issues.push({
      type: 'error',
      path: claudePluginDir,
      message: 'Missing plugin.json',
    });
  } else {
    // Validate plugin.json
    try {
      const parsed: unknown = JSON.parse(
        readFileSync(pluginJsonPath, 'utf-8')
      );

      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        issues.push({
          type: 'error',
          path: pluginJsonPath,
          message: 'plugin.json must contain a JSON object',
        });
      } else {
        const manifest = parsed as Record<string, unknown>;

        if (!manifest.name) {
          issues.push({
            type: 'error',
            path: pluginJsonPath,
            message: "Missing required 'name' field",
          });
        } else if (manifest.name !== pluginName) {
          issues.push({
            type: 'warning',
            path: pluginJsonPath,
            message: `Plugin name '${manifest.name}' doesn't match directory name '${pluginName}'`,
          });
        }

        if (!manifest.version) {
          issues.push({
            type: 'warning',
            path: pluginJsonPath,
            message:
              "Missing 'version' field - optional upstream, but setting it pins the plugin version so users only get updates when you bump it",
          });
        }

        if (!manifest.description) {
          issues.push({
            type: 'warning',
            path: pluginJsonPath,
            message: "Missing 'description' field",
          });
        }

        for (const key of Object.keys(manifest)) {
          if (
            Object.hasOwn(RECOGNIZED_MANIFEST_FIELDS, key) ||
            EXPERIMENTAL_COMPONENT_KEYS.includes(key)
          ) {
            continue;
          }
          issues.push({
            type: 'warning',
            path: pluginJsonPath,
            message: `Unrecognized field '${key}' - Claude Code ignores top-level fields it does not recognize`,
          });
        }

        if (Object.hasOwn(manifest, 'experimental')) {
          const experimental = manifest.experimental;
          if (
            typeof experimental !== 'object' ||
            experimental === null ||
            Array.isArray(experimental)
          ) {
            issues.push({
              type: 'warning',
              path: pluginJsonPath,
              message:
                "'experimental' must be an object - Claude Code ignores a non-object value",
            });
          } else {
            for (const key of Object.keys(experimental)) {
              if (!EXPERIMENTAL_COMPONENT_KEYS.includes(key)) {
                issues.push({
                  type: 'warning',
                  path: pluginJsonPath,
                  message: `Unrecognized 'experimental.${key}' - recognized experimental components are ${EXPERIMENTAL_COMPONENT_KEYS.join(', ')}`,
                });
              }
            }
          }
        }

        for (const key of EXPERIMENTAL_COMPONENT_KEYS) {
          if (Object.hasOwn(manifest, key)) {
            issues.push({
              type: 'warning',
              path: pluginJsonPath,
              message: `'${key}' at the top level still loads, but a future Claude Code release will require 'experimental.${key}'`,
            });
          }
        }
      }
    } catch {
      issues.push({
        type: 'error',
        path: pluginJsonPath,
        message: 'Invalid JSON',
      });
    }
  }

  // Check for extra files in .claude-plugin/ (only plugin.json should be there)
  if (existsSync(claudePluginDir)) {
    const files = readdirSync(claudePluginDir);
    for (const file of files) {
      if (file !== 'plugin.json') {
        issues.push({
          type: 'error',
          path: join(claudePluginDir, file),
          message:
            "Unexpected file in .claude-plugin/ - a plugin's .claude-plugin/ holds only plugin.json; move hooks to hooks/ and everything else to the plugin root",
        });
      }
    }
  }

  // Check for misplaced hooks.json at plugin root
  const rootHooksJson = join(pluginPath, 'hooks.json');
  if (existsSync(rootHooksJson)) {
    issues.push({
      type: 'error',
      path: rootHooksJson,
      message: 'Should be in hooks/hooks.json, not plugin root',
    });
  }

  // Validate han-plugin.yml if exists
  const hanPluginYml = join(pluginPath, 'han-plugin.yml');
  if (existsSync(hanPluginYml)) {
    try {
      const content = readFileSync(hanPluginYml, 'utf-8');
      const config = parseYaml(content);
      const result = validatePluginConfig(config);
      if (!result.valid) {
        for (const error of result.errors) {
          issues.push({
            type: 'error',
            path: `${hanPluginYml}${error.path ? `:${error.path}` : ''}`,
            message: error.message,
          });
        }
      }
    } catch (e) {
      issues.push({
        type: 'error',
        path: hanPluginYml,
        message: `Invalid YAML: ${e instanceof Error ? e.message : 'parse error'}`,
      });
    }
  }

  // Validate hooks/hooks.json if exists (Claude Code hooks)
  const hooksJsonPath = join(pluginPath, 'hooks', 'hooks.json');
  if (existsSync(hooksJsonPath)) {
    try {
      const hooksJson = JSON.parse(readFileSync(hooksJsonPath, 'utf-8'));

      // Check format - should have 'hooks' wrapper or direct Stop/SubagentStop
      const hasHooksWrapper = 'hooks' in hooksJson;
      const hooks = hasHooksWrapper ? hooksJson.hooks : hooksJson;

      // Warn if Stop exists without SubagentStop
      if (hooks.Stop && !hooks.SubagentStop) {
        issues.push({
          type: 'warning',
          path: hooksJsonPath,
          message: 'Has Stop hook but missing SubagentStop',
        });
      }
    } catch {
      issues.push({
        type: 'error',
        path: hooksJsonPath,
        message: 'Invalid JSON',
      });
    }
  }

  // Check if hooks.json is stale (generated vs actual)
  if (existsSync(hanPluginYml)) {
    const expectedJson = generateHooksForPlugin(pluginPath, false);
    if (expectedJson) {
      const actualJson = existsSync(hooksJsonPath)
        ? readFileSync(hooksJsonPath, 'utf-8')
        : '';
      if (actualJson !== expectedJson) {
        issues.push({
          type: 'warning',
          path: hooksJsonPath,
          message:
            "hooks.json is stale (doesn't match han-plugin.yml). Run 'han plugin generate-hooks' to update.",
        });
      }
    }
  }

  // Validate skill files
  const skillsDir = join(pluginPath, 'skills');
  if (existsSync(skillsDir) && statSync(skillsDir).isDirectory()) {
    const skillFiles = findFiles(skillsDir, 'SKILL.md');
    for (const skillFile of skillFiles) {
      const content = readFileSync(skillFile, 'utf-8');
      const lines = content.split('\n');

      // Check for frontmatter
      if (lines[0] !== '---') {
        issues.push({
          type: 'error',
          path: skillFile,
          message: 'Missing YAML frontmatter',
        });
        continue;
      }

      // Extract frontmatter
      const endIndex = lines.indexOf('---', 1);
      if (endIndex === -1) {
        issues.push({
          type: 'error',
          path: skillFile,
          message: 'Unclosed YAML frontmatter',
        });
        continue;
      }

      const frontmatter = lines.slice(1, endIndex).join('\n');
      if (!frontmatter.includes('name:')) {
        issues.push({
          type: 'error',
          path: skillFile,
          message: "Missing 'name' in frontmatter",
        });
      }
      if (!frontmatter.includes('description:')) {
        issues.push({
          type: 'error',
          path: skillFile,
          message: "Missing 'description' in frontmatter",
        });
      }
    }
  }

  const hasErrors = issues.some((i) => i.type === 'error');
  return { pluginPath, pluginName, issues, valid: !hasErrors };
}

/**
 * Register the plugin validate command
 */
export function registerPluginValidate(program: Command): void {
  program
    .command('validate')
    .description(
      'Validate plugin structure and configuration in current directory'
    )
    .option('-q, --quiet', 'Only show errors, not warnings')
    .action(async (options: { quiet?: boolean }) => {
      const cwd = process.cwd();

      // Check if current directory is a plugin
      const claudePluginDir = join(cwd, '.claude-plugin');
      if (!existsSync(claudePluginDir)) {
        // Not a plugin directory - exit silently (hook should use dirs_with)
        process.exit(0);
      }

      const result = validatePlugin(cwd);
      const errors = result.issues.filter((i) => i.type === 'error');
      const warnings = result.issues.filter((i) => i.type === 'warning');

      if (errors.length > 0 || (!options.quiet && warnings.length > 0)) {
        console.log(`\x1b[1m${result.pluginName}\x1b[0m`);

        for (const error of errors) {
          console.log(`  \x1b[31mERROR:\x1b[0m ${error.message}`);
          console.log(`         ${error.path}`);
        }

        if (!options.quiet) {
          for (const warning of warnings) {
            console.log(`  \x1b[33mWARN:\x1b[0m ${warning.message}`);
            console.log(`        ${warning.path}`);
          }
        }
      }

      if (errors.length > 0) {
        process.exit(1);
      }

      process.exit(0);
    });
}
