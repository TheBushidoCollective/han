import type { Command } from 'commander';
import { orchestrations } from '../../db/index.ts';

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Wait for an orchestration to complete, tailing logs as hooks execute
 */
export async function waitForOrchestration(
  orchestrationId: string,
  options: { pollInterval: number; timeout: number }
): Promise<void> {
  const startTime = Date.now();

  // Get initial orchestration state
  let orch = orchestrations.get(orchestrationId);
  if (!orch) {
    console.error(
      `${colors.red}Error: Orchestration ${orchestrationId} not found${colors.reset}`
    );
    process.exit(1);
  }

  console.error(
    `${colors.cyan}Waiting for orchestration ${orchestrationId}...${colors.reset}`
  );
  console.error(
    `${colors.dim}Hook type: ${orch.hookType} | Project: ${orch.projectRoot}${colors.reset}`
  );
  console.error('');

  // Track which hooks we've already reported on
  const reportedHooks = new Set<string>();

  // Poll until orchestration completes or times out
  while (true) {
    // Check timeout
    const elapsed = Date.now() - startTime;
    if (elapsed > options.timeout) {
      console.error(
        `${colors.yellow}Timeout: Orchestration did not complete within ${formatDuration(options.timeout)}${colors.reset}`
      );
      process.exit(1);
    }

    // Refresh orchestration state
    orch = orchestrations.get(orchestrationId);
    if (!orch) {
      console.error(
        `${colors.red}Error: Orchestration ${orchestrationId} was deleted${colors.reset}`
      );
      process.exit(1);
    }

    // Check if orchestration was cancelled
    if (orch.status === 'cancelled') {
      console.error(
        `${colors.yellow}Orchestration was cancelled (likely by a newer orchestrate call)${colors.reset}`
      );
      process.exit(0);
    }

    // Get all hooks for this orchestration
    const hooks = orchestrations.getHooks(orchestrationId);

    // Report on new hook statuses
    for (const hook of hooks) {
      const hookKey = `${hook.hookSource}/${hook.hookName}:${hook.directory}`;

      // Skip if we've already reported this hook's final state
      if (
        reportedHooks.has(hookKey) &&
        (hook.status === 'completed' ||
          hook.status === 'failed' ||
          hook.status === 'cancelled')
      ) {
        continue;
      }

      // Report running hooks
      if (
        hook.status === 'running' &&
        !reportedHooks.has(`${hookKey}:running`)
      ) {
        const time = new Date().toLocaleTimeString();
        console.error(
          `${colors.dim}[${time}]${colors.reset} ${colors.cyan}⏳ Running: ${hook.hookSource}/${hook.hookName} in ${hook.directory}${colors.reset}`
        );
        reportedHooks.add(`${hookKey}:running`);
      }

      // Report completed hooks
      if (hook.status === 'completed' && !reportedHooks.has(hookKey)) {
        const time = new Date().toLocaleTimeString();
        const duration = hook.durationMs ? formatDuration(hook.durationMs) : '';
        console.error(
          `${colors.dim}[${time}]${colors.reset} ${colors.green}✓ Passed: ${hook.hookSource}/${hook.hookName} in ${hook.directory}${duration ? ` (${duration})` : ''}${colors.reset}`
        );
        if (hook.output?.trim()) {
          // Show truncated output
          const lines = hook.output.trim().split('\n');
          const preview =
            lines.length > 5
              ? [...lines.slice(0, 5), `... (${lines.length - 5} more lines)`]
              : lines;
          for (const line of preview) {
            console.error(`    ${colors.dim}${line}${colors.reset}`);
          }
        }
        reportedHooks.add(hookKey);
      }

      // Report failed hooks
      if (hook.status === 'failed' && !reportedHooks.has(hookKey)) {
        const time = new Date().toLocaleTimeString();
        const duration = hook.durationMs ? formatDuration(hook.durationMs) : '';
        console.error(
          `${colors.dim}[${time}]${colors.reset} ${colors.red}✗ Failed: ${hook.hookSource}/${hook.hookName} in ${hook.directory}${duration ? ` (${duration})` : ''}${colors.reset}`
        );
        if (hook.error?.trim()) {
          for (const line of hook.error.trim().split('\n')) {
            console.error(`    ${colors.red}${line}${colors.reset}`);
          }
        }
        if (hook.output?.trim()) {
          for (const line of hook.output.trim().split('\n')) {
            console.error(`    ${colors.dim}${line}${colors.reset}`);
          }
        }
        reportedHooks.add(hookKey);
      }

      // Report cancelled hooks
      if (hook.status === 'cancelled' && !reportedHooks.has(hookKey)) {
        const time = new Date().toLocaleTimeString();
        console.error(
          `${colors.dim}[${time}]${colors.reset} ${colors.yellow}⊘ Cancelled: ${hook.hookSource}/${hook.hookName} in ${hook.directory}${colors.reset}`
        );
        reportedHooks.add(hookKey);
      }
    }

    // Check if orchestration is complete
    if (
      orch.status === 'completed' ||
      orch.status === 'failed' ||
      orch.status === 'cancelled'
    ) {
      console.error('');

      // Summary
      const duration = formatDuration(Date.now() - startTime);
      const completed = hooks.filter((h) => h.status === 'completed').length;
      const failed = hooks.filter((h) => h.status === 'failed').length;
      const cancelled = hooks.filter((h) => h.status === 'cancelled').length;
      const pending = hooks.filter(
        (h) => h.status === 'pending' || h.status === 'running'
      ).length;

      if (orch.status === 'completed') {
        console.error(
          `${colors.green}✓ Orchestration completed${colors.reset} (${duration})`
        );
        console.error(
          `  ${completed} passed, ${failed} failed, ${cancelled} cancelled`
        );
        process.exit(failed > 0 ? 1 : 0);
      } else if (orch.status === 'failed') {
        console.error(
          `${colors.red}✗ Orchestration failed${colors.reset} (${duration})`
        );
        console.error(
          `  ${completed} passed, ${failed} failed, ${cancelled} cancelled`
        );
        process.exit(1);
      } else {
        console.error(
          `${colors.yellow}⊘ Orchestration cancelled${colors.reset} (${duration})`
        );
        console.error(
          `  ${completed} completed, ${pending} pending when cancelled`
        );
        process.exit(0);
      }
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, options.pollInterval));
  }
}

/**
 * Register the wait command
 */
export function registerHookWait(hookCommand: Command): void {
  hookCommand
    .command('wait <orchestrationId>')
    .description(
      'Wait for a hook orchestration to complete, tailing logs as hooks execute.\n\n' +
        'This command polls the orchestration status and streams hook output\n' +
        'as each hook completes. Use this after `han hook orchestrate` if hooks\n' +
        'were deferred to background execution.\n\n' +
        'Exit codes:\n' +
        '  0 - All hooks passed (or orchestration was cancelled)\n' +
        '  1 - One or more hooks failed'
    )
    .option(
      '--poll-interval <ms>',
      'How often to poll for status updates',
      '1000'
    )
    .option('--timeout <ms>', 'Maximum time to wait before giving up', '300000')
    .action(
      async (
        orchestrationId: string,
        opts: { pollInterval?: string; timeout?: string }
      ) => {
        const pollInterval = Number.parseInt(opts.pollInterval || '1000', 10);
        const timeout = Number.parseInt(opts.timeout || '300000', 10);

        await waitForOrchestration(orchestrationId, { pollInterval, timeout });
      }
    );
}
