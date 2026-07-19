/** @jsxImportSource @opentui/solid */
/**
 * Han TUI plugin for OpenCode.
 *
 * Renders Han validation status inside the OpenCode TUI:
 *
 * - Sidebar footer panel with plugin/skill counts and the last
 *   validation result for the current project
 * - Error toast when a new validation run fails
 * - "Han: Validation Summary" palette/slash command showing the
 *   most recent run's failures
 *
 * Data comes from ~/.han/opencode/status/{project-slug}.json, written
 * by the bridge's server plugin after every validation run. The two
 * plugins run in different processes, so the status file is the
 * channel between them.
 */
import type { TuiPlugin } from '@opencode-ai/plugin/tui';
declare const _default: {
    id: string;
    tui: TuiPlugin;
};
export default _default;
