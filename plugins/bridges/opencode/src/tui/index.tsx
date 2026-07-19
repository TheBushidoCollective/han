/** @jsxImportSource @opentui/solid */
/**
 * Han TUI plugin for OpenCode.
 *
 * Renders Han validation status inside the OpenCode TUI:
 *
 * - Sidebar footer panel with plugin/skill counts and the last
 *   validation result for the current project
 * - Error toast when a new validation run fails
 * - "Han: Validation Summary" palette/slash command showing the
 *   most recent run's failures
 *
 * Data comes from ~/.han/opencode/status/{project-slug}.json, written
 * by the bridge's server plugin after every validation run. The two
 * plugins run in different processes, so the status file is the
 * channel between them.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TuiPlugin } from '@opencode-ai/plugin/tui';
import { createSignal, onCleanup } from 'solid-js';

interface ValidationRunSummary {
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

interface HanBridgeStatus {
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

function readStatus(projectDir: string): HanBridgeStatus | null {
  try {
    const path = statusFilePath(projectDir);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8')) as HanBridgeStatus;
  } catch {
    return null;
  }
}

function summarizeFailures(status: HanBridgeStatus): string {
  const run = status.lastRun;
  if (!run) return 'No validation runs yet this session.';
  const lines = [
    `${run.event} run at ${new Date(run.at).toLocaleTimeString()}`,
    `${run.passed} passed, ${run.failed} failed, ${run.skipped} skipped (${run.total} hooks)`,
  ];
  for (const f of run.failures) {
    lines.push('', `${f.hook} [${f.plugin}] exit ${f.exitCode}`, f.message);
  }
  return lines.join('\n');
}

const tui: TuiPlugin = async (api, _options, _meta) => {
  const projectDir = process.cwd();
  const [status, setStatus] = createSignal<HanBridgeStatus | null>(
    readStatus(projectDir)
  );
  let lastToastedSeq = status()?.lastRun?.seq ?? 0;

  function refresh(): void {
    const next = readStatus(projectDir);
    setStatus(next);
    const run = next?.lastRun;
    if (run && run.seq > lastToastedSeq) {
      lastToastedSeq = run.seq;
      if (run.failed > 0) {
        const names = run.failures
          .slice(0, 3)
          .map((f) => f.hook)
          .join(', ');
        api.ui.toast({
          variant: 'error',
          title: `Han: ${run.failed} validation ${run.failed === 1 ? 'failure' : 'failures'}`,
          message: names || `${run.failed} of ${run.total} hooks failed`,
        });
      }
    }
  }

  const timer = setInterval(refresh, 2000);
  api.lifecycle.onDispose(() => clearInterval(timer));
  onCleanup(() => clearInterval(timer));

  const offEdited = api.event.on('file.edited', () => refresh());
  const offIdle = api.event.on('session.idle', () => refresh());
  api.lifecycle.onDispose(() => {
    offEdited();
    offIdle();
  });

  api.command?.register(() => [
    {
      title: 'Han: Validation Summary',
      value: 'han.validation-summary',
      description: 'Show the most recent Han validation run and failures',
      category: 'Han',
      slash: { name: 'han' },
      onSelect: () => {
        const current = readStatus(projectDir);
        if (!current) {
          api.ui.toast({
            variant: 'info',
            message:
              'Han bridge has not run any validation in this project yet.',
          });
          return;
        }
        api.ui.dialog.replace(
          () => (
            <api.ui.DialogAlert
              title="Han Validation Summary"
              message={summarizeFailures(current)}
            />
          ),
          () => {}
        );
      },
    },
  ]);

  api.slots.register({
    slots: {
      sidebar_footer: () => {
        const current = status();
        if (!current) {
          return (
            <box flexDirection="column" paddingLeft={1} paddingRight={1}>
              <text fg="#6b7a8d">Han: no validation data</text>
            </box>
          );
        }
        const run = current.lastRun;
        return (
          <box flexDirection="column" paddingLeft={1} paddingRight={1}>
            <text fg="#00b4d8">
              {`Han · ${current.plugins} plugins · ${current.skills} skills`}
            </text>
            {run ? (
              <text fg={run.failed > 0 ? '#f48c06' : '#7dcfff'}>
                {run.failed > 0
                  ? `${run.failed}/${run.total} hooks failing (${run.event})`
                  : `All ${run.total - run.skipped} hooks passing (${run.event})`}
              </text>
            ) : (
              <text fg="#6b7a8d">No validation runs yet</text>
            )}
          </box>
        );
      },
    },
  });
};

export default { id: 'han', tui };
