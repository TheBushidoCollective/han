/**
 * Memory Context CLI Command
 *
 * Generates session context from Han Memory for SessionStart hook injection.
 * Outputs markdown-formatted context about recent work and in-progress items.
 */

import { injectSessionContext } from "../memory/index.ts";

/**
 * Generate memory context for SessionStart hook
 */
export async function generateMemoryContext(): Promise<void> {
	try {
		const context = injectSessionContext();

		if (context) {
			console.log(context);
		}
	} catch (error) {
		// Silent failure - don't break session start if memory isn't available
		// This allows the hook to work even if memory system hasn't been initialized yet
		if (process.env.DEBUG) {
			console.error(
				"Memory context error:",
				error instanceof Error ? error.message : error,
			);
		}
	}
}
