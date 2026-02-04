import type { Command } from 'commander';
import { install } from '../install.ts';
import { uninstall } from '../uninstall.ts';
import { validate } from '../validate.ts';
import { orchestrate } from './hook/orchestrate.ts';

/**
 * Register backwards compatibility command aliases
 */
export function registerAliasCommands(program: Command): void {
  // Alias: han install -> han plugin install --auto
  program
    .command('install')
    .description("Alias for 'plugin install --auto'")
    .option(
      '--scope <scope>',
      'Installation scope: "project" or "local"',
      'project'
    )
    .action(async (options: { scope?: string }) => {
      try {
        const scope = options.scope || 'project';
        if (scope !== 'project' && scope !== 'local') {
          console.error('Error: --scope must be either "project" or "local"');
          process.exit(1);
        }
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

  // Alias: han uninstall -> remove Han marketplace and plugins
  program
    .command('uninstall')
    .description('Remove Han marketplace and plugins')
    .action(async () => {
      uninstall();
      process.exit(0);
    });

  // Alias: han validate-legacy -> han hook run (deprecated legacy format)
  // Kept for backwards compatibility with old scripts
  program
    .command('validate-legacy [ignored...]')
    .description(
      "[DEPRECATED] Legacy validate format. Use 'han validate' instead.\n" +
        'Requires -- before command (e.g., han validate-legacy --dirs-with package.json -- npm test)'
    )
    .option(
      '--no-fail-fast',
      'Disable fail-fast - continue running even after failures'
    )
    .option('--fail-fast', '(Deprecated) Fail-fast is now the default behavior')
    .option(
      '--dirs-with <file>',
      'Only run in directories containing the specified file'
    )
    .allowUnknownOption()
    .action(
      async (
        _ignored: string[],
        options: { failFast?: boolean; dirsWith?: string }
      ) => {
        // Parse command from process.argv after --
        const separatorIndex = process.argv.indexOf('--');

        if (separatorIndex === -1) {
          console.error(
            'Error: Command must be specified after -- separator\n\nExample: han validate-legacy --dirs-with package.json -- npm test'
          );
          process.exit(1);
        }

        const commandArgs = process.argv.slice(separatorIndex + 1);

        if (commandArgs.length === 0) {
          console.error(
            'Error: No command specified after --\n\nExample: han validate-legacy --dirs-with package.json -- npm test'
          );
          process.exit(1);
        }

        // Commander sets failFast=false when --no-fail-fast is used
        // Default to true for legacy format
        const failFast = options.failFast !== false;

        await validate({
          failFast,
          dirsWith: options.dirsWith || null,
          command: commandArgs.join(' '),
        });
      }
    );

  // New validate command: runs all Stop hooks with phase ordering
  // Phase order: format → lint → typecheck → test → advisory
  program
    .command('validate')
    .description(
      'Run all Stop hooks with dependency ordering.\n\n' +
        'Hooks are executed in phases: format → lint → typecheck → test → advisory.\n' +
        'All hooks in phase N must complete before phase N+1 starts.\n' +
        'If any hook fails in a phase, subsequent phases are skipped.\n\n' +
        'This is useful for running full validation outside of Claude Code sessions,\n' +
        'e.g., in CI/CD pipelines or before committing code.'
    )
    .option('--all-files', 'Ignore cache, run all hooks on all files')
    .option('-v, --verbose', 'Show detailed execution output')
    .option(
      '-c, --check',
      'Check mode: report what hooks would run without executing them'
    )
    .action(
      async (opts: {
        allFiles?: boolean;
        verbose?: boolean;
        check?: boolean;
      }) => {
        try {
          await orchestrate('Stop', {
            onlyChanged: !opts.allFiles, // default true (only changed files)
            failFast: true, // Stop on first failure
            verbose: opts.verbose ?? false,
            wait: true, // Always wait for completion
            check: opts.check ?? false,
          });
          process.exit(0);
        } catch (error: unknown) {
          if (error instanceof Error && error.message.includes('exit code')) {
            // Exit code already set by orchestrate
            process.exit(2);
          }
          console.error(
            'Error during validation:',
            error instanceof Error ? error.message : error
          );
          process.exit(1);
        }
      }
    );
}
