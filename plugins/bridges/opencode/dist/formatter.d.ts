/**
 * Result formatting: turns raw hook results into structured messages
 * that OpenCode's agent can understand and act on.
 *
 * Output uses XML-like tags for clear structure, making it easy
 * for the LLM to parse plugin name, file, status, and error details.
 */
import type { HookResult } from './types';
/**
 * Format PostToolUse hook results for inline tool output mutation.
 *
 * Only includes failed hooks since passing validation doesn't need
 * to be surfaced to the agent.
 *
 * @returns Formatted string to append to tool output, or null if no failures
 */
export declare function formatInlineResults(results: HookResult[]): string | null;
/**
 * Format PostToolUse hook results as an async notification message.
 *
 * Used with client.session.prompt() to inject validation results
 * that the agent can act on in its next turn.
 *
 * @returns Structured message for the agent, or null if no failures
 */
export declare function formatNotificationResults(results: HookResult[], filePaths: string[]): string | null;
/**
 * Format Stop/idle hook results for re-prompting the agent.
 *
 * Used when the agent finishes a turn and broader validation finds issues.
 *
 * @returns Message to send via client.session.prompt(), or null if all passed
 */
export declare function formatStopResults(results: HookResult[]): string | null;
