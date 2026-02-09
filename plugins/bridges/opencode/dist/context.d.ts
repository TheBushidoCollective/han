/**
 * Context injection for OpenCode sessions.
 *
 * Replicates the core plugin's SessionStart and UserPromptSubmit
 * context injection for OpenCode. These guidelines are LLM-universal
 * (not Claude-specific) and improve agent quality regardless of provider.
 *
 * SessionStart context → experimental.chat.system.transform (persistent)
 * UserPromptSubmit context → chat.message (per-prompt)
 */
/**
 * Build the full system prompt context for an OpenCode session.
 * This is injected via experimental.chat.system.transform on every LLM call.
 */
export declare function buildSessionContext(skillCount: number, disciplineCount: number): string;
/**
 * Build per-prompt context injected via chat.message.
 * Mirrors core plugin's UserPromptSubmit hook: current datetime.
 */
export declare function buildPromptContext(): string;
/**
 * Try to load a guideline file from the core plugin if available.
 * Falls back to null if the file doesn't exist (bridge not in han repo).
 */
export declare function loadGuideline(pluginPaths: Map<string, string>, fileName: string): string | null;
