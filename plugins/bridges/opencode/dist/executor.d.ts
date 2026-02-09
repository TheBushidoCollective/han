/**
 * Promise-based hook executor.
 *
 * Runs hook commands as child processes, capturing stdout/stderr/exit code.
 * Unlike han's fire-and-forget dispatch, this awaits all results and returns
 * structured data that can be formatted into actionable agent feedback.
 */
import type { BridgeEventLogger } from './events';
import type { HookDefinition, HookResult } from './types';
/**
 * Execute a single hook command as a promise.
 *
 * Substitutes ${HAN_FILES} with the provided file path(s) and runs
 * the command in the project directory with proper environment setup.
 */
export declare function executeHook(hook: HookDefinition, filePaths: string[], options: {
    cwd: string;
    sessionId: string;
    timeout?: number;
    eventLogger?: BridgeEventLogger;
    hookType?: string;
}): Promise<HookResult>;
/**
 * Execute multiple hooks in parallel and collect all results.
 *
 * Runs all hooks as concurrent promises. Each hook runs independently;
 * one failure does not affect others.
 */
export declare function executeHooksParallel(hooks: HookDefinition[], filePaths: string[], options: {
    cwd: string;
    sessionId: string;
    timeout?: number;
    eventLogger?: BridgeEventLogger;
    hookType?: string;
}): Promise<HookResult[]>;
