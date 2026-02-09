/**
 * Hook matching: determines which hooks should fire for a given context.
 *
 * Checks tool name against toolFilter and file path against fileFilter
 * to find hooks that apply to a specific validation request.
 */

import { existsSync } from "node:fs"
import { join, relative } from "node:path"
import type { HookDefinition } from "./types"

/**
 * Test if a file path matches a glob-like pattern.
 */
function matchGlob(pattern: string, filePath: string): boolean {
  let regexStr = pattern
    .replace(/\./g, "\\.")
    .replace(/\{([^}]+)\}/g, (_match, group: string) => {
      const alts = group.split(",").map((s: string) => s.trim())
      return `(${alts.join("|")})`
    })
    .replace(/\*\*/g, "<<<GLOBSTAR>>>")
    .replace(/\*/g, "[^/]*")
    .replace(/<<<GLOBSTAR>>>/g, ".*")

  regexStr = `^${regexStr}$`

  try {
    return new RegExp(regexStr).test(filePath)
  } catch {
    return false
  }
}

/**
 * Check if a hook's dirsWith requirement is met.
 */
function checkDirsWith(
  hook: HookDefinition,
  projectDir: string,
): boolean {
  if (!hook.dirsWith || hook.dirsWith.length === 0) return true
  return hook.dirsWith.some((requiredFile) =>
    existsSync(join(projectDir, requiredFile)),
  )
}

/**
 * Check if a file matches the hook's fileFilter patterns.
 */
function checkFileFilter(
  hook: HookDefinition,
  filePath: string,
  projectDir: string,
): boolean {
  if (!hook.fileFilter || hook.fileFilter.length === 0) return true
  const relPath = relative(projectDir, filePath)
  return hook.fileFilter.some(
    (pattern) => matchGlob(pattern, relPath) || matchGlob(pattern, filePath),
  )
}

/**
 * Check if a tool name matches the hook's toolFilter.
 */
function checkToolFilter(
  hook: HookDefinition,
  claudeToolName: string,
): boolean {
  if (!hook.toolFilter || hook.toolFilter.length === 0) return true
  return hook.toolFilter.includes(claudeToolName)
}

/**
 * Find PostToolUse hooks matching a given tool + file combination.
 */
export function matchPostToolUseHooks(
  hooks: HookDefinition[],
  claudeToolName: string,
  filePath: string,
  projectDir: string,
): HookDefinition[] {
  return hooks.filter((hook) => {
    if (!checkToolFilter(hook, claudeToolName)) return false
    if (!checkDirsWith(hook, projectDir)) return false
    if (!checkFileFilter(hook, filePath, projectDir)) return false
    return true
  })
}

/**
 * Find Stop hooks that apply to the current project.
 */
export function matchStopHooks(
  hooks: HookDefinition[],
  projectDir: string,
): HookDefinition[] {
  return hooks.filter((hook) => checkDirsWith(hook, projectDir))
}
