/**
 * Lightweight event logger for the OpenCode bridge.
 *
 * Writes Han-format JSONL events with provider="opencode" so the
 * coordinator can index them alongside Claude Code session data.
 *
 * Path: ~/.han/opencode/{project-slug}/{sessionId}-han.jsonl
 *
 * This is intentionally NOT under ~/.claude/ because OpenCode sessions
 * are not Claude Code sessions. The coordinator watches this directory
 * via addWatchPath().
 */
import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
const MAX_OUTPUT_LENGTH = 10_000;
/**
 * Convert a filesystem path to a slug (matches han's pathToSlug).
 * Replaces / and . with -
 */
function pathToSlug(fsPath) {
    return fsPath.replace(/^\//, '-').replace(/[/.]/g, '-');
}
/**
 * Get the han data root for OpenCode.
 * Uses ~/.han/opencode/ to keep OpenCode data separate from Claude Code data.
 */
function getHanOpenCodeRoot() {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? '/tmp';
    return join(home, '.han', 'opencode');
}
/**
 * Get the JSONL events file path for an OpenCode session.
 */
function getEventsFilePath(projectDir, sessionId) {
    const slug = pathToSlug(projectDir);
    return join(getHanOpenCodeRoot(), 'projects', slug, `${sessionId}-han.jsonl`);
}
/**
 * Truncate output to prevent enormous JSONL entries.
 */
function truncateOutput(output) {
    if (output.length <= MAX_OUTPUT_LENGTH)
        return output;
    return `${output.slice(0, MAX_OUTPUT_LENGTH)}\n... [truncated, ${output.length - MAX_OUTPUT_LENGTH} more bytes]`;
}
/**
 * Event logger for OpenCode bridge sessions.
 *
 * Writes the same JSONL event format as Han's EventLogger but with
 * a provider field set to "opencode". Events are buffered and flushed
 * on result events or every 100ms.
 */
export class BridgeEventLogger {
    logPath;
    buffer = [];
    flushTimer = null;
    sessionId;
    provider = 'opencode';
    cwd;
    constructor(sessionId, projectDir) {
        this.sessionId = sessionId;
        this.cwd = projectDir;
        this.logPath = getEventsFilePath(projectDir, sessionId);
        // Ensure directory exists
        try {
            mkdirSync(dirname(this.logPath), { recursive: true });
        }
        catch (err) {
            if (err.code !== 'EEXIST') {
                throw err;
            }
        }
        console.error(`[han] Event logger initialized: ${this.logPath}`);
    }
    createBase(type) {
        return {
            uuid: randomUUID(),
            sessionId: this.sessionId,
            type,
            timestamp: new Date().toISOString(),
            provider: this.provider,
            cwd: this.cwd,
        };
    }
    writeEvent(event) {
        const line = `${JSON.stringify(event)}\n`;
        this.buffer.push(line);
        // Flush immediately for result events, batch others
        const type = event.type;
        if (type.endsWith('_result')) {
            this.flush();
        }
        else {
            this.scheduleFlush();
        }
    }
    scheduleFlush() {
        if (this.flushTimer)
            return;
        this.flushTimer = setTimeout(() => {
            this.flush();
        }, 100);
    }
    flush() {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        if (this.buffer.length === 0)
            return;
        try {
            appendFileSync(this.logPath, this.buffer.join(''));
            this.buffer = [];
        }
        catch (err) {
            console.error(`[han] Failed to write events:`, err instanceof Error ? err.message : err);
        }
    }
    // ─── Hook Events ──────────────────────────────────────────────────────────
    /**
     * Log hook_run event. Returns UUID for correlating with hook_result.
     */
    logHookRun(hook, hookType) {
        const base = this.createBase('hook_run');
        this.writeEvent({
            ...base,
            data: {
                plugin: hook.pluginName,
                hook: hook.name,
                hook_type: hookType,
                directory: this.cwd,
                cached: false,
                command: hook.command,
            },
        });
        return base.uuid;
    }
    /**
     * Log hook_result event.
     */
    logHookResult(result, hookType, hookRunId) {
        this.writeEvent({
            ...this.createBase('hook_result'),
            hookRunId,
            data: {
                plugin: result.hook.pluginName,
                hook: result.hook.name,
                hook_type: hookType,
                directory: this.cwd,
                cached: result.skipped,
                duration_ms: result.durationMs,
                exit_code: result.exitCode,
                success: result.exitCode === 0,
                output: result.stdout ? truncateOutput(result.stdout) : undefined,
                error: result.stderr || undefined,
                command: result.hook.command,
            },
        });
    }
    /**
     * Log hook_file_change event (file edit detected via tool event).
     */
    logFileChange(toolName, filePath) {
        this.writeEvent({
            ...this.createBase('hook_file_change'),
            data: {
                session_id: this.sessionId,
                tool_name: toolName,
                file_path: filePath,
            },
        });
    }
    /**
     * Get the log file path (for coordinator watch registration).
     */
    getLogPath() {
        return this.logPath;
    }
    /**
     * Get the projects directory (for coordinator watch path).
     */
    getWatchDir() {
        return join(getHanOpenCodeRoot(), 'projects');
    }
}
