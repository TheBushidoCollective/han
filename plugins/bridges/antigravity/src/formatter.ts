/**
 * Result formatting: turns raw hook results into structured messages
 * for MCP tool responses.
 *
 * Uses XML-like tags for clear structure, matching the OpenCode bridge's
 * format so results are consistent across providers.
 */

import type { HookResult } from "./types"

/**
 * Format a single hook result as a structured validation block.
 */
function formatSingleResult(result: HookResult): string {
  const { hook, exitCode, stdout, stderr } = result
  const status = exitCode === 0 ? "passed" : "failed"
  const output = (stdout || stderr).trim()

  if (!output) return ""

  return [
    `<han-validation plugin="${hook.pluginName}" hook="${hook.name}" status="${status}">`,
    output,
    `</han-validation>`,
  ].join("\n")
}

/**
 * Format validation results for MCP tool response.
 *
 * Returns all results (passed and failed) with clear status indicators
 * since MCP tools return complete responses.
 */
export function formatValidationResults(
  results: HookResult[],
  filePaths?: string[],
): string {
  const failures = results.filter((r) => !r.skipped && r.exitCode !== 0)
  const successes = results.filter((r) => !r.skipped && r.exitCode === 0)
  const skipped = results.filter((r) => r.skipped)

  if (failures.length === 0 && successes.length === 0 && skipped.length === 0) {
    return "No validation hooks matched. Ensure Han plugins are installed: han plugin install --auto"
  }

  const lines: string[] = []

  if (filePaths && filePaths.length > 0) {
    lines.push(`Files: ${filePaths.join(", ")}\n`)
  }

  if (failures.length > 0) {
    lines.push(
      `**${failures.length} validation issue${failures.length > 1 ? "s" : ""} found:**\n`,
    )
    for (const result of failures) {
      const block = formatSingleResult(result)
      if (block) lines.push(block)
    }
  }

  if (successes.length > 0) {
    lines.push(
      `\n**${successes.length} check${successes.length > 1 ? "s" : ""} passed:**`,
    )
    for (const result of successes) {
      lines.push(`- ${result.hook.pluginName}/${result.hook.name} (${result.durationMs}ms)`)
    }
  }

  if (skipped.length > 0) {
    lines.push(`\n*${skipped.length} hook${skipped.length > 1 ? "s" : ""} skipped (cached/no matching files)*`)
  }

  if (failures.length === 0) {
    lines.push("\nAll validation checks passed.")
  } else {
    lines.push("\nPlease fix the issues above before continuing.")
  }

  return lines.join("\n")
}

/**
 * Format Stop hook results (project-wide validation).
 */
export function formatStopResults(results: HookResult[]): string | null {
  const failures = results.filter(
    (r) => !r.skipped && r.exitCode !== 0,
  )

  if (failures.length === 0) return null

  const blocks = failures.map(formatSingleResult).filter(Boolean)
  if (blocks.length === 0) return null

  return [
    "<han-validation-summary>",
    "Han validation hooks found issues that need to be fixed:",
    "",
    ...blocks,
    "</han-validation-summary>",
  ].join("\n")
}
