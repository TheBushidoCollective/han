#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('han')
  .description("Utilities for The Bushido Collective's Han Code Marketplace")
  .version('1.0.0');

// Install command
program
  .command('install')
  .description('Install Han marketplace and plugins')
  .action(async () => {
    try {
      const { install } = await import('./install.ts');
      await install();
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
    const { uninstall } = await import('./uninstall.ts');
    uninstall();
    process.exit(0);
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
  .action(
    async (
      commandArgs: string[],
      options: { failFast?: boolean; dirsWith?: string }
    ) => {
      const { validate } = await import('./validate.ts');
      validate({
        failFast: options.failFast || false,
        dirsWith: options.dirsWith || null,
        command: commandArgs.join(' '),
      });
    }
  );

program.parse();
