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
  'fast-exit-receipt-capture',
  'fast-exit-child-stop',
  'fast-exit-child-exit',
  'fast-exit-receipt-release',
  'fast-exit-supervisor-exit',
  'fast-exit-cleanup',
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
  'supervisorExitCode',
  'supervisorProofKilled',
  'markerFile',
  'errorCategory',
  'helperDiagnostic',
];
const processLivenessValues = ['alive', 'dead', 'mismatched', 'unknown'];
const descriptorStates = ['present', 'absent', 'mismatched', 'unknown'];
const supervisorStatusValues = ['alive', 'dead', 'mismatched', 'unknown'];
const markerFileValues = [
  'none',
  'mock-installed',
  'runtime-imported',
  'daemon-imported',
  'start-daemon-called',
  'receipt-held',
  'receipt-released',
  'startup-completed',
];
const errorCategoryValues = [
  'none',
  'reference_error',
  'type_error',
  'syntax_error',
  'module_not_found',
  'binary_missing',
  'assertion_error',
  'connection_refused',
  'timeout',
  'security_error',
  'child_exit_error',
  'pid_claim_failed',
  'health_check_failed',
  'generic_error',
];
export function classifySupervisorError(
  err: unknown
): (typeof errorCategoryValues)[number] {
  if (!err) return 'none';
  const errorObj =
    typeof err === 'object' && err !== null
      ? (err as Record<string, unknown>)
      : {};
  const name = typeof errorObj.name === 'string' ? errorObj.name : '';
  const msg =
    typeof errorObj.message === 'string' ? errorObj.message.toLowerCase() : '';
  const code = typeof errorObj.code === 'string' ? errorObj.code : '';
  const causeCode =
    errorObj.cause &&
    typeof errorObj.cause === 'object' &&
    'code' in errorObj.cause
      ? String((errorObj.cause as { code: unknown }).code)
      : '';

  if (name === 'ReferenceError' || msg.includes('is not defined'))
    return 'reference_error';
  if (name === 'TypeError') return 'type_error';
  if (name === 'SyntaxError') return 'syntax_error';
  if (name === 'AssertionError') return 'assertion_error';

  // 1. Connection refused checks (including CoordinatorConnectionRefusedError and nested cause)
  if (
    name === 'CoordinatorConnectionRefusedError' ||
    code === 'ECONNREFUSED' ||
    causeCode === 'ECONNREFUSED' ||
    msg.includes('econnrefused') ||
    msg.includes('connection refused')
  ) {
    return 'connection_refused';
  }

  // 2. Timeout checks (including startup receipt, listener probe, and general timeouts)
  if (
    code === 'ETIMEDOUT' ||
    causeCode === 'ETIMEDOUT' ||
    msg.includes('timed out') ||
    msg.includes('timeout')
  ) {
    return 'timeout';
  }

  // 3. Child exit errors
  if (
    name === 'CoordinatorChildExitError' ||
    msg.includes('coordinator child exited')
  ) {
    return 'child_exit_error';
  }

  // 4. Missing binary or module
  if (
    msg.includes('binary not found') ||
    msg.includes('binary_missing') ||
    msg.includes('han-coordinator binary not found')
  ) {
    return 'binary_missing';
  }
  if (
    msg.includes('cannot find module') ||
    msg.includes('module_not_found') ||
    code === 'ERR_MODULE_NOT_FOUND'
  ) {
    return 'module_not_found';
  }

  // 5. PID claim errors
  if (
    msg.includes('supervisor claim') ||
    msg.includes('malformed supervisor pid') ||
    msg.includes('insecure supervisor pid') ||
    msg.includes('supervisor ownership') ||
    msg.includes('another coordinator supervisor is already running')
  ) {
    return 'pid_claim_failed';
  }

  // 6. Health check specific failures
  if (
    msg.includes('coordinator health') ||
    msg.includes('coordinator stopped responding') ||
    msg.includes('coordinator descriptor changed during health check') ||
    msg.includes('health check failed') ||
    msg.includes('failed to reach healthy state')
  ) {
    return 'health_check_failed';
  }

  // 7. General security errors
  if (
    name === 'CoordinatorSecurityError' ||
    msg.includes('coordinatorsecurityerror')
  ) {
    return 'security_error';
  }

  return 'generic_error';
}

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
  supervisorExitCode?: number | null;
  supervisorProofKilled?: boolean | null;
  markerFile?:
    | 'none'
    | 'mock-installed'
    | 'runtime-imported'
    | 'daemon-imported'
    | 'start-daemon-called'
    | 'receipt-held'
    | 'receipt-released'
    | 'startup-completed'
    | null;
  errorCategory?:
    | 'none'
    | 'reference_error'
    | 'type_error'
    | 'syntax_error'
    | 'module_not_found'
    | 'binary_missing'
    | 'assertion_error'
    | 'connection_refused'
    | 'timeout'
    | 'security_error'
    | 'child_exit_error'
    | 'pid_claim_failed'
    | 'health_check_failed'
    | 'generic_error'
    | null;
  helperDiagnostic?: SafeHelperDiagnostic | null;
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
  if (
    item.supervisorExitCode !== undefined &&
    item.supervisorExitCode !== null &&
    !Number.isSafeInteger(item.supervisorExitCode)
  )
    return undefined;
  if (
    item.supervisorProofKilled !== undefined &&
    item.supervisorProofKilled !== null &&
    typeof item.supervisorProofKilled !== 'boolean'
  )
    return undefined;
  if (
    item.markerFile !== undefined &&
    item.markerFile !== null &&
    (typeof item.markerFile !== 'string' ||
      !markerFileValues.includes(item.markerFile))
  )
    return undefined;
  if (
    item.errorCategory !== undefined &&
    item.errorCategory !== null &&
    (typeof item.errorCategory !== 'string' ||
      !errorCategoryValues.includes(item.errorCategory))
  )
    return undefined;
  if (
    item.helperDiagnostic !== undefined &&
    item.helperDiagnostic !== null &&
    !validateHelperDiagnostic(item.helperDiagnostic)
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
  if (
    item.supervisorExitCode !== undefined &&
    item.supervisorExitCode !== null
  ) {
    result.supervisorExitCode = item.supervisorExitCode as number;
  }
  if (
    item.supervisorProofKilled !== undefined &&
    item.supervisorProofKilled !== null
  ) {
    result.supervisorProofKilled = item.supervisorProofKilled as boolean;
  }
  if (item.markerFile !== undefined && item.markerFile !== null) {
    result.markerFile = item.markerFile as SafeProcessDiagnostic['markerFile'];
  }
  if (item.errorCategory !== undefined && item.errorCategory !== null) {
    result.errorCategory =
      item.errorCategory as SafeProcessDiagnostic['errorCategory'];
  }
  if (item.helperDiagnostic !== undefined && item.helperDiagnostic !== null) {
    result.helperDiagnostic = validateHelperDiagnostic(item.helperDiagnostic);
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
