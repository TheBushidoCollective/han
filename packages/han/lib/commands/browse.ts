import type { Command } from 'commander';

/**
 * Register browse command
 *
 * Opens the Han system browser - a web UI for viewing sessions,
 * metrics, projects, plugins, and other Han features.
 *
 * In development: Uses Vite with hot module reload
 * In compiled binary: Serves embedded static assets
 */
export function registerBrowseCommand(program: Command): void {
  program
    .command('browse')
    .description('Open Han system browser in web browser')
    .option('-p, --port <port>', 'Specific port (default: 41956)')
    .option('--no-open', "Don't auto-open browser")
    .action(async (options: { port?: string; open?: boolean }) => {
      try {
        // Use computed path to prevent bundler from following the import
        // In dev mode, this loads Vite; in binary, it serves embedded assets
        const browsePath = ['.', 'browse', 'index.ts'].join('/');
        const { browse } = await import(browsePath);
        await browse({
          port: options.port ? parseInt(options.port, 10) : undefined,
          autoOpen: options.open !== false,
        });
      } catch (error: unknown) {
        console.error(
          'Error starting browser:',
          error instanceof Error ? error.message : error
        );
        process.exit(1);
      }
    });
}
