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

import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"

/** Map of cache keys to content hashes from the last successful run */
const hashCache = new Map<string, string>()

/**
 * Compute SHA-256 hash of a file's contents.
 * Returns null if the file can't be read.
 */
function hashFile(filePath: string): string | null {
  try {
    const content = readFileSync(filePath)
    return createHash("sha256").update(content).digest("hex")
  } catch {
    return null
  }
}

function cacheKey(
  pluginName: string,
  hookName: string,
  filePath: string,
): string {
  return `${pluginName}:${hookName}:${filePath}`
}

/**
 * Check if a hook can be skipped for the given file.
 *
 * Returns true if the file's content hash matches the hash from
 * the last successful run of this hook on this file.
 */
export function shouldSkipHook(
  pluginName: string,
  hookName: string,
  filePath: string,
): boolean {
  const key = cacheKey(pluginName, hookName, filePath)
  const cachedHash = hashCache.get(key)
  if (!cachedHash) return false

  const currentHash = hashFile(filePath)
  if (!currentHash) return false

  return cachedHash === currentHash
}

/**
 * Record a successful hook run. Stores the current content hash
 * so future runs on the same unchanged file can be skipped.
 */
export function recordSuccess(
  pluginName: string,
  hookName: string,
  filePath: string,
): void {
  const hash = hashFile(filePath)
  if (hash) {
    const key = cacheKey(pluginName, hookName, filePath)
    hashCache.set(key, hash)
  }
}

/**
 * Invalidate cache for a file across all hooks.
 * Called when we know a file was modified (e.g. from a tool event
 * before hooks run, ensuring stale cache doesn't skip validation).
 */
export function invalidateFile(filePath: string): void {
  for (const [key] of hashCache) {
    if (key.endsWith(`:${filePath}`)) {
      hashCache.delete(key)
    }
  }
}

/**
 * Clear the entire cache. Useful for session reset.
 */
export function clearCache(): void {
  hashCache.clear()
}
