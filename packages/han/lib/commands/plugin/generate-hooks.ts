/**
 * Generate hooks.json from han-plugin.yml
 *
 * Reads the shorthand event syntax from han-plugin.yml and generates
 * the Claude Code hooks/hooks.json file automatically.
 *
 * Usage:
 *   han plugin generate-hooks [plugin-dir]   # defaults to cwd
 *   han plugin generate-hooks --all          # all plugins in marketplace
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join } from 'node:path';
import type { Command } from 'commander';
import { parse as parseYaml } from 'yaml';
import {
  type HookEventType,
  parseEventShorthands,
} from '../../hooks/hook-config.ts';

/**
 * Claude Code hooks.json structure
 */
interface ClaudeHooksJson {
  hooks: Record<string, ClaudeHookGroup[]>;
}

interface ClaudeHookGroup {
  matcher?: string;
  hooks: ClaudeHookEntry[];
  async?: boolean;
}

interface ClaudeHookEntry {
  type: 'command' | 'prompt';
  command?: string;
  prompt?: string;
  timeout?: number;
}

/**
 * Parsed YAML hook definition (snake_case from han-plugin.yml)
 */
interface YamlHookDef {
  event?: string | string[];
  command: string;
  tool_filter?: string[];
  dirs_with?: string[];
  dir_test?: string;
  if_changed?: string[];
  file_filter?: string[];
  file_test?: string;
  timeout?: number;
  idle_timeout?: number;
  description?: string;
  tip?: string;
  depends_on?: unknown[];
  mcp?: boolean;
}

/**
 * Generate hooks.json content from a han-plugin.yml config.
 *
 * @param pluginName - The plugin name (used in `han hook run {name} {hook}`)
 * @param hooks - The hooks object from han-plugin.yml
 * @returns The generated hooks.json object, or null if no hooks need registration
 */
export function generateHooksJson(
  pluginName: string,
  hooks: Record<string, YamlHookDef>
): ClaudeHooksJson | null {
  // Accumulate hook groups per Claude Code event type
  const eventGroups = new Map<string, ClaudeHookGroup[]>();

  for (const [hookName, hookDef] of Object.entries(hooks)) {
    // Parse event field - normalize to array of strings
    const rawEvents = hookDef.event
      ? Array.isArray(hookDef.event)
        ? hookDef.event.map(String)
        : [String(hookDef.event)]
      : ['Stop', 'SubagentStop']; // Default events

    // Parse shorthand events and merge tool matchers
    const parsedEvents = parseEventShorthands(rawEvents);

    for (const [eventType, toolMatcher] of parsedEvents) {
      const isAsync = eventType === 'PostToolUse' || eventType === 'PreToolUse';

      // Build the han hook run command
      const commandParts = ['han hook run', pluginName, hookName];
      if (isAsync) {
        commandParts.push('--async');
      }
      const command = commandParts.join(' ');

      const hookEntry: ClaudeHookEntry = {
        type: 'command',
        command,
      };

      const hookGroup: ClaudeHookGroup = {
        hooks: [hookEntry],
      };

      // Add matcher: prefer shorthand matcher, fall back to tool_filter field
      const effectiveMatcher =
        toolMatcher || hookDef.tool_filter?.join('|') || undefined;
      if (effectiveMatcher) {
        hookGroup.matcher = effectiveMatcher;
      }

      // Add async flag for tool-use hooks
      if (isAsync) {
        hookGroup.async = true;
      }

      if (!eventGroups.has(eventType)) {
        eventGroups.set(eventType, []);
      }
      eventGroups.get(eventType)?.push(hookGroup);
    }
  }

  if (eventGroups.size === 0) {
    return null;
  }

  // Build the final hooks object with deterministic key order
  const orderedEvents: HookEventType[] = [
    'SessionStart',
    'UserPromptSubmit',
    'PreToolUse',
    'PostToolUse',
    'Stop',
    'SubagentStop',
    'SubagentStart',
  ];

  const hooksObj: Record<string, ClaudeHookGroup[]> = {};
  for (const event of orderedEvents) {
    const groups = eventGroups.get(event);
    if (groups) {
      hooksObj[event] = groups;
    }
  }

  return { hooks: hooksObj };
}

/**
 * Generate hooks.json for a single plugin directory.
 *
 * @param pluginDir - Path to the plugin directory containing han-plugin.yml
 * @param write - Whether to write the file (true) or just return the content (false)
 * @returns The generated JSON string, or null if no hooks to generate
 */
export function generateHooksForPlugin(
  pluginDir: string,
  write = true
): string | null {
  const yamlPath = join(pluginDir, 'han-plugin.yml');
  if (!existsSync(yamlPath)) {
    return null;
  }

  const content = readFileSync(yamlPath, 'utf-8');
  const config = parseYaml(content) as { hooks?: Record<string, YamlHookDef> };

  if (!config?.hooks || Object.keys(config.hooks).length === 0) {
    return null;
  }

  const pluginName = basename(pluginDir);
  const result = generateHooksJson(pluginName, config.hooks);

  if (!result) {
    return null;
  }

  const jsonStr = `${JSON.stringify(result, null, 2)}\n`;

  if (write) {
    const hooksDir = join(pluginDir, 'hooks');
    if (!existsSync(hooksDir)) {
      mkdirSync(hooksDir, { recursive: true });
    }
    writeFileSync(join(hooksDir, 'hooks.json'), jsonStr, 'utf-8');
  }

  return jsonStr;
}

/**
 * Find all plugin directories in the marketplace
 */
function findAllPluginDirs(marketplaceRoot: string): string[] {
  const pluginsDir = join(marketplaceRoot, 'plugins');
  if (!existsSync(pluginsDir)) {
    return [];
  }

  const dirs: string[] = [];

  // Walk plugins/{category}/{plugin} structure
  for (const category of readdirSync(pluginsDir)) {
    const categoryPath = join(pluginsDir, category);
    if (!statSync(categoryPath).isDirectory()) continue;

    for (const plugin of readdirSync(categoryPath)) {
      const pluginPath = join(categoryPath, plugin);
      if (!statSync(pluginPath).isDirectory()) continue;

      // Only include dirs with han-plugin.yml
      if (existsSync(join(pluginPath, 'han-plugin.yml'))) {
        dirs.push(pluginPath);
      }
    }
  }

  // Also check top-level dirs (bushido, core)
  for (const topLevel of readdirSync(marketplaceRoot)) {
    const topPath = join(marketplaceRoot, topLevel);
    if (
      topLevel === 'plugins' ||
      topLevel === 'packages' ||
      topLevel === 'website' ||
      topLevel === 'node_modules' ||
      topLevel.startsWith('.')
    )
      continue;
    if (!statSync(topPath).isDirectory()) continue;
    if (existsSync(join(topPath, 'han-plugin.yml'))) {
      dirs.push(topPath);
    }
  }

  return dirs;
}

/**
 * Register the `han plugin generate-hooks` command
 */
export function registerPluginGenerateHooks(program: Command): void {
  program
    .command('generate-hooks')
    .description('Generate hooks/hooks.json from han-plugin.yml')
    .argument('[plugin-dir]', 'Plugin directory (defaults to cwd)')
    .option('--all', 'Generate for all plugins in the marketplace')
    .option('--check', 'Check if hooks.json is up-to-date (exit 1 if stale)')
    .option('-q, --quiet', 'Suppress output except errors')
    .action(
      async (
        pluginDir: string | undefined,
        options: { all?: boolean; check?: boolean; quiet?: boolean }
      ) => {
        if (options.all) {
          // Find marketplace root (git root)
          const { execSync } = await import('node:child_process');
          let root: string;
          try {
            root = execSync('git rev-parse --show-toplevel', {
              encoding: 'utf-8',
            }).trim();
          } catch {
            console.error(
              'Could not find git root. Run from within the marketplace repo.'
            );
            process.exit(1);
          }

          const dirs = findAllPluginDirs(root);
          let generated = 0;
          let skipped = 0;
          let stale = 0;

          for (const dir of dirs) {
            const name = basename(dir);
            if (options.check) {
              const newContent = generateHooksForPlugin(dir, false);
              if (!newContent) {
                skipped++;
                continue;
              }
              const existingPath = join(dir, 'hooks', 'hooks.json');
              const existing = existsSync(existingPath)
                ? readFileSync(existingPath, 'utf-8')
                : '';
              if (existing !== newContent) {
                stale++;
                console.error(`STALE: ${name}/hooks/hooks.json`);
              }
            } else {
              const result = generateHooksForPlugin(dir);
              if (result) {
                generated++;
                if (!options.quiet) {
                  console.log(`Generated: ${name}/hooks/hooks.json`);
                }
              } else {
                skipped++;
              }
            }
          }

          if (options.check) {
            if (stale > 0) {
              console.error(
                `\n${stale} plugin(s) have stale hooks.json. Run 'han plugin generate-hooks --all' to fix.`
              );
              process.exit(1);
            }
            if (!options.quiet) {
              console.log(
                `All hooks.json files are up-to-date (${dirs.length - skipped} checked).`
              );
            }
          } else if (!options.quiet) {
            console.log(
              `\nGenerated ${generated} hooks.json files (${skipped} plugins skipped).`
            );
          }
          return;
        }

        // Single plugin mode
        const targetDir = pluginDir || process.cwd();

        if (!existsSync(join(targetDir, 'han-plugin.yml'))) {
          console.error(
            `No han-plugin.yml found in ${targetDir}. Not a han plugin directory.`
          );
          process.exit(1);
        }

        if (options.check) {
          const newContent = generateHooksForPlugin(targetDir, false);
          if (!newContent) {
            if (!options.quiet) {
              console.log('No hooks to generate.');
            }
            return;
          }
          const existingPath = join(targetDir, 'hooks', 'hooks.json');
          const existing = existsSync(existingPath)
            ? readFileSync(existingPath, 'utf-8')
            : '';
          if (existing !== newContent) {
            console.error(
              "hooks.json is stale. Run 'han plugin generate-hooks' to update."
            );
            process.exit(1);
          }
          if (!options.quiet) {
            console.log('hooks.json is up-to-date.');
          }
          return;
        }

        const result = generateHooksForPlugin(targetDir);
        if (result) {
          if (!options.quiet) {
            console.log(`Generated ${join(targetDir, 'hooks', 'hooks.json')}`);
          }
        } else {
          if (!options.quiet) {
            console.log('No hooks to generate (empty hooks section).');
          }
        }
      }
    );
}
