import { createProofClock } from '../../scripts/windows-proof-bounds.ts';

// Watchdog fixture for T5: armed at 2s with an await that never settles.
// Watchdog fires at deadlineMs + cleanupMs + watchdogMarginMs = 1000 + 500 + 500 = 2000 ms.
const totalMs = Number.parseInt(
  process.env.HAN_PROOF_WATCHDOG_TOTAL_MS || '2000',
  10
);
const deadlineMs = Math.floor(totalMs / 2);
const cleanupMs = Math.floor(totalMs / 4);
const watchdogMarginMs = Math.max(100, totalMs - deadlineMs - cleanupMs);

const clock = createProofClock({
  deadlineMs,
  cleanupMs,
  watchdogMarginMs,
});

clock.armWatchdog(process.env.HAN_PROOF_ROOT, () => 'setup');

// Await that never settles:
await new Promise<void>(() => {});
