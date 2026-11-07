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
  'fixed-port-bind-before-publication',
  'dead-pair-stop',
  'dead-pair-restart',
  'orphan-stop-and-restart',
  'orphan-start',
  'orphan-started',
  'orphan-kill-supervisor',
  'orphan-live',
  'orphan-live-https',
  'orphan-live-unauth',
  'orphan-live-badtoken',
  'orphan-live-grpc',
  'orphan-live-grpc-denied',
  'orphan-live-untrusted-ca',
  'orphan-stop',
  'orphan-wait-exit',
  'orphan-assert-stopped',
  'orphan-restart',
  'orphan-restart-started',
  'orphan-restart-stop',
  'partial-claim-kill',
  'missing-lock-status',
  'missing-lock-start',
  'partial-claim-status',
  'partial-claim-start',
  'modeled-pid-reuse',
  'fast-exit-receipt',
  'cleanup',
];

export type SafeHelperDiagnostic = Record<string, string | number | null>;

export function validateHelperDiagnostic(
  value: unknown
): SafeHelperDiagnostic | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).some((key) => !keys.includes(key))) return undefined;
  if (
    typeof item.operation !== 'string' ||
    !operations.includes(item.operation) ||
    typeof item.category !== 'string' ||
    !categories.includes(item.category)
  )
    return undefined;
  if (
    item.exitStatus !== undefined &&
    item.exitStatus !== null &&
    (!Number.isSafeInteger(item.exitStatus) || (item.exitStatus as number) < 0)
  )
    return undefined;
  if (
    item.spawnCode !== undefined &&
    item.spawnCode !== null &&
    (typeof item.spawnCode !== 'string' || !spawnCodes.includes(item.spawnCode))
  )
    return undefined;
  if (
    item.stage !== undefined &&
    item.stage !== null &&
    (typeof item.stage !== 'string' || !stages.includes(item.stage))
  )
    return undefined;
  if (
    item.kind !== undefined &&
    item.kind !== null &&
    (typeof item.kind !== 'string' || !kinds.includes(item.kind))
  )
    return undefined;
  if (
    item.win32Code !== undefined &&
    item.win32Code !== null &&
    (!Number.isSafeInteger(item.win32Code) ||
      (item.win32Code as number) < 0 ||
      (item.win32Code as number) > 0xffffffff)
  )
    return undefined;

  const result: SafeHelperDiagnostic = {
    operation: item.operation,
    category: item.category,
  };
  if (item.exitStatus !== undefined && item.exitStatus !== null) {
    result.exitStatus = item.exitStatus as number;
  }
  if (item.spawnCode !== undefined && item.spawnCode !== null) {
    result.spawnCode = item.spawnCode as string;
  }
  if (item.stage !== undefined && item.stage !== null) {
    result.stage = item.stage as string;
  }
  if (item.kind !== undefined && item.kind !== null) {
    result.kind = item.kind as string;
  }
  if (item.win32Code !== undefined && item.win32Code !== null) {
    result.win32Code = item.win32Code as number;
  }
  return result;
}

export function safeHelperDiagnostic(
  output: string
): SafeHelperDiagnostic | undefined {
  for (const line of output.split(/\r?\n/)) {
    const index = line.indexOf(marker);
    if (index < 0) continue;
    try {
      const parsed: unknown = JSON.parse(line.slice(index + marker.length));
      const valid = validateHelperDiagnostic(parsed);
      if (valid) return valid;
    } catch {
      // An invalid or truncated marker is not a diagnostic.
    }
  }
  return undefined;
}

const terminationMarker = 'HAN_ORPHAN_TERMINATION=';
const terminationKeys = [
  'observer',
  'jobProbe',
  'childInSupervisorJob',
  'jobContainsSupervisor',
  'childAliveBeforeKill',
  'supervisorExited',
  'childExited',
  'supervisorJobHandles',
  'jobActiveProcesses',
  'jobHandleCount',
  'jobLimitFlags',
  'supervisorExitCode',
  'childExitCode',
  'exitDeltaMs',
];
const observerValues = [
  'complete',
  'child_absent',
  'child_unverified',
  'supervisor_absent',
  'supervisor_mismatched',
  'unavailable',
];
const jobProbeValues = [
  'complete',
  'no_job_type',
  'no_snapshot',
  'failed',
  'skipped',
];

export type SafeTerminationDiagnostic = {
  observer:
    | 'complete'
    | 'child_absent'
    | 'child_unverified'
    | 'supervisor_absent'
    | 'supervisor_mismatched'
    | 'unavailable';
  jobProbe?:
    | 'complete'
    | 'no_job_type'
    | 'no_snapshot'
    | 'failed'
    | 'skipped'
    | null;
  childInSupervisorJob?: boolean | null;
  jobContainsSupervisor?: boolean | null;
  childAliveBeforeKill?: boolean | null;
  supervisorExited?: boolean | null;
  childExited?: boolean | null;
  supervisorJobHandles?: number | null;
  jobActiveProcesses?: number | null;
  jobHandleCount?: number | null;
  jobLimitFlags?: number | null;
  supervisorExitCode?: number | null;
  childExitCode?: number | null;
  exitDeltaMs?: number | null;
};

export function safeTerminationDiagnostic(
  value: unknown
): SafeTerminationDiagnostic | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).some((key) => !terminationKeys.includes(key)))
    return undefined;
  if (
    typeof item.observer !== 'string' ||
    !observerValues.includes(item.observer)
  )
    return undefined;
  if (
    item.jobProbe !== undefined &&
    item.jobProbe !== null &&
    (typeof item.jobProbe !== 'string' ||
      !jobProbeValues.includes(item.jobProbe))
  )
    return undefined;

  for (const boolKey of [
    'childInSupervisorJob',
    'jobContainsSupervisor',
    'childAliveBeforeKill',
    'supervisorExited',
    'childExited',
  ]) {
    if (
      item[boolKey] !== undefined &&
      item[boolKey] !== null &&
      typeof item[boolKey] !== 'boolean'
    )
      return undefined;
  }

  for (const u32Key of [
    'supervisorJobHandles',
    'jobActiveProcesses',
    'jobHandleCount',
    'jobLimitFlags',
    'supervisorExitCode',
    'childExitCode',
  ]) {
    if (
      item[u32Key] !== undefined &&
      item[u32Key] !== null &&
      (!Number.isSafeInteger(item[u32Key]) ||
        (item[u32Key] as number) < 0 ||
        (item[u32Key] as number) > 0xffffffff)
    )
      return undefined;
  }

  if (
    item.exitDeltaMs !== undefined &&
    item.exitDeltaMs !== null &&
    (!Number.isSafeInteger(item.exitDeltaMs) ||
      (item.exitDeltaMs as number) < -600000 ||
      (item.exitDeltaMs as number) > 600000)
  )
    return undefined;

  const result: SafeTerminationDiagnostic = {
    observer: item.observer as SafeTerminationDiagnostic['observer'],
  };
  if (item.jobProbe !== undefined && item.jobProbe !== null) {
    result.jobProbe = item.jobProbe as SafeTerminationDiagnostic['jobProbe'];
  }
  for (const boolKey of [
    'childInSupervisorJob',
    'jobContainsSupervisor',
    'childAliveBeforeKill',
    'supervisorExited',
    'childExited',
  ] as const) {
    if (item[boolKey] !== undefined && item[boolKey] !== null) {
      result[boolKey] = item[boolKey] as boolean;
    }
  }
  for (const u32Key of [
    'supervisorJobHandles',
    'jobActiveProcesses',
    'jobHandleCount',
    'jobLimitFlags',
    'supervisorExitCode',
    'childExitCode',
  ] as const) {
    if (item[u32Key] !== undefined && item[u32Key] !== null) {
      result[u32Key] = item[u32Key] as number;
    }
  }
  if (item.exitDeltaMs !== undefined && item.exitDeltaMs !== null) {
    result.exitDeltaMs = item.exitDeltaMs as number;
  }
  return result;
}

export function safeTerminationMarker(
  output: string
): SafeTerminationDiagnostic | undefined {
  let latest: SafeTerminationDiagnostic | undefined;
  for (const line of output.split(/\r?\n/)) {
    if (!line.startsWith(terminationMarker) || line.length > 4096) continue;
    try {
      const parsed: unknown = JSON.parse(line.slice(terminationMarker.length));
      const valid = safeTerminationDiagnostic(parsed);
      if (valid) latest = valid;
    } catch {}
  }
  return latest;
}

const processDiagnosticKeys = [
  'childPid',
  'childCreationTime',
  'childLiveness',
  'descriptorMatches',
  'descriptorState',
  'supervisorPid',
  'supervisorCreationTime',
  'supervisorStatusBefore',
  'supervisorStatusAfter',
  'termination',
];
const processLivenessValues = ['alive', 'dead', 'mismatched', 'unknown'];
const descriptorStates = ['present', 'absent', 'mismatched', 'unknown'];
const supervisorStatusValues = ['alive', 'dead', 'mismatched', 'unknown'];

export type SafeProcessDiagnostic = {
  childPid?: number | null;
  childCreationTime?: string | null;
  childLiveness?: 'alive' | 'dead' | 'mismatched' | 'unknown' | null;
  descriptorMatches?: boolean | null;
  descriptorState?: 'present' | 'absent' | 'mismatched' | 'unknown' | null;
  supervisorPid?: number | null;
  supervisorCreationTime?: string | null;
  supervisorStatusBefore?: 'alive' | 'dead' | 'mismatched' | 'unknown' | null;
  supervisorStatusAfter?: 'alive' | 'dead' | 'mismatched' | 'unknown' | null;
  termination?: SafeTerminationDiagnostic | null;
};
export function safeProcessDiagnostic(
  value: unknown
): SafeProcessDiagnostic | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).some((key) => !processDiagnosticKeys.includes(key)))
    return undefined;
  if (
    item.childPid !== undefined &&
    item.childPid !== null &&
    (!Number.isSafeInteger(item.childPid) || (item.childPid as number) <= 0)
  )
    return undefined;
  if (
    item.childCreationTime !== undefined &&
    item.childCreationTime !== null &&
    (typeof item.childCreationTime !== 'string' ||
      !/^[1-9][0-9]{0,19}$/.test(item.childCreationTime))
  )
    return undefined;
  if (
    item.childLiveness !== undefined &&
    item.childLiveness !== null &&
    (typeof item.childLiveness !== 'string' ||
      !processLivenessValues.includes(item.childLiveness))
  )
    return undefined;
  if (
    item.descriptorMatches !== undefined &&
    item.descriptorMatches !== null &&
    typeof item.descriptorMatches !== 'boolean'
  )
    return undefined;
  if (
    item.descriptorState !== undefined &&
    item.descriptorState !== null &&
    (typeof item.descriptorState !== 'string' ||
      !descriptorStates.includes(item.descriptorState))
  )
    return undefined;
  if (
    item.supervisorPid !== undefined &&
    item.supervisorPid !== null &&
    (!Number.isSafeInteger(item.supervisorPid) ||
      (item.supervisorPid as number) <= 0)
  )
    return undefined;
  if (
    item.supervisorCreationTime !== undefined &&
    item.supervisorCreationTime !== null &&
    (typeof item.supervisorCreationTime !== 'string' ||
      !/^[1-9][0-9]{0,19}$/.test(item.supervisorCreationTime))
  )
    return undefined;
  if (
    item.supervisorStatusBefore !== undefined &&
    item.supervisorStatusBefore !== null &&
    (typeof item.supervisorStatusBefore !== 'string' ||
      !supervisorStatusValues.includes(item.supervisorStatusBefore))
  )
    return undefined;
  if (
    item.supervisorStatusAfter !== undefined &&
    item.supervisorStatusAfter !== null &&
    (typeof item.supervisorStatusAfter !== 'string' ||
      !supervisorStatusValues.includes(item.supervisorStatusAfter))
  )
    return undefined;

  const result: SafeProcessDiagnostic = {};
  if (item.childPid !== undefined && item.childPid !== null) {
    result.childPid = item.childPid as number;
  }
  if (item.childCreationTime !== undefined && item.childCreationTime !== null) {
    result.childCreationTime = item.childCreationTime as string;
  }
  if (item.childLiveness !== undefined && item.childLiveness !== null) {
    result.childLiveness =
      item.childLiveness as SafeProcessDiagnostic['childLiveness'];
  }
  if (item.descriptorMatches !== undefined && item.descriptorMatches !== null) {
    result.descriptorMatches = item.descriptorMatches as boolean;
  }
  if (item.descriptorState !== undefined && item.descriptorState !== null) {
    result.descriptorState =
      item.descriptorState as SafeProcessDiagnostic['descriptorState'];
  }
  if (item.supervisorPid !== undefined && item.supervisorPid !== null) {
    result.supervisorPid = item.supervisorPid as number;
  }
  if (
    item.supervisorCreationTime !== undefined &&
    item.supervisorCreationTime !== null
  ) {
    result.supervisorCreationTime = item.supervisorCreationTime as string;
  }
  if (
    item.supervisorStatusBefore !== undefined &&
    item.supervisorStatusBefore !== null
  ) {
    result.supervisorStatusBefore =
      item.supervisorStatusBefore as SafeProcessDiagnostic['supervisorStatusBefore'];
  }
  if (
    item.supervisorStatusAfter !== undefined &&
    item.supervisorStatusAfter !== null
  ) {
    result.supervisorStatusAfter =
      item.supervisorStatusAfter as SafeProcessDiagnostic['supervisorStatusAfter'];
  }
  if (item.termination !== undefined && item.termination !== null) {
    const term = safeTerminationDiagnostic(item.termination);
    if (!term) return undefined;
    result.termination = term;
  } else if (item.termination === null) {
    result.termination = null;
  }
  return result;
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

export function safeProofFailure(
  phase: string,
  error: unknown,
  processDiagnostic?: unknown
): string {
  const command = error instanceof ProofCommandError ? error : undefined;
  let reason: string | undefined;
  if (command?.startupTimeout === true) {
    reason = 'startup_timeout';
  } else if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    if (error.name === 'AssertionError') {
      reason = 'assertion_failure';
    } else if (code === 'ECONNREFUSED') {
      reason = 'connection_refused';
    } else if (code === 'ECONNRESET') {
      reason = 'connection_reset';
    } else if (
      code === 'ETIMEDOUT' ||
      error.name === 'TimeoutError' ||
      error.message.startsWith('Timed out waiting for ')
    ) {
      reason = 'timeout';
    } else if (
      typeof code === 'string' &&
      (code.startsWith('ERR_TLS_') ||
        code.startsWith('ERR_SSL_') ||
        code === 'CERT_HAS_EXPIRED' ||
        code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
        code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE')
    ) {
      reason = 'tls_error';
    } else if (
      error.name === 'TypeError' &&
      error.message.toLowerCase() === 'fetch failed'
    ) {
      reason = 'fetch_failure';
    }
  }
  let helperDiagnostic: SafeHelperDiagnostic | null =
    command?.diagnostic ?? null;
  if (
    !helperDiagnostic &&
    error &&
    typeof error === 'object' &&
    'diagnostic' in error
  ) {
    const validated = validateHelperDiagnostic(error.diagnostic);
    if (validated) helperDiagnostic = validated;
  }
  let errorProcess: unknown;
  if (error && typeof error === 'object' && 'process' in error) {
    errorProcess = error.process;
  }
  const rawProcess = processDiagnostic ?? errorProcess;
  const validatedProcess = rawProcess
    ? safeProcessDiagnostic(rawProcess)
    : undefined;

  return JSON.stringify({
    phase: phases.includes(phase) ? phase : 'setup',
    exitStatus: command?.exitStatus ?? null,
    diagnostic: helperDiagnostic,
    ...(validatedProcess ? { process: validatedProcess } : {}),
    ...(reason ? { reason } : {}),
  });
}
