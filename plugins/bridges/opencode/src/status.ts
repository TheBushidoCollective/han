/**
 * Status writer for the OpenCode bridge TUI.
 *
 * Writes a small JSON status document the bridge's TUI plugin reads to
 * render the sidebar panel, toasts, and the validation summary dialog.
 *
 * Path: ~/.han/opencode/status/{project-slug}.json
 *
 * The server plugin (this process) writes; the TUI plugin (separate
 * process) reads. `seq` increments on every validation run so the TUI
 * can tell new results apart from ones it already surfaced.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { HookResult } from './types';

export interface ValidationRunSummary {
  seq: number;
  event: 'PostToolUse' | 'Stop' | 'PreToolUse';
  at: string;
  file?: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  failures: Array<{
    hook: string;
    plugin: string;
    exitCode: number;
    message: string;
  }>;
}

export interface HanBridgeStatus {
  projectDir: string;
  plugins: number;
  hooks: { preToolUse: number; postToolUse: number; stop: number };
  skills: number;
  disciplines: number;
  startedAt: string;
  lastRun?: ValidationRunSummary;
}

function pathToSlug(fsPath: string): string {
  return fsPath.replace(/^\//, '-').replace(/[/.]/g, '-');
}

function statusFilePath(projectDir: string): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '/tmp';
  return join(
    home,
    '.han',
    'opencode',
    'status',
    `${pathToSlug(projectDir)}.json`
  );
}

function firstLine(text: string, max = 200): string {
  const line = text.split('\n').find((l) => l.trim().length > 0) ?? '';
  return line.length > max ? `${line.slice(0, max)}...` : line;
}

/**
 * Tracks discovery counts and writes status updates for the TUI.
 */
export class BridgeStatusWriter {
  private readonly filePath: string;
  private status: HanBridgeStatus;

  constructor(
    projectDir: string,
    counts: HanBridgeStatus['hooks'] & {
      plugins: number;
      skills: number;
      disciplines: number;
    }
  ) {
    this.filePath = statusFilePath(projectDir);
    this.status = {
      projectDir,
      plugins: counts.plugins,
      hooks: {
        preToolUse: counts.preToolUse,
        postToolUse: counts.postToolUse,
        stop: counts.stop,
      },
      skills: counts.skills,
      disciplines: counts.disciplines,
      startedAt: new Date().toISOString(),
    };
    this.write();
  }

  private readSeq(): number {
    try {
      if (!existsSync(this.filePath)) return 0;
      const existing = JSON.parse(
        readFileSync(this.filePath, 'utf-8')
      ) as HanBridgeStatus;
      return existing.lastRun?.seq ?? 0;
    } catch {
      return 0;
    }
  }

  private write(): void {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      writeFileSync(this.filePath, JSON.stringify(this.status, null, 2));
    } catch {
      // Status is best-effort; never break the session over it
    }
  }

  /**
   * Record a completed validation run. Called after PostToolUse and Stop
   * hook executions finish.
   */
  recordRun(
    event: ValidationRunSummary['event'],
    results: HookResult[],
    file?: string
  ): void {
    const failed = results.filter((r) => !r.skipped && r.exitCode !== 0);
    const passed = results.filter((r) => !r.skipped && r.exitCode === 0);
    const skipped = results.filter((r) => r.skipped);

    this.status.lastRun = {
      seq: this.readSeq() + 1,
      event,
      at: new Date().toISOString(),
      ...(file ? { file } : {}),
      total: results.length,
      passed: passed.length,
      failed: failed.length,
      skipped: skipped.length,
      durationMs: results.reduce((sum, r) => sum + r.durationMs, 0),
      failures: failed.slice(0, 10).map((r) => ({
        hook: r.hook.name,
        plugin: r.hook.pluginName,
        exitCode: r.exitCode,
        message: firstLine(r.stderr || r.stdout),
      })),
    };
    this.write();
  }
}
