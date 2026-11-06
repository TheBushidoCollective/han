import { unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  CoordinatorSecurityError,
  getCoordinatorDataDir,
  type LocalCoordinatorDescriptor,
  readCoordinatorDescriptor,
  type SupervisorBinding,
  sameCoordinator,
  sameSupervisor,
  validSupervisorBinding,
} from '../../coordinator/connection.ts';

function intentPath(binding: SupervisorBinding): string {
  if (!validSupervisorBinding(binding))
    throw new CoordinatorSecurityError('Invalid supervisor binding');
  return join(
    getCoordinatorDataDir(),
    'runtime',
    `coordinator.stopping.${binding.nonce}.${binding.generationId}.json`
  );
}

export function readShutdownIntent(
  binding: SupervisorBinding,
  childPid: number,
  expected?: LocalCoordinatorDescriptor
): LocalCoordinatorDescriptor | null {
  try {
    const descriptor = readCoordinatorDescriptor(intentPath(binding));
    if (
      descriptor.pid !== childPid ||
      !sameSupervisor(descriptor.supervisor, binding) ||
      (expected && !sameCoordinator(descriptor, expected))
    ) {
      throw new CoordinatorSecurityError(
        'Shutdown intent does not match owned coordinator'
      );
    }
    return descriptor;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export function removeShutdownIntent(
  binding: SupervisorBinding,
  childPid: number,
  expected: LocalCoordinatorDescriptor
): void {
  if (readShutdownIntent(binding, childPid, expected))
    unlinkSync(intentPath(binding));
}
