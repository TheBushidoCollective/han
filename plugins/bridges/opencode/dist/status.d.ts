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
    hooks: {
        preToolUse: number;
        postToolUse: number;
        stop: number;
    };
    skills: number;
    disciplines: number;
    startedAt: string;
    lastRun?: ValidationRunSummary;
}
/**
 * Tracks discovery counts and writes status updates for the TUI.
 */
export declare class BridgeStatusWriter {
    private readonly filePath;
    private status;
    constructor(projectDir: string, counts: HanBridgeStatus['hooks'] & {
        plugins: number;
        skills: number;
        disciplines: number;
    });
    private readSeq;
    private write;
    /**
     * Record a completed validation run. Called after PostToolUse and Stop
     * hook executions finish.
     */
    recordRun(event: ValidationRunSummary['event'], results: HookResult[], file?: string): void;
}
