/**
 * Lightweight event logger for the OpenCode bridge.
 *
 * Writes Han-format JSONL events with harness="opencode" so the
 * coordinator can index them alongside Claude Code session data.
 *
 * Path: ~/.han/opencode/projects/{project-slug}/{sessionId}-han.jsonl
 *
 * This is intentionally NOT under ~/.claude/ because OpenCode sessions
 * are not Claude Code sessions. The coordinator watches
 * ~/.han/<harness>/projects for standalone han-event files.
 */
import type { HookDefinition, HookResult } from './types';
/**
 * Event logger for OpenCode bridge sessions.
 *
 * Writes the same JSONL event format as Han's EventLogger but with
 * a harness field set to "opencode". Events are buffered and flushed
 * on result events or every 100ms.
 */
export declare class BridgeEventLogger {
    private logPath;
    private buffer;
    private flushTimer;
    private readonly sessionId;
    private readonly harness;
    private readonly cwd;
    constructor(sessionId: string, projectDir: string);
    private createBase;
    private writeEvent;
    private scheduleFlush;
    flush(): void;
    /**
     * Log hook_run event. Returns UUID for correlating with hook_result.
     */
    logHookRun(hook: HookDefinition, hookType: string): string;
    /**
     * Log hook_result event.
     */
    logHookResult(result: HookResult, hookType: string, hookRunId: string): void;
    /**
     * Log hook_file_change event (file edit detected via tool event).
     */
    logFileChange(toolName: string, filePath: string): void;
    /**
     * Get the log file path (for coordinator watch registration).
     */
    getLogPath(): string;
}
