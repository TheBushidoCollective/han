/**
 * Han Memory - SessionStart Context Injection
 *
 * Injects recent session context when a new Claude Code session starts.
 * Provides continuity by summarizing recent work and in-progress items.
 *
 * @example Usage in SessionStart Hook
 * ```json
 * {
 *   "hooks": {
 *     "SessionStart": [
 *       {
 *         "hooks": [
 *           {
 *             "type": "command",
 *             "command": "han metrics memory-context"
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * }
 * ```
 *
 * @example Direct Usage
 * ```typescript
 * import { injectSessionContext } from "./memory/context-injection.ts";
 *
 * // Get context for last 5 sessions (default)
 * const context = injectSessionContext();
 *
 * // Get context for last 3 sessions
 * const context = injectSessionContext(3);
 * ```
 */

import { isMemoryEnabled } from "../han-settings.ts";
import { getMemoryStore } from "./storage.ts";

/**
 * Inject recent session context for SessionStart hook
 *
 * Retrieves recent session summaries and formats them as context
 * for injection into a new session. Helps maintain continuity across sessions.
 *
 * @param limit - Maximum number of recent sessions to include (default: 5)
 * @returns Formatted markdown context string, or empty string if no recent sessions
 */
export function injectSessionContext(limit = 5): string {
	// Skip if memory is disabled
	if (!isMemoryEnabled()) {
		return "";
	}

	const store = getMemoryStore();
	const recentSessions = store.getRecentSessions(limit);

	if (recentSessions.length === 0) {
		return "";
	}

	const sections: string[] = [];

	// Build Recent Work section
	sections.push("## Recent Work");
	sections.push("");

	for (const session of recentSessions) {
		// Session summary
		sections.push(`- ${session.summary}`);

		// Work items with files and outcomes
		if (session.work_items && session.work_items.length > 0) {
			for (const item of session.work_items) {
				const outcome =
					item.outcome !== "completed" ? ` (${item.outcome})` : "";
				sections.push(`  - ${item.description}${outcome}`);

				// Include files if available
				if (item.files && item.files.length > 0) {
					const filesStr = item.files.join(", ");
					sections.push(`    - Files: ${filesStr}`);
				}
			}
		}

		// Decisions made
		if (session.decisions && session.decisions.length > 0) {
			for (const decision of session.decisions) {
				sections.push(`  - Decision: ${decision.description}`);
				if (decision.rationale) {
					sections.push(`    - Rationale: ${decision.rationale}`);
				}
			}
		}

		sections.push("");
	}

	// Aggregate all in-progress items from recent sessions
	const inProgressItems = recentSessions.flatMap((s) => s.in_progress || []);

	if (inProgressItems.length > 0) {
		sections.push("## In Progress");
		sections.push("");
		for (const item of inProgressItems) {
			sections.push(`- ${item}`);
		}
		sections.push("");
	}

	return sections.join("\n").trim();
}
