import { pendingHooks } from '../packages/han/lib/db/index.ts';

// Get all pending hooks
const pending = pendingHooks.getAll();
console.log(`Found ${pending.length} pending hooks`);

// Mark them all as cancelled
for (const hook of pending) {
  pendingHooks.fail(
    hook.id,
    'Cleared stale hooks from before synchronous execution refactor'
  );
}

console.log(`Cleared ${pending.length} stale pending hooks`);
