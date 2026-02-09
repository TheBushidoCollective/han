/**
 * Content-hash cache for hook execution.
 *
 * Tracks file content hashes per hook. If a file's hash hasn't changed
 * since the last successful run of a hook, that hook is skipped.
 *
 * The bridge knows every file write via tool.execute.after, so we have
 * the same information that Han's transcript-based file tracking provides.
 * No JSONL parsing needed - the events give us file paths directly.
 *
 * Cache key: `${pluginName}:${hookName}:${filePath}`
 * Cache value: content hash after last successful hook run
 */
/**
 * Check if a hook can be skipped for the given file.
 *
 * Returns true if the file's content hash matches the hash from
 * the last successful run of this hook on this file.
 */
export declare function shouldSkipHook(pluginName: string, hookName: string, filePath: string): boolean;
/**
 * Record a successful hook run. Stores the current content hash
 * so future runs on the same unchanged file can be skipped.
 */
export declare function recordSuccess(pluginName: string, hookName: string, filePath: string): void;
/**
 * Invalidate cache for a file across all hooks.
 * Called when we know a file was modified (e.g. from a tool event
 * before hooks run, ensuring stale cache doesn't skip validation).
 */
export declare function invalidateFile(filePath: string): void;
/**
 * Clear the entire cache. Useful for session reset.
 */
export declare function clearCache(): void;
