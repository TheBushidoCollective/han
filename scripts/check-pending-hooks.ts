import { pendingHooks } from '../packages/han/lib/db/index.ts';

const pending = pendingHooks.getAll();
console.log('Pending hooks:', pending.length);
if (pending.length > 0) {
  console.log(JSON.stringify(pending, null, 2));
}
