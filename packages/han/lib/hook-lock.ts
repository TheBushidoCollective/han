/**
 * Hook Lock - Re-exports from hooks/hook-lock.ts
 *
 * Single source of truth for file-based slot management.
 * The hooks/ version has better race condition handling (UUID temp files)
 * and supports explicit session IDs for cross-process coordination fallback.
 */
export {
  acquireSlot,
  cleanupOwnedSlots,
  createLockManager,
  getSessionIdFromManager,
  isHookRunning,
  isLockingEnabled,
  releaseSlot,
  waitForHook,
  withGlobalSlot,
  withSlot,
} from './hooks/hook-lock.ts';
