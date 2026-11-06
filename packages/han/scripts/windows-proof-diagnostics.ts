// Treat CLI output as untrusted: only the fixed helper marker is reportable.
const operations = [
  'runtime.prepare',
  'supervisor.read',
  'supervisor.acquire',
  'supervisor.check',
  'supervisor.release',
  'spawn.acquire',
  'spawn.release',
  'descriptor.read',
  'intent.remove',
  'launcher.create',
  'launcher.remove',
  'process.state',
];
const categories = [
  'binary_missing',
  'request_too_large',
  'spawn_error',
  'nonzero_exit',
  'no_exit_status',
  'missing_stdout',
  'oversized_stdout',
  'invalid_json',
  'invalid_envelope',
  'invalid_result',
];
const stages = [
  'input_read',
  'input_validation',
  'parent_identity',
  'data_directory',
  'runtime_directory',
  'publication_lock',
  'claim_inspection',
  'claim_acquisition',
  'descriptor_read',
  'process_state',
  'response_write',
];
const kinds = [
  'invalid_data',
  'not_found',
  'permission_denied',
  'already_exists',
  'timed_out',
  'other',
];
const spawnCodes = [
  'ENOENT',
  'EACCES',
  'EPERM',
  'ETIMEDOUT',
  'ENOBUFS',
  'other',
];
const marker = 'HAN_WINDOWS_RUNTIME_DIAGNOSTIC=';
const keys = [
  'operation',
  'category',
  'exitStatus',
  'spawnCode',
  'stage',
  'kind',
  'win32Code',
];
const phases = [
  'setup',
  'initial-status',
  'initial-start',
  'initial-start-command',
  'initial-start-descriptor',
  'initial-start-identity',
  'initial-start-registration',
  'initial-start-coordinator',
  'initial-start-supervisor',
  'initial-start-health',
  'initial-start-status',
  'crash-recovery',
  'restart',
  'stop',
  'partial-claim-kill',
  'missing-lock-status',
  'missing-lock-start',
  'partial-claim-status',
  'partial-claim-start',
  'modeled-pid-reuse',
  'cleanup',
];

export type SafeHelperDiagnostic = Record<string, string | number | null>;
export function safeHelperDiagnostic(
  output: string
): SafeHelperDiagnostic | undefined {
  for (const line of output.split(/\r?\n/)) {
    const index = line.indexOf(marker);
    if (index < 0) continue;
    try {
      const value: unknown = JSON.parse(line.slice(index + marker.length));
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      const item = value as Record<string, unknown>;
      if (
        Object.keys(item).some((key) => !keys.includes(key)) ||
        typeof item.operation !== 'string' ||
        !operations.includes(item.operation) ||
        typeof item.category !== 'string' ||
        !categories.includes(item.category)
      )
        continue;
      if (
        item.exitStatus !== undefined &&
        (!Number.isSafeInteger(item.exitStatus) ||
          (item.exitStatus as number) < 0)
      )
        continue;
      if (
        item.spawnCode !== undefined &&
        (typeof item.spawnCode !== 'string' ||
          !spawnCodes.includes(item.spawnCode))
      )
        continue;
      if (
        item.stage !== undefined &&
        (typeof item.stage !== 'string' || !stages.includes(item.stage))
      )
        continue;
      if (
        item.kind !== undefined &&
        (typeof item.kind !== 'string' || !kinds.includes(item.kind))
      )
        continue;
      if (
        item.win32Code !== undefined &&
        item.win32Code !== null &&
        (!Number.isSafeInteger(item.win32Code) ||
          (item.win32Code as number) < 0 ||
          (item.win32Code as number) > 0xffffffff)
      )
        continue;
      return item as Record<string, string | number | null>;
    } catch {
      // An invalid or truncated marker is not a diagnostic.
    }
  }
  return undefined;
}

export class ProofCommandError extends Error {
  readonly exitStatus: number | null;
  readonly diagnostic: SafeHelperDiagnostic | undefined;
  readonly startupTimeout: boolean;
  constructor(exitStatus: number | null, output: string) {
    super('Installed command failed');
    this.exitStatus =
      Number.isSafeInteger(exitStatus) && (exitStatus as number) >= 0
        ? exitStatus
        : null;
    this.diagnostic = safeHelperDiagnostic(output);
    this.startupTimeout =
      /Coordinator failed to start within \d+s timeout\./.test(output);
  }
}

export function safeProofFailure(phase: string, error: unknown): string {
  const command = error instanceof ProofCommandError ? error : undefined;
  const startupTimeout = command?.startupTimeout === true;
  return JSON.stringify({
    phase: phases.includes(phase) ? phase : 'setup',
    exitStatus: command?.exitStatus ?? null,
    diagnostic: command?.diagnostic ?? null,
    ...(startupTimeout ? { reason: 'startup_timeout' } : {}),
  });
}
