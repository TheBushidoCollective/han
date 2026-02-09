/**
 * Hook matching: determines which hooks should fire for a given tool event.
 *
 * Checks tool name against toolFilter and file path against fileFilter
 * to find hooks that apply to this specific tool execution.
 */
import type { HookDefinition } from './types';
/**
 * Find all PostToolUse hooks that match a given tool execution.
 *
 * @param hooks - All discovered PostToolUse hooks
 * @param claudeToolName - Claude Code tool name (e.g. "Edit", "Write")
 * @param filePath - Absolute path to the file that was modified
 * @param projectDir - Project root directory
 * @returns Hooks that should run for this tool event
 */
export declare function matchPostToolUseHooks(hooks: HookDefinition[], claudeToolName: string, filePath: string, projectDir: string): HookDefinition[];
/**
 * Find all Stop hooks that apply to the current project.
 *
 * @param hooks - All discovered Stop hooks
 * @param projectDir - Project root directory
 * @returns Hooks that should run for this project
 */
export declare function matchStopHooks(hooks: HookDefinition[], projectDir: string): HookDefinition[];
