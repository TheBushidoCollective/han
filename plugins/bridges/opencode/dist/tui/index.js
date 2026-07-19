import { jsx as _jsx, jsxs as _jsxs } from "@opentui/solid/jsx-runtime";
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
import { createSignal, onCleanup } from 'solid-js';
function pathToSlug(fsPath) {
    return fsPath.replace(/^\//, '-').replace(/[/.]/g, '-');
}
function statusFilePath(projectDir) {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? '/tmp';
    return join(home, '.han', 'opencode', 'status', `${pathToSlug(projectDir)}.json`);
}
function readStatus(projectDir) {
    try {
        const path = statusFilePath(projectDir);
        if (!existsSync(path))
            return null;
        return JSON.parse(readFileSync(path, 'utf-8'));
    }
    catch {
        return null;
    }
}
function summarizeFailures(status) {
    const run = status.lastRun;
    if (!run)
        return 'No validation runs yet this session.';
    const lines = [
        `${run.event} run at ${new Date(run.at).toLocaleTimeString()}`,
        `${run.passed} passed, ${run.failed} failed, ${run.skipped} skipped (${run.total} hooks)`,
    ];
    for (const f of run.failures) {
        lines.push('', `${f.hook} [${f.plugin}] exit ${f.exitCode}`, f.message);
    }
    return lines.join('\n');
}
const tui = async (api, _options, _meta) => {
    const projectDir = process.cwd();
    const [status, setStatus] = createSignal(readStatus(projectDir));
    let lastToastedSeq = status()?.lastRun?.seq ?? 0;
    function refresh() {
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
                        message: 'Han bridge has not run any validation in this project yet.',
                    });
                    return;
                }
                api.ui.dialog.replace(() => (_jsx(api.ui.DialogAlert, { title: "Han Validation Summary", message: summarizeFailures(current) })), () => { });
            },
        },
    ]);
    api.slots.register({
        slots: {
            sidebar_footer: () => {
                const current = status();
                if (!current) {
                    return (_jsx("box", { flexDirection: "column", paddingLeft: 1, paddingRight: 1, children: _jsx("text", { fg: "#6b7a8d", children: "Han: no validation data" }) }));
                }
                const run = current.lastRun;
                return (_jsxs("box", { flexDirection: "column", paddingLeft: 1, paddingRight: 1, children: [_jsx("text", { fg: "#00b4d8", children: `Han · ${current.plugins} plugins · ${current.skills} skills` }), run ? (_jsx("text", { fg: run.failed > 0 ? '#f48c06' : '#7dcfff', children: run.failed > 0
                                ? `${run.failed}/${run.total} hooks failing (${run.event})`
                                : `All ${run.total - run.skipped} hooks passing (${run.event})` })) : (_jsx("text", { fg: "#6b7a8d", children: "No validation runs yet" }))] }));
            },
        },
    });
};
export default { id: 'han', tui };
