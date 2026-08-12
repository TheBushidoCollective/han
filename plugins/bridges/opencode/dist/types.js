/**
 * Shared type definitions for the Han-OpenCode bridge.
 */
const HAN_HARNESSES = [
    'claude-code',
    'omp',
    'opencode',
    'gemini-cli',
    'kiro',
    'codex',
    'antigravity',
];
function isHanHarness(value) {
    return (value !== undefined && HAN_HARNESSES.includes(value));
}
/**
 * Resolve the harness running this session from the environment.
 * The OpenCode bridge sets HAN_PROVIDER for its own child processes.
 */
export function getHarness() {
    const env = process.env.HAN_PROVIDER;
    return isHanHarness(env) ? env : 'claude-code';
}
// ─── OpenCode → Claude Code Tool Name Mapping ───────────────────────────────
/**
 * Map OpenCode tool names to Claude Code tool names.
 * OpenCode uses lowercase; Claude Code uses PascalCase.
 */
export const TOOL_NAME_MAP = {
    edit: 'Edit',
    write: 'Write',
    bash: 'Bash',
    read: 'Read',
    glob: 'Glob',
    grep: 'Grep',
    notebook_edit: 'NotebookEdit',
};
export function mapToolName(openCodeTool) {
    return TOOL_NAME_MAP[openCodeTool.toLowerCase()] ?? openCodeTool;
}
