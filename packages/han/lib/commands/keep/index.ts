/**
 * han keep - Scoped key-value storage
 *
 * Commands:
 *   han keep save <key> [content...]    Save content to storage
 *   han keep load <key>                 Load content from storage
 *   han keep list                       List all keys in scope
 *   han keep delete <key>               Delete a key from storage
 *   han keep clear                      Clear all keys in scope
 *
 * Scoping:
 *   --global    Global storage (shared across all repos)
 *   --repo      Repository-scoped (shared across branches)
 *   --branch    Branch-scoped (default)
 */
import { readFileSync } from 'node:fs';
import type { Command } from 'commander';
import {
  clear,
  getStoragePath,
  list,
  load,
  remove,
  type Scope,
  type StorageOptions,
  save,
} from './storage.ts';

/**
 * Parse scope and options from command options
 */
function parseScopeAndOptions(options: {
  global?: boolean;
  repo?: boolean;
  branch?: string | boolean;
}): { scope: Scope; storageOptions: StorageOptions } {
  if (options.global) return { scope: 'global', storageOptions: {} };
  if (options.repo) return { scope: 'repo', storageOptions: {} };

  // Branch scope - may have explicit branch name
  const storageOptions: StorageOptions = {};
  if (typeof options.branch === 'string') {
    storageOptions.branchName = options.branch;
  }

  return { scope: 'branch', storageOptions };
}

/**
 * Register han keep commands
 */
export function registerKeepCommands(program: Command): void {
  const keepCommand = program
    .command('keep')
    .description(
      'Scoped key-value storage for persisting state across sessions'
    );

  // han keep save <key> [content...]
  keepCommand
    .command('save <key> [content...]')
    .description(
      'Save content to storage (reads from stdin if no content provided)'
    )
    .option('--global', 'Use global scope (shared across all repos)')
    .option('--repo', 'Use repo scope (shared across branches)')
    .option(
      '--branch [name]',
      'Use branch scope (default). Optionally specify explicit branch name.'
    )
    .option('--file <path>', 'Read content from file')
    .action(async (key: string, contentParts: string[], options) => {
      // Join content parts back together (handles space-separated arguments)
      let content: string | undefined =
        contentParts.length > 0 ? contentParts.join(' ') : undefined;
      const { scope, storageOptions } = parseScopeAndOptions(options);

      // Priority: --file > argument > stdin
      if (options.file) {
        try {
          content = readFileSync(options.file, 'utf-8');
        } catch (_err) {
          console.error(`Error reading file: ${options.file}`);
          process.exit(1);
        }
      } else if (content === undefined) {
        // No content argument, read from stdin
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk);
        }
        content = Buffer.concat(chunks).toString('utf-8').trimEnd();
      }

      try {
        save(scope, key, content, storageOptions);
        const branchSuffix = storageOptions.branchName
          ? ` (${storageOptions.branchName})`
          : '';
        console.log(`Saved to ${scope}:${key}${branchSuffix}`);
        process.exit(0);
      } catch (error) {
        console.error(
          `Error saving ${key}:`,
          error instanceof Error ? error.message : error
        );
        process.exit(1);
      }
    });

  // han keep load <key>
  keepCommand
    .command('load <key>')
    .description('Load content from storage')
    .option('--global', 'Use global scope')
    .option('--repo', 'Use repo scope')
    .option(
      '--branch [name]',
      'Use branch scope (default). Optionally specify explicit branch name.'
    )
    .option('-q, --quiet', 'Suppress errors if key not found')
    .option('-p, --path', 'Output file path instead of content')
    .action((key: string, options) => {
      const { scope, storageOptions } = parseScopeAndOptions(options);

      try {
        // If --path, just output the path (even if file doesn't exist)
        if (options.path) {
          const path = getStoragePath(scope, key, storageOptions);
          console.log(path);
          process.exit(0);
        }

        const content = load(scope, key, storageOptions);

        if (content === null) {
          if (!options.quiet) {
            console.error(`Key not found: ${scope}:${key}`);
          }
          process.exit(1);
        }

        console.log(content);
        process.exit(0);
      } catch (error) {
        if (!options.quiet) {
          console.error(
            `Error loading ${key}:`,
            error instanceof Error ? error.message : error
          );
        }
        process.exit(1);
      }
    });

  // han keep list
  keepCommand
    .command('list')
    .description('List all keys in scope')
    .option('--global', 'Use global scope')
    .option('--repo', 'Use repo scope')
    .option(
      '--branch [name]',
      'Use branch scope (default). Optionally specify explicit branch name.'
    )
    .option('--json', 'Output as JSON array')
    .action((options) => {
      const { scope, storageOptions } = parseScopeAndOptions(options);

      try {
        const keys = list(scope, storageOptions);

        if (options.json) {
          console.log(JSON.stringify(keys));
        } else if (keys.length === 0) {
          console.log(`No keys in ${scope} scope`);
        } else {
          for (const key of keys) {
            console.log(key);
          }
        }
        process.exit(0);
      } catch (error) {
        console.error(
          'Error listing keys:',
          error instanceof Error ? error.message : error
        );
        process.exit(1);
      }
    });

  // han keep delete <key>
  keepCommand
    .command('delete <key>')
    .description('Delete a key from storage')
    .option('--global', 'Use global scope')
    .option('--repo', 'Use repo scope')
    .option(
      '--branch [name]',
      'Use branch scope (default). Optionally specify explicit branch name.'
    )
    .option('-q, --quiet', 'Suppress errors if key not found')
    .action((key: string, options) => {
      const { scope, storageOptions } = parseScopeAndOptions(options);

      try {
        const deleted = remove(scope, key, storageOptions);

        if (!deleted && !options.quiet) {
          console.error(`Key not found: ${scope}:${key}`);
          process.exit(1);
        }

        if (deleted) {
          const branchSuffix = storageOptions.branchName
            ? ` (${storageOptions.branchName})`
            : '';
          console.log(`Deleted ${scope}:${key}${branchSuffix}`);
        }
        process.exit(0);
      } catch (error) {
        if (!options.quiet) {
          console.error(
            `Error deleting ${key}:`,
            error instanceof Error ? error.message : error
          );
        }
        process.exit(1);
      }
    });

  // han keep clear
  keepCommand
    .command('clear')
    .description('Clear all keys in scope')
    .option('--global', 'Use global scope')
    .option('--repo', 'Use repo scope')
    .option(
      '--branch [name]',
      'Use branch scope (default). Optionally specify explicit branch name.'
    )
    .option('-f, --force', 'Skip confirmation prompt')
    .action((options) => {
      const { scope, storageOptions } = parseScopeAndOptions(options);

      try {
        const keys = list(scope, storageOptions);

        if (keys.length === 0) {
          console.log(`No keys to clear in ${scope} scope`);
          return;
        }

        // For now, just proceed (could add interactive prompt later)
        if (!options.force) {
          const branchSuffix = storageOptions.branchName
            ? ` (${storageOptions.branchName})`
            : '';
          console.log(
            `Clearing ${keys.length} key(s) from ${scope} scope${branchSuffix}:`
          );
          for (const key of keys) {
            console.log(`  - ${key}`);
          }
        }

        const deleted = clear(scope, storageOptions);
        const branchSuffix = storageOptions.branchName
          ? ` (${storageOptions.branchName})`
          : '';
        console.log(
          `Cleared ${deleted} key(s) from ${scope} scope${branchSuffix}`
        );
        process.exit(0);
      } catch (error) {
        console.error(
          'Error clearing keys:',
          error instanceof Error ? error.message : error
        );
        process.exit(1);
      }
    });
}
