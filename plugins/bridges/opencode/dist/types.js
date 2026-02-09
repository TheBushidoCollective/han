/**
 * Shared type definitions for the Han-OpenCode bridge.
 */
export function getProvider() {
    const env = process.env.HAN_PROVIDER;
    if (env === 'opencode')
        return 'opencode';
    return 'claude-code';
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
