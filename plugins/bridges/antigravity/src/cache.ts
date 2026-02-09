/**
 * Content-hash cache for hook execution.
 *
 * Tracks file content hashes per hook. If a file's hash hasn't changed
 * since the last successful run of a hook, that hook is skipped.
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
 * Record a successful hook run.
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
 */
export function invalidateFile(filePath: string): void {
  for (const [key] of hashCache) {
    if (key.endsWith(`:${filePath}`)) {
      hashCache.delete(key)
    }
  }
}

/**
 * Clear the entire cache.
 */
export function clearCache(): void {
  hashCache.clear()
}
