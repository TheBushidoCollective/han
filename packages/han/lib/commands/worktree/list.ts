/**
 * han worktree list - Enhanced list command for AI-DLC worktrees
 *
 * Lists all git worktrees with AI-DLC specific information:
 * - Intent and unit associations
 * - Status (active, stale, orphaned)
 * - Unit completion status
 */

import type { Command } from 'commander';
import { type AiDlcWorktree, discoverAiDlcWorktrees } from './discovery.ts';

/**
 * Format worktree status for display
 */
function formatStatus(wt: AiDlcWorktree): string {
  const statuses: string[] = [];

  if (wt.isMain) statuses.push('main');
  if (wt.isLocked) statuses.push('locked');
  if (wt.isOrphaned) statuses.push('orphaned');
  if (wt.isStale) statuses.push('stale');

  return statuses.length > 0 ? `[${statuses.join(', ')}]` : '';
}

/**
 * Register the enhanced list subcommand
 */
export function registerListCommand(worktreeCommand: Command): void {
  worktreeCommand
    .command('list')
    .description('List all worktrees with AI-DLC status')
    .option('--json', 'Output as JSON')
    .option('--ai-dlc', 'Only show AI-DLC worktrees')
    .option('--orphaned', 'Only show orphaned or stale worktrees')
    .option('--intent <slug>', 'Filter by intent slug')
    .action((options) => {
      const cwd = process.cwd();

      try {
        let worktrees: AiDlcWorktree[];

        if (options.aiDlc || options.intent || options.orphaned) {
          // Use AI-DLC enhanced discovery
          worktrees = discoverAiDlcWorktrees(cwd);

          if (options.aiDlc) {
            worktrees = worktrees.filter((wt) => wt.type !== 'non-ai-dlc');
          }

          if (options.orphaned) {
            worktrees = worktrees.filter(
              (wt) => (wt.isOrphaned || wt.isStale) && !wt.isMain
            );
          }

          if (options.intent) {
            worktrees = worktrees.filter(
              (wt) => wt.intentSlug === options.intent
            );
          }
        } else {
          // Standard list with AI-DLC enhancements
          worktrees = discoverAiDlcWorktrees(cwd);
        }

        if (options.json) {
          console.log(JSON.stringify(worktrees, null, 2));
          return;
        }

        if (worktrees.length === 0) {
          if (options.orphaned) {
            console.log('No orphaned worktrees found');
          } else if (options.aiDlc) {
            console.log('No AI-DLC worktrees found');
          } else {
            console.log('No worktrees found');
          }
          return;
        }

        // Group by type for better display
        const mainWorktree = worktrees.find((wt) => wt.isMain);
        const intentWorktrees = worktrees.filter(
          (wt) => wt.type === 'intent' && !wt.isMain
        );
        const unitWorktrees = worktrees.filter((wt) => wt.type === 'unit');
        const otherWorktrees = worktrees.filter(
          (wt) => wt.type === 'non-ai-dlc' && !wt.isMain
        );

        // Print main worktree
        if (mainWorktree && !options.aiDlc) {
          console.log('\n## Main Worktree\n');
          console.log(
            `  ${mainWorktree.path} ${mainWorktree.head || '(detached)'} [main]`
          );
        }

        // Print intent worktrees
        if (intentWorktrees.length > 0) {
          console.log('\n## Intent Worktrees\n');
          for (const wt of intentWorktrees) {
            const status = formatStatus(wt);
            console.log(`  ${wt.path}`);
            console.log(`    Branch: ${wt.head || '(detached)'}`);
            console.log(`    Intent: ${wt.intentSlug}`);
            if (status) console.log(`    Status: ${status}`);
          }
        }

        // Print unit worktrees
        if (unitWorktrees.length > 0) {
          console.log('\n## Unit Worktrees\n');
          for (const wt of unitWorktrees) {
            const status = formatStatus(wt);
            console.log(`  ${wt.path}`);
            console.log(`    Branch: ${wt.head || '(detached)'}`);
            console.log(`    Intent: ${wt.intentSlug}`);
            console.log(`    Unit: ${wt.unitSlug}`);
            if (status) console.log(`    Status: ${status}`);
          }
        }

        // Print other worktrees
        if (otherWorktrees.length > 0 && !options.aiDlc) {
          console.log('\n## Other Worktrees\n');
          for (const wt of otherWorktrees) {
            const lockStatus = wt.isLocked ? ' [locked]' : '';
            console.log(`  ${wt.path} ${wt.head || '(detached)'}${lockStatus}`);
          }
        }

        // Summary
        console.log('');
        const total = worktrees.length;
        const aiDlcCount = worktrees.filter(
          (wt) => wt.type !== 'non-ai-dlc'
        ).length;
        const orphanedCount = worktrees.filter(
          (wt) => wt.isOrphaned || wt.isStale
        ).length;

        if (orphanedCount > 0) {
          console.log(
            `Total: ${total} worktrees (${aiDlcCount} AI-DLC, ${orphanedCount} orphaned/stale)`
          );
          console.log(
            '\nTip: Run `han worktree prune` to clean up orphaned worktrees'
          );
        } else {
          console.log(`Total: ${total} worktrees (${aiDlcCount} AI-DLC)`);
        }
      } catch (error) {
        console.error(
          `Error: ${error instanceof Error ? error.message : error}`
        );
        process.exit(1);
      }
    });
}
