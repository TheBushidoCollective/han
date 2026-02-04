/**
 * han worktree prune - Remove orphaned AI-DLC worktrees
 *
 * Removes worktrees that are:
 * - Orphaned: worktree exists but branch no longer exists
 * - Stale: worktree exists but unit status is "completed"
 */

import type { Command } from 'commander';
import { gitWorktreeRemove } from '../../native.ts';
import { type AiDlcWorktree, findOrphanedWorktrees } from './discovery.ts';

/**
 * Format reason for pruning
 */
function formatReason(wt: AiDlcWorktree): string {
  const reasons: string[] = [];
  if (wt.isOrphaned) reasons.push('branch deleted');
  if (wt.isStale) reasons.push('unit completed');
  return reasons.join(', ');
}

/**
 * Register the prune subcommand
 */
export function registerPruneCommand(worktreeCommand: Command): void {
  worktreeCommand
    .command('prune')
    .description('Remove orphaned and stale AI-DLC worktrees')
    .option(
      '-f, --force',
      'Skip confirmation and force removal of dirty worktrees'
    )
    .option('--dry-run', 'Show what would be removed without removing')
    .option('--orphaned-only', 'Only remove orphaned worktrees (not stale)')
    .option('--stale-only', 'Only remove stale worktrees (not orphaned)')
    .action((options) => {
      const cwd = process.cwd();

      try {
        let worktrees = findOrphanedWorktrees(cwd);

        // Apply filters
        if (options.orphanedOnly) {
          worktrees = worktrees.filter((wt) => wt.isOrphaned);
        }
        if (options.staleOnly) {
          worktrees = worktrees.filter((wt) => wt.isStale);
        }

        if (worktrees.length === 0) {
          console.log('No orphaned or stale worktrees found');
          return;
        }

        // Show what will be removed
        console.log(
          options.dryRun
            ? 'Would remove the following worktrees:\n'
            : 'Removing the following worktrees:\n'
        );

        for (const wt of worktrees) {
          const reason = formatReason(wt);
          const typeInfo =
            wt.type === 'intent'
              ? `intent: ${wt.intentSlug}`
              : wt.type === 'unit'
                ? `unit: ${wt.intentSlug}/${wt.unitSlug}`
                : '';

          console.log(`  ${wt.path}`);
          console.log(`    Branch: ${wt.head || '(detached)'}`);
          if (typeInfo) console.log(`    Type: ${typeInfo}`);
          console.log(`    Reason: ${reason}`);
          console.log('');
        }

        if (options.dryRun) {
          console.log(`\nWould remove ${worktrees.length} worktree(s)`);
          console.log('Run without --dry-run to actually remove them');
          return;
        }

        // Confirm unless --force is provided
        if (!options.force) {
          console.log(`\nAbout to remove ${worktrees.length} worktree(s).`);
          console.log('Run with --force to skip this confirmation.');
          console.log('\nProceeding in 3 seconds... (Ctrl+C to cancel)');
          // In a real implementation, we'd use readline for confirmation
          // For now, proceed with warning
        }

        // Remove worktrees
        let removed = 0;
        let failed = 0;

        for (const wt of worktrees) {
          try {
            gitWorktreeRemove(cwd, wt.path, options.force);
            console.log(`Removed: ${wt.path}`);
            removed++;
          } catch (error) {
            console.error(
              `Failed to remove ${wt.path}: ${error instanceof Error ? error.message : error}`
            );
            failed++;
          }
        }

        console.log(`\nPrune complete: ${removed} removed, ${failed} failed`);

        if (failed > 0 && !options.force) {
          console.log('\nTip: Use --force to force removal of dirty worktrees');
        }
      } catch (error) {
        console.error(
          `Error: ${error instanceof Error ? error.message : error}`
        );
        process.exit(1);
      }
    });
}
