import { Badge } from '../atoms/index.ts';

/**
 * Harness every session is attributed to when nothing else is recorded.
 *
 * Claude Code was the only harness han indexed before harness tracking, and it
 * remains the overwhelming majority of sessions.
 */
const DEFAULT_HARNESS = 'claude-code';

/** Human-readable names for harnesses whose id is not already presentable. */
const DISPLAY_NAMES: Record<string, string> = {
  'gemini-cli': 'Gemini CLI',
  antigravity: 'Antigravity',
  codex: 'Codex',
  kiro: 'Kiro',
  omp: 'omp',
  opencode: 'OpenCode',
};

export interface HarnessBadgeProps {
  harness: string | null | undefined;
}

/**
 * Shows which coding agent produced a session.
 *
 * Renders nothing for Claude Code. Badging every row with the default would be
 * noise on almost every session; a badge appearing is the signal that this
 * session came from somewhere else.
 */
export function HarnessBadge({ harness }: HarnessBadgeProps) {
  if (!harness || harness === DEFAULT_HARNESS) return null;
  return <Badge variant="info">{DISPLAY_NAMES[harness] ?? harness}</Badge>;
}
