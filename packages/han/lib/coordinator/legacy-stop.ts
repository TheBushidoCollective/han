import { existsSync } from 'node:fs';
import { connect } from 'node:net';
import { join } from 'node:path';
import { getCoordinatorDataDir } from './connection.ts';
import { CoordinatorPortOccupiedError } from './errors.ts';

function portOccupied(port: number): Promise<boolean> {
  const { promise, resolve } = Promise.withResolvers<boolean>();
  const socket = connect({ host: '127.0.0.1', port });
  socket.setTimeout(500);
  socket.once('connect', () => {
    socket.destroy();
    resolve(true);
  });
  socket.once('error', () => resolve(false));
  socket.once('timeout', () => {
    socket.destroy();
    resolve(false);
  });
  return promise;
}

export async function stopLegacyCoordinator(port: number): Promise<boolean> {
  const occupied = await portOccupied(port);
  if (!occupied) {
    return false;
  }

  const dataDir = getCoordinatorDataDir();
  const descriptorPath = join(dataDir, 'runtime', 'coordinator.json');
  if (existsSync(descriptorPath)) {
    return false;
  }

  throw new CoordinatorPortOccupiedError(
    `UPGRADE_REQUIRED: port ${port} is in use by a process Han cannot identify. Free the port, then run: han coordinator start`
  );
}
