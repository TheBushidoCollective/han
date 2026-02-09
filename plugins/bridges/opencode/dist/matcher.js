/**
 * Hook matching: determines which hooks should fire for a given tool event.
 *
 * Checks tool name against toolFilter and file path against fileFilter
 * to find hooks that apply to this specific tool execution.
 */
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
/**
 * Test if a file path matches a glob-like pattern.
 *
 * Supports:
 * - ** for any path segments
 * - * for any characters within a segment
 * - {a,b,c} for alternatives
 */
function matchGlob(pattern, filePath) {
    // Expand brace alternatives: "*.{js,ts}" -> regex with alternation
    let regexStr = pattern
        .replace(/\./g, '\\.')
        .replace(/\{([^}]+)\}/g, (_match, group) => {
        const alts = group.split(',').map((s) => s.trim());
        return `(${alts.join('|')})`;
    })
        .replace(/\*\*/g, '<<<GLOBSTAR>>>')
        .replace(/\*/g, '[^/]*')
        .replace(/<<<GLOBSTAR>>>/g, '.*');
    regexStr = `^${regexStr}$`;
    try {
        return new RegExp(regexStr).test(filePath);
    }
    catch {
        return false;
    }
}
/**
 * Check if a hook's dirsWith requirement is met for the given project directory.
 * dirsWith specifies files/dirs that must exist for the hook to apply.
 */
function checkDirsWith(hook, projectDir) {
    if (!hook.dirsWith || hook.dirsWith.length === 0)
        return true;
    return hook.dirsWith.some((requiredFile) => existsSync(join(projectDir, requiredFile)));
}
/**
 * Check if a file matches the hook's fileFilter patterns.
 */
function checkFileFilter(hook, filePath, projectDir) {
    if (!hook.fileFilter || hook.fileFilter.length === 0)
        return true;
    // Use relative path for glob matching
    const relPath = relative(projectDir, filePath);
    return hook.fileFilter.some((pattern) => matchGlob(pattern, relPath) || matchGlob(pattern, filePath));
}
/**
 * Check if a tool name matches the hook's toolFilter.
 */
function checkToolFilter(hook, claudeToolName) {
    if (!hook.toolFilter || hook.toolFilter.length === 0)
        return true;
    return hook.toolFilter.includes(claudeToolName);
}
/**
 * Find all PostToolUse hooks that match a given tool execution.
 *
 * @param hooks - All discovered PostToolUse hooks
 * @param claudeToolName - Claude Code tool name (e.g. "Edit", "Write")
 * @param filePath - Absolute path to the file that was modified
 * @param projectDir - Project root directory
 * @returns Hooks that should run for this tool event
 */
export function matchPostToolUseHooks(hooks, claudeToolName, filePath, projectDir) {
    return hooks.filter((hook) => {
        if (!checkToolFilter(hook, claudeToolName))
            return false;
        if (!checkDirsWith(hook, projectDir))
            return false;
        if (!checkFileFilter(hook, filePath, projectDir))
            return false;
        return true;
    });
}
/**
 * Find all Stop hooks that apply to the current project.
 *
 * @param hooks - All discovered Stop hooks
 * @param projectDir - Project root directory
 * @returns Hooks that should run for this project
 */
export function matchStopHooks(hooks, projectDir) {
    return hooks.filter((hook) => checkDirsWith(hook, projectDir));
}
