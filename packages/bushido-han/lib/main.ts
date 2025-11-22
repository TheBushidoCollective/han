#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8')
);

const program = new Command();

program
  .name('han')
  .description("Utilities for The Bushido Collective's Han Code Marketplace")
  .version(packageJson.version);

// Install command
program
  .command('install')
  .description('Install Han marketplace and plugins to Claude Code settings')
  .option(
    '--scope <scope>',
    'Installation scope: "project" (.claude/settings.json) or "local" (.claude/settings.local.json)',
    'project'
  )
  .action(async (options: { scope?: string }) => {
    try {
      const scope = options.scope || 'project';
      if (scope !== 'project' && scope !== 'local') {
        console.error('Error: --scope must be either "project" or "local"');
        process.exit(1);
      }
      const { install } = await import('./install.js');
      await install(scope as 'project' | 'local');
      process.exit(0);
    } catch (error: unknown) {
      console.error(
        'Error during installation:',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

// Uninstall command
program
  .command('uninstall')
  .description('Remove Han marketplace and plugins')
  .action(async () => {
    const { uninstall } = await import('./uninstall.js');
    uninstall();
    process.exit(0);
  });

// Align command
program
  .command('align')
  .description('Align plugins with current codebase state in Claude Code settings')
  .option(
    '--scope <scope>',
    'Installation scope: "project" (.claude/settings.json), "local" (.claude/settings.local.json), or auto-detect if not specified'
  )
  .action(async (options: { scope?: string }) => {
    try {
      let scope: 'project' | 'local' | undefined;
      if (options.scope) {
        if (options.scope !== 'project' && options.scope !== 'local') {
          console.error('Error: --scope must be either "project" or "local"');
          process.exit(1);
        }
        scope = options.scope as 'project' | 'local';
      }
      const { align } = await import('./align.js');
      await align(scope);
      process.exit(0);
    } catch (error: unknown) {
      console.error(
        'Error during alignment:',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

// Validate command
program
  .command('validate')
  .description('Validate directories')
  .option('--fail-fast', 'Stop on first failure')
  .option(
    '--dirs-with <file>',
    'Only run in directories containing the specified file'
  )
  .argument('<command...>', 'Command to run in each directory')
  .allowUnknownOption()
  .action(
    async (
      commandArgs: string[],
      options: { failFast?: boolean; dirsWith?: string }
    ) => {
      const { validate } = await import('./validate.js');
      validate({
        failFast: options.failFast || false,
        dirsWith: options.dirsWith || null,
        command: commandArgs.join(' '),
      });
    }
  );

program.parse();
