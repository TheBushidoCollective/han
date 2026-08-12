/**
 * Harness identity for recorded events.
 *
 * han indexes sessions from more than one coding agent. Every event carries the
 * harness that produced it so metrics can be attributed, filtered, and compared
 * across them.
 */

/**
 * Every harness han can attribute a session to.
 *
 * Bridges write these exact strings, the indexer reads them out of the
 * `~/.han/<harness>/projects` path, and `sessions.harness` stores them.
 */
export const HARNESS_IDS = [
  'claude-code',
  'omp',
  'opencode',
  'gemini-cli',
  'kiro',
  'codex',
  'antigravity',
] as const;

export type HarnessId = (typeof HARNESS_IDS)[number];

/**
 * Harness assumed when nothing says otherwise.
 *
 * The han CLI is invoked by Claude Code's hook system in the overwhelming
 * majority of cases, and it was the only harness before bridges existed.
 */
export const DEFAULT_HARNESS: HarnessId = 'claude-code';

/**
 * Harness this han process is running under.
 *
 * Other harnesses can run han's own hooks, because omp and several others read
 * Claude Code's plugin layout directly. Those hosts identify themselves through
 * the environment so their events are attributed to them rather than silently
 * counted as Claude Code. An unrecognized value is ignored rather than trusted,
 * since it would create a harness no reader knows how to interpret.
 */
export const HARNESS: HarnessId = resolveHarness();

function resolveHarness(): HarnessId {
  // HAN_PROVIDER is what the bridges already export when they spawn han as a
  // child. Reading it here keeps a bridge's own events and the events written
  // by the han process it spawned from disagreeing with each other.
  const declared = (process.env.HAN_HARNESS ?? process.env.HAN_PROVIDER)
    ?.trim()
    .toLowerCase();
  if (!declared) return DEFAULT_HARNESS;
  return (HARNESS_IDS as readonly string[]).includes(declared)
    ? (declared as HarnessId)
    : DEFAULT_HARNESS;
}
