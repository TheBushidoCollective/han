import { describe, expect, test } from 'bun:test';
import {
  classifySupervisorError,
  cleanupSteps,
  evaluateHelperMarkerStatus,
  phases,
  ProofCommandError,
  safeHelperDiagnostic,
  safeProcessDiagnostic,
  safeProofCleanup,
  safeProofFailure,
  safeProofProgress,
  validateHelperDiagnostic,
} from '../scripts/windows-proof-diagnostics.ts';

const secret = 'SENTINEL_SECRET_token_certificate_path_nonce_sid';
const prefix = 'HAN_WINDOWS_RUNTIME_DIAGNOSTIC=';
const valid = {
  operation: 'descriptor.read',
  category: 'nonzero_exit',
  exitStatus: 1,
  stage: 'publication_lock',
  kind: 'permission_denied',
  win32Code: 5,
};

describe('installed Windows proof diagnostics', () => {
  test('reports only validated metadata, not surrounding subprocess output', () => {
    const output = `${secret}\n${prefix}${JSON.stringify(valid)}\n${secret}`;
    const error = new ProofCommandError(1, output);
    const report = safeProofFailure('initial-start', error);
    expect(JSON.parse(report)).toEqual({
      phase: 'initial-start',
      exitStatus: 1,
      diagnostic: valid,
    });
    expect(report.includes(secret)).toBe(false);
  });

  test('rejects secrets in each marker field and unknown fields', () => {
    for (const key of [
      'operation',
      'category',
      'exitStatus',
      'spawnCode',
      'stage',
      'kind',
      'win32Code',
      'unexpected',
    ]) {
      const output = `${prefix}${JSON.stringify({ ...valid, [key]: secret })}`;
      expect(safeHelperDiagnostic(output)).toBeUndefined();
      expect(
        safeProofFailure(
          'initial-start',
          new ProofCommandError(1, output)
        ).includes(secret)
      ).toBe(false);
    }
  });

  test('rejects malformed markers and sanitizes arbitrary errors and phase', () => {
    for (const output of [
      secret,
      `${prefix}${secret}`,
      `${prefix}${JSON.stringify(valid)}${secret}`,
    ]) {
      expect(safeHelperDiagnostic(output)).toBeUndefined();
      expect(
        safeProofFailure(
          'initial-start',
          new ProofCommandError(1, output)
        ).includes(secret)
      ).toBe(false);
    }
    expect(
      safeProofFailure(secret, new Error('unexpected generic message'))
    ).toBe('{"phase":"setup","exitStatus":null,"diagnostic":null}');
    expect(safeProofFailure(secret, new Error(secret)).includes(secret)).toBe(
      false
    );
  });

  test('classifies startup timeout without printing command output', () => {
    const output = `${secret}\nCoordinator failed to start within 60s timeout. ${secret}`;
    const report = safeProofFailure(
      'partial-claim-start',
      new ProofCommandError(1, output)
    );
    expect(JSON.parse(report).reason).toBe('startup_timeout');
    expect(report.includes(secret)).toBe(false);
  });
  test('classifies wait timeout and assertion failures safely', () => {
    const timeoutReport = safeProofFailure(
      'dead-pair-stop',
      new Error(`Timed out waiting for descriptor withdrawal ${secret}`)
    );
    expect(JSON.parse(timeoutReport)).toEqual({
      phase: 'dead-pair-stop',
      exitStatus: null,
      diagnostic: null,
      reason: 'timeout',
    });
    expect(timeoutReport.includes(secret)).toBe(false);

    const assertionError = Object.assign(
      new Error(`assertion failed: ${secret}`),
      {
        name: 'AssertionError',
      }
    );
    const assertReport = safeProofFailure('modeled-pid-reuse', assertionError);
    expect(JSON.parse(assertReport)).toEqual({
      phase: 'modeled-pid-reuse',
      exitStatus: null,
      diagnostic: null,
      reason: 'assertion_failure',
    });
    expect(assertReport.includes(secret)).toBe(false);
  });

  test('classifies typed errors and ignores arbitrary text in error message', () => {
    const arbitraryError = new Error(
      `arbitrary failure containing certificate and ${secret}`
    );
    const report = safeProofFailure('initial-start-descriptor', arbitraryError);
    expect(JSON.parse(report)).toEqual({
      phase: 'initial-start-descriptor',
      exitStatus: null,
      diagnostic: null,
    });
    expect(report.includes(secret)).toBe(false);

    const tlsError = Object.assign(
      new Error(`TLS handshake failed: ${secret}`),
      {
        code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      }
    );
    const tlsReport = safeProofFailure('initial-start-descriptor', tlsError);
    expect(JSON.parse(tlsReport)).toEqual({
      phase: 'initial-start-descriptor',
      exitStatus: null,
      diagnostic: null,
      reason: 'tls_error',
    });
    expect(tlsReport.includes(secret)).toBe(false);
  });

  test('keeps cleanup reporting separate from the initiating failure', () => {
    const primary = safeProofFailure(
      'initial-start',
      new ProofCommandError(7, `${prefix}${JSON.stringify(valid)}`)
    );
    const cleanup = safeProofFailure('cleanup', new Error(secret));
    expect(JSON.parse(primary).exitStatus).toBe(7);
    expect(JSON.parse(primary).diagnostic).toEqual(valid);
    expect(JSON.parse(cleanup)).toEqual({
      phase: 'cleanup',
      exitStatus: null,
      diagnostic: null,
    });
    expect(`${primary}${cleanup}`.includes(secret)).toBe(false);
  });

  test('validateHelperDiagnostic strictly validates all fields and rejects secrets', () => {
    expect(validateHelperDiagnostic(valid)).toEqual(valid);
    for (const key of [
      'operation',
      'category',
      'exitStatus',
      'spawnCode',
      'stage',
      'kind',
      'win32Code',
      'unexpected',
    ]) {
      expect(
        validateHelperDiagnostic({ ...valid, [key]: secret })
      ).toBeUndefined();
    }
    for (const invalidCode of [-1, 1.5, 0x100000000, Number.NaN, '5']) {
      expect(
        validateHelperDiagnostic({ ...valid, win32Code: invalidCode })
      ).toBeUndefined();
    }
  });

  test('reports validated process diagnostics and rejects secrets in every field', () => {
    const validProcess = {
      childPid: 1234,
      childCreationTime: '133748291029384756',
      childLiveness: 'alive' as const,
      descriptorMatches: true,
      descriptorState: 'present' as const,
      supervisorPid: 5678,
      supervisorCreationTime: '133748291020000000',
      supervisorStatusBefore: 'alive' as const,
      supervisorStatusAfter: 'dead' as const,
      supervisorExitCode: 0,
      supervisorProofKilled: false,
      markerFile: 'receipt-held' as const,
      errorCategory: 'none' as const,
      helperMarkerStatus: 'marker_present_valid' as const,
      helperDiagnostic: valid,
    };
    expect(safeProcessDiagnostic(validProcess)).toEqual(validProcess);

    const report = safeProofFailure(
      'orphan-live-https',
      Object.assign(new TypeError('fetch failed'), { code: 'ECONNREFUSED' }),
      validProcess
    );
    expect(JSON.parse(report)).toEqual({
      phase: 'orphan-live-https',
      exitStatus: null,
      diagnostic: null,
      process: validProcess,
      reason: 'connection_refused',
    });
    expect(report.includes(secret)).toBe(false);

    for (const key of [
      'childCreationTime',
      'childLiveness',
      'descriptorMatches',
      'descriptorState',
      'supervisorCreationTime',
      'supervisorStatusBefore',
      'supervisorStatusAfter',
      'markerFile',
      'errorCategory',
      'unexpected',
    ]) {
      const tainted = { ...validProcess, [key]: secret };
      expect(safeProcessDiagnostic(tainted)).toBeUndefined();
      const safeReport = safeProofFailure(
        'orphan-live-https',
        Object.assign(new TypeError('fetch failed'), { code: 'ECONNREFUSED' }),
        tainted
      );
      expect(safeReport.includes(secret)).toBe(false);
      expect(JSON.parse(safeReport).process).toBeUndefined();
    }

    for (const invalidPid of [-1, 0, 1.5, Number.NaN, '1234']) {
      expect(
        safeProcessDiagnostic({ ...validProcess, childPid: invalidPid })
      ).toBeUndefined();
      expect(
        safeProcessDiagnostic({ ...validProcess, supervisorPid: invalidPid })
      ).toBeUndefined();
    }

    for (const invalidExitCode of [1.5, Number.NaN, '0']) {
      expect(
        safeProcessDiagnostic({
          ...validProcess,
          supervisorExitCode: invalidExitCode as unknown as number,
        })
      ).toBeUndefined();
    }

    for (const invalidProofKilled of ['true', 1, 'false']) {
      expect(
        safeProcessDiagnostic({
          ...validProcess,
          supervisorProofKilled: invalidProofKilled as unknown as boolean,
        })
      ).toBeUndefined();
    }
    const unknownProofKill = safeProcessDiagnostic({
      ...validProcess,
      supervisorProofKilled: null,
    });
    expect(unknownProofKill).toBeDefined();
    expect(unknownProofKill).not.toHaveProperty('supervisorProofKilled');

    for (const invalidMarker of ['invalid-marker', 'held', 'ok', secret]) {
      expect(
        safeProcessDiagnostic({
          ...validProcess,
          markerFile: invalidMarker as unknown as 'none',
        })
      ).toBeUndefined();
    }

    for (const invalidCategory of ['invalid-cat', 'error', 'Error', secret]) {
      expect(
        safeProcessDiagnostic({
          ...validProcess,
          errorCategory: invalidCategory as unknown as 'none',
        })
      ).toBeUndefined();
    }

    expect(
      safeProcessDiagnostic({
        ...validProcess,
        helperDiagnostic: { ...valid, operation: 'secret_leak' },
      })
    ).toBeUndefined();
    // When supervisor was killed by proof cleanup (supervisorProofKilled: true),
    // supervisorExitCode should be null to avoid misleading attribution of the proof kill
    const proofKilledProcess = {
      ...validProcess,
      supervisorExitCode: null,
      supervisorProofKilled: true,
    };
    const sanitized = safeProcessDiagnostic(proofKilledProcess);
    expect(sanitized).toBeDefined();
    expect(sanitized?.supervisorProofKilled).toBe(true);
    expect(sanitized).not.toHaveProperty('supervisorExitCode');
    for (const category of [
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
      'sec_runtime_helper_failed',
      'sec_spawn_claim_missing',
      'sec_runtime_response_invalid',
      'sec_descriptor_target_invalid',
      'sec_descriptor_invalid',
      'sec_process_identity_missing',
      'sec_receipt_pid_mismatch',
      'sec_receipt_supervisor_mismatch',
      'sec_receipt_envelope_invalid',
      'sec_receipt_json_malformed',
      'sec_stdout_stream_missing',
      'sec_intent_child_mismatch',
      'sec_coordinator_changed',
      'sec_predecessor_alive',
      'sec_port_mismatch',
      'sec_health_identity_mismatch',
      'sec_health_rejected',
      'child_exit_error',
      'pid_claim_failed',
      'health_check_failed',
      'generic_error',
    ] as const) {
      expect(
        safeProcessDiagnostic({ ...validProcess, errorCategory: category })
          ?.errorCategory
      ).toBe(category);
    }
    for (const markerStatus of [
      'none',
      'marker_present_valid',
      'marker_present_invalid_json',
      'marker_present_invalid_schema',
      'no_marker_in_error',
    ] as const) {
      expect(
        safeProcessDiagnostic({
          ...validProcess,
          helperMarkerStatus: markerStatus,
        })?.helperMarkerStatus
      ).toBe(markerStatus);
    }
  });

  test('reports helper diagnostic and process diagnostic together without collision', () => {
    const command = new ProofCommandError(
      1,
      `${prefix}${JSON.stringify(valid)}`
    );
    const validProcess = {
      childPid: 1234,
      childCreationTime: '133748291029384756',
      childLiveness: 'alive' as const,
      descriptorMatches: true,
      descriptorState: 'present' as const,
      supervisorPid: 5678,
      supervisorCreationTime: '133748291020000000',
      supervisorStatusBefore: 'alive' as const,
      supervisorStatusAfter: 'dead' as const,
    };
    const report = safeProofFailure(
      'orphan-kill-supervisor',
      command,
      validProcess
    );
    expect(JSON.parse(report)).toEqual({
      phase: 'orphan-kill-supervisor',
      exitStatus: 1,
      diagnostic: valid,
      process: validProcess,
    });
  });
  test('classifySupervisorError discriminates real errors correctly and never leaks secret messages', () => {
    // 1. Connection refused errors
    expect(
      classifySupervisorError(
        Object.assign(new Error(`Failed to connect: ${secret}`), {
          name: 'CoordinatorConnectionRefusedError',
        })
      )
    ).toBe('connection_refused');
    expect(
      classifySupervisorError(
        Object.assign(new Error(`fetch failed: ${secret}`), {
          cause: { code: 'ECONNREFUSED' },
        })
      )
    ).toBe('connection_refused');

    // 2. Startup timeouts
    expect(
      classifySupervisorError(
        Object.assign(new Error(`Startup receipt timed out: ${secret}`), {
          name: 'CoordinatorSecurityError',
        })
      )
    ).toBe('timeout');
    expect(
      classifySupervisorError(
        Object.assign(
          new Error(`Coordinator listener probe timed out: ${secret}`),
          {
            name: 'CoordinatorSecurityError',
          }
        )
      )
    ).toBe('timeout');

    // 3. Child exit errors
    expect(
      classifySupervisorError(
        Object.assign(new Error(`Coordinator child exited: ${secret}`), {
          name: 'CoordinatorChildExitError',
        })
      )
    ).toBe('child_exit_error');

    // 4. Binary and module missing
    expect(
      classifySupervisorError(
        new Error(`[coordinator] han-coordinator binary not found ${secret}`)
      )
    ).toBe('binary_missing');
    expect(
      classifySupervisorError(
        Object.assign(new Error(`Cannot find module: ${secret}`), {
          code: 'ERR_MODULE_NOT_FOUND',
        })
      )
    ).toBe('module_not_found');

    // 5. PID claim errors
    expect(
      classifySupervisorError(
        new Error(
          `Supervisor claim no longer belongs to this process ${secret}`
        )
      )
    ).toBe('pid_claim_failed');
    expect(
      classifySupervisorError(new Error(`Malformed supervisor PID: ${secret}`))
    ).toBe('pid_claim_failed');
    expect(
      classifySupervisorError(
        Object.assign(new Error(`Insecure supervisor PID file: ${secret}`), {
          name: 'CoordinatorSecurityError',
        })
      )
    ).toBe('pid_claim_failed');

    // 6. Health check failures
    expect(
      classifySupervisorError(
        new Error(`Coordinator stopped responding: ${secret}`)
      )
    ).toBe('health_check_failed');
    expect(
      classifySupervisorError(
        Object.assign(
          new Error(
            `Coordinator descriptor changed during health check: ${secret}`
          ),
          {
            name: 'CoordinatorSecurityError',
          }
        )
      )
    ).toBe('health_check_failed');

    // 7. Discriminated CoordinatorSecurityError production origins
    expect(
      classifySupervisorError(
        Object.assign(
          new Error(
            `Windows local-runtime helper failed HAN_WINDOWS_RUNTIME_DIAGNOSTIC={"operation":"test","category":"timed_out"} ${secret}`
          ),
          { name: 'CoordinatorSecurityError' }
        )
      )
    ).toBe('sec_runtime_helper_failed');

    expect(
      classifySupervisorError(
        Object.assign(new Error(`Missing Windows spawn claim: ${secret}`), {
          name: 'CoordinatorSecurityError',
        })
      )
    ).toBe('sec_spawn_claim_missing');

    expect(
      classifySupervisorError(
        Object.assign(
          new Error(`Invalid Windows local-runtime response: ${secret}`),
          {
            name: 'CoordinatorSecurityError',
          }
        )
      )
    ).toBe('sec_runtime_response_invalid');

    expect(
      classifySupervisorError(
        Object.assign(
          new Error(`Invalid Windows descriptor target: ${secret}`),
          {
            name: 'CoordinatorSecurityError',
          }
        )
      )
    ).toBe('sec_descriptor_target_invalid');

    expect(
      classifySupervisorError(
        Object.assign(new Error(`Invalid coordinator descriptor: ${secret}`), {
          name: 'CoordinatorSecurityError',
        })
      )
    ).toBe('sec_descriptor_invalid');

    expect(
      classifySupervisorError(
        Object.assign(
          new Error(`Missing Windows process identity: ${secret}`),
          {
            name: 'CoordinatorSecurityError',
          }
        )
      )
    ).toBe('sec_process_identity_missing');

    expect(
      classifySupervisorError(
        Object.assign(
          new Error(
            `Missing Windows process identity in startup receipt: ${secret}`
          ),
          {
            name: 'CoordinatorSecurityError',
          }
        )
      )
    ).toBe('sec_process_identity_missing');

    expect(
      classifySupervisorError(
        Object.assign(new Error(`Startup receipt PID mismatch: ${secret}`), {
          name: 'CoordinatorSecurityError',
        })
      )
    ).toBe('sec_receipt_pid_mismatch');

    expect(
      classifySupervisorError(
        Object.assign(
          new Error(`Startup receipt supervisor mismatch: ${secret}`),
          {
            name: 'CoordinatorSecurityError',
          }
        )
      )
    ).toBe('sec_receipt_supervisor_mismatch');

    expect(
      classifySupervisorError(
        Object.assign(
          new Error(`Invalid startup receipt envelope: ${secret}`),
          {
            name: 'CoordinatorSecurityError',
          }
        )
      )
    ).toBe('sec_receipt_envelope_invalid');

    expect(
      classifySupervisorError(
        Object.assign(new Error(`Malformed startup receipt JSON: ${secret}`), {
          name: 'CoordinatorSecurityError',
        })
      )
    ).toBe('sec_receipt_json_malformed');

    expect(
      classifySupervisorError(
        Object.assign(new Error(`Missing child stdout stream: ${secret}`), {
          name: 'CoordinatorSecurityError',
        })
      )
    ).toBe('sec_stdout_stream_missing');

    expect(
      classifySupervisorError(
        Object.assign(
          new Error(`Shutdown intent child identity mismatch: ${secret}`),
          {
            name: 'CoordinatorSecurityError',
          }
        )
      )
    ).toBe('sec_intent_child_mismatch');

    expect(
      classifySupervisorError(
        Object.assign(
          new Error(`Coordinator changed during startup: ${secret}`),
          {
            name: 'CoordinatorSecurityError',
          }
        )
      )
    ).toBe('sec_coordinator_changed');

    expect(
      classifySupervisorError(
        Object.assign(
          new Error(`Previous coordinator is still alive: ${secret}`),
          {
            name: 'CoordinatorSecurityError',
          }
        )
      )
    ).toBe('sec_predecessor_alive');

    expect(
      classifySupervisorError(
        Object.assign(
          new Error(
            `Coordinator descriptor port does not match requested port: ${secret}`
          ),
          {
            name: 'CoordinatorSecurityError',
          }
        )
      )
    ).toBe('sec_port_mismatch');

    expect(
      classifySupervisorError(
        Object.assign(
          new Error(`Coordinator health identity mismatch: ${secret}`),
          {
            name: 'CoordinatorSecurityError',
          }
        )
      )
    ).toBe('sec_health_identity_mismatch');

    expect(
      classifySupervisorError(
        Object.assign(
          new Error(`Coordinator health rejected (500): ${secret}`),
          {
            name: 'CoordinatorSecurityError',
          }
        )
      )
    ).toBe('sec_health_rejected');

    // General security error (catch-all for other security failures)
    expect(
      classifySupervisorError(
        Object.assign(new Error(`Unknown security check failed: ${secret}`), {
          name: 'CoordinatorSecurityError',
        })
      )
    ).toBe('security_error');
    // 8. Standard runtime errors
    expect(classifySupervisorError(new ReferenceError(secret))).toBe(
      'reference_error'
    );
    expect(classifySupervisorError(new TypeError(secret))).toBe('type_error');
    expect(classifySupervisorError(new SyntaxError(secret))).toBe(
      'syntax_error'
    );
    expect(classifySupervisorError(null)).toBe('none');
    expect(
      classifySupervisorError(new Error('something completely generic'))
    ).toBe('generic_error');
  });
  test('evaluateHelperMarkerStatus classifies marker presence and validity accurately without leaking secrets', () => {
    // Exact production string format from CoordinatorSecurityError: Windows local-runtime helper failed HAN_WINDOWS_RUNTIME_DIAGNOSTIC=...
    expect(
      evaluateHelperMarkerStatus(
        `CoordinatorSecurityError: Windows local-runtime helper failed ${prefix}${JSON.stringify(valid)}\n${secret}`
      )
    ).toBe('marker_present_valid');

    expect(
      evaluateHelperMarkerStatus(
        `Windows local-runtime helper failed ${prefix}${JSON.stringify(valid)}\n${secret}`
      )
    ).toBe('marker_present_valid');

    expect(
      evaluateHelperMarkerStatus(
        `CoordinatorSecurityError: Windows local-runtime helper failed ${prefix}{invalid-json\n${secret}`
      )
    ).toBe('marker_present_invalid_json');

    expect(
      evaluateHelperMarkerStatus(
        `CoordinatorSecurityError: Windows local-runtime helper failed ${prefix}${JSON.stringify({ ...valid, operation: 'unknown_op' })}\n${secret}`
      )
    ).toBe('marker_present_invalid_schema');

    expect(
      evaluateHelperMarkerStatus(
        `CoordinatorSecurityError: Windows local-runtime helper failed without any marker\n${secret}`
      )
    ).toBe('no_marker_in_error');
  });

  test('exports phases array as const with all expected phases', () => {
    expect(phases).toContain('setup');
    expect(phases).toContain('initial-status');
    expect(phases).toContain('initial-start');
    expect(phases).toContain('fast-exit-receipt');
    expect(phases).toContain('fast-exit-cleanup');
    expect(phases).toContain('cleanup');
    expect(phases.length).toBe(48);
    expect(Object.isFrozen(phases) || Array.isArray(phases)).toBe(true);
  });

  test('safeProofProgress validates and formats progress JSON correctly', () => {
    const validProgress = {
      phase: 'initial-start',
      elapsedMs: 1250,
      previous: {
        phase: 'initial-status',
        ms: 320,
        cliCount: 2,
        cliMs: 250,
        cliMaxMs: 150,
        probeCount: 4,
        probeMs: 70,
      },
    };

    const output = safeProofProgress(validProgress);
    expect(output).toBeDefined();
    if (output) {
      expect(JSON.parse(output)).toEqual(validProgress);
    }

    // Null previous is allowed for the initial phase
    const initialProgress = {
      phase: 'setup',
      elapsedMs: 0,
      previous: null,
    };
    const outputInitial = safeProofProgress(initialProgress);
    expect(outputInitial).toBeDefined();
    if (outputInitial) {
      expect(JSON.parse(outputInitial)).toEqual(initialProgress);
    }
  });

  test('safeProofProgress rejects unlisted phases, negative or non-integer numbers, extra keys, and secrets', () => {
    const base = {
      phase: 'initial-start',
      elapsedMs: 100,
      previous: {
        phase: 'initial-status',
        ms: 50,
        cliCount: 1,
        cliMs: 30,
        cliMaxMs: 30,
        probeCount: 2,
        probeMs: 20,
      },
    };

    // Unlisted phase
    expect(
      safeProofProgress({ ...base, phase: 'unlisted-phase' })
    ).toBeUndefined();
    expect(safeProofProgress({ ...base, phase: secret })).toBeUndefined();
    expect(
      safeProofProgress({
        ...base,
        previous: { ...base.previous, phase: 'unknown-phase' },
      })
    ).toBeUndefined();
    expect(
      safeProofProgress({
        ...base,
        previous: { ...base.previous, phase: secret },
      })
    ).toBeUndefined();

    // Non-integer or negative numbers
    expect(safeProofProgress({ ...base, elapsedMs: -1 })).toBeUndefined();
    expect(safeProofProgress({ ...base, elapsedMs: 1.5 })).toBeUndefined();
    expect(safeProofProgress({ ...base, elapsedMs: '100' })).toBeUndefined();
    expect(
      safeProofProgress({
        ...base,
        previous: { ...base.previous, ms: -5 },
      })
    ).toBeUndefined();
    expect(
      safeProofProgress({
        ...base,
        previous: { ...base.previous, cliCount: 1.2 },
      })
    ).toBeUndefined();
    expect(
      safeProofProgress({
        ...base,
        previous: { ...base.previous, cliMs: -1 },
      })
    ).toBeUndefined();
    expect(
      safeProofProgress({
        ...base,
        previous: { ...base.previous, cliMaxMs: -1 },
      })
    ).toBeUndefined();
    expect(
      safeProofProgress({
        ...base,
        previous: { ...base.previous, probeCount: -1 },
      })
    ).toBeUndefined();
    expect(
      safeProofProgress({
        ...base,
        previous: { ...base.previous, probeMs: -1 },
      })
    ).toBeUndefined();

    // Extra keys
    expect(safeProofProgress({ ...base, extraKey: 'leaked' })).toBeUndefined();
    expect(safeProofProgress({ ...base, secret })).toBeUndefined();
    expect(
      safeProofProgress({
        ...base,
        previous: { ...base.previous, token: secret },
      })
    ).toBeUndefined();

    // Missing keys
    expect(safeProofProgress({ phase: 'setup', elapsedMs: 0 })).toBeUndefined();
    expect(
      safeProofProgress({
        phase: 'setup',
        elapsedMs: 0,
        previous: { phase: 'setup', ms: 0 },
      })
    ).toBeUndefined();

    // Invalid value types
    expect(safeProofProgress(null)).toBeUndefined();
    expect(safeProofProgress(undefined)).toBeUndefined();
    expect(safeProofProgress('string')).toBeUndefined();
    expect(safeProofProgress([])).toBeUndefined();
  });

  test('safeProofCleanup validates and formats cleanup JSON correctly', () => {
    for (const step of cleanupSteps) {
      const basic = { step, ms: 45, ok: true };
      const outputBasic = safeProofCleanup(basic);
      expect(outputBasic).toBeDefined();
      if (outputBasic) {
        expect(JSON.parse(outputBasic)).toEqual(basic);
      }
    }

    const sweepResult = {
      step: 'sweep',
      ms: 120,
      ok: true,
      terminated: 2,
      remaining: 0,
    };
    const outputSweep = safeProofCleanup(sweepResult);
    expect(outputSweep).toBeDefined();
    if (outputSweep) {
      expect(JSON.parse(outputSweep)).toEqual(sweepResult);
    }
  });

  test('safeProofCleanup rejects invalid steps, non-integer numbers, extra keys, and secrets', () => {
    // Invalid steps
    expect(
      safeProofCleanup({ step: 'invalid-step', ms: 10, ok: true })
    ).toBeUndefined();
    expect(
      safeProofCleanup({ step: secret, ms: 10, ok: true })
    ).toBeUndefined();

    // Invalid numbers
    expect(
      safeProofCleanup({ step: 'stop', ms: -1, ok: true })
    ).toBeUndefined();
    expect(
      safeProofCleanup({ step: 'stop', ms: 12.34, ok: true })
    ).toBeUndefined();
    expect(
      safeProofCleanup({ step: 'sweep', ms: 10, ok: true, terminated: -1 })
    ).toBeUndefined();
    expect(
      safeProofCleanup({ step: 'sweep', ms: 10, ok: true, remaining: 1.5 })
    ).toBeUndefined();

    // Non-boolean ok
    expect(
      safeProofCleanup({
        step: 'stop',
        ms: 10,
        ok: 'true' as unknown as boolean,
      })
    ).toBeUndefined();
    expect(
      safeProofCleanup({ step: 'stop', ms: 10, ok: 1 as unknown as boolean })
    ).toBeUndefined();

    // Extra keys
    expect(
      safeProofCleanup({ step: 'stop', ms: 10, ok: true, extra: 'bad' })
    ).toBeUndefined();
    expect(
      safeProofCleanup({ step: 'stop', ms: 10, ok: true, token: secret })
    ).toBeUndefined();

    // Missing required keys
    expect(safeProofCleanup({ step: 'stop', ms: 10 })).toBeUndefined();
    expect(safeProofCleanup({ step: 'stop', ok: true })).toBeUndefined();
    expect(safeProofCleanup({ ms: 10, ok: true })).toBeUndefined();

    // Invalid value types
    expect(safeProofCleanup(null)).toBeUndefined();
    expect(safeProofCleanup(undefined)).toBeUndefined();
    expect(safeProofCleanup('invalid')).toBeUndefined();
    expect(safeProofCleanup([])).toBeUndefined();
  });

  test('safeProofFailure maps new error names strictly without inspecting message text', () => {
    // ProofDeadlineError -> deadline
    class ProofDeadlineError extends Error {
      constructor(msg: string) {
        super(msg);
        this.name = 'ProofDeadlineError';
      }
    }
    const deadlineErr = new ProofDeadlineError(`Proof exceeded ${secret}`);
    const deadlineJson = JSON.parse(
      safeProofFailure('orphan-live', deadlineErr)
    );
    expect(deadlineJson.reason).toBe('deadline');
    expect(JSON.stringify(deadlineJson).includes(secret)).toBe(false);

    // ProofSubprocessTimeout -> subprocess_timeout
    class ProofSubprocessTimeout extends Error {
      constructor(msg: string) {
        super(msg);
        this.name = 'ProofSubprocessTimeout';
      }
    }
    const subprocErr = new ProofSubprocessTimeout(
      `Subprocess timed out ${secret}`
    );
    const subprocJson = JSON.parse(safeProofFailure('orphan-live', subprocErr));
    expect(subprocJson.reason).toBe('subprocess_timeout');
    expect(JSON.stringify(subprocJson).includes(secret)).toBe(false);

    // ProofOutputRetained -> output_handle_retained
    class ProofOutputRetained extends Error {
      constructor(msg: string) {
        super(msg);
        this.name = 'ProofOutputRetained';
      }
    }
    const retainedErr = new ProofOutputRetained(
      `Output handle retained ${secret}`
    );
    const retainedJson = JSON.parse(
      safeProofFailure('orphan-live', retainedErr)
    );
    expect(retainedJson.reason).toBe('output_handle_retained');
    expect(JSON.stringify(retainedJson).includes(secret)).toBe(false);

    // ProofWatchdogError -> watchdog
    class ProofWatchdogError extends Error {
      constructor(msg: string) {
        super(msg);
        this.name = 'ProofWatchdogError';
      }
    }
    const watchdogErr = new ProofWatchdogError(`Watchdog fired ${secret}`);
    const watchdogJson = JSON.parse(
      safeProofFailure('orphan-live', watchdogErr)
    );
    expect(watchdogJson.reason).toBe('watchdog');
    expect(JSON.stringify(watchdogJson).includes(secret)).toBe(false);

    // Error with code: 'WATCHDOG'
    const codedWatchdogErr = new Error('watchdog fired');
    (codedWatchdogErr as unknown as { code: string }).code = 'WATCHDOG';
    const codedWatchdogJson = JSON.parse(
      safeProofFailure('orphan-live', codedWatchdogErr)
    );
    expect(codedWatchdogJson.reason).toBe('watchdog');

    // CRITICAL: A generic error whose message contains "deadline" or other keywords
    // but without the matching error.name MUST NOT be given the reason!
    const spoofMsgErr = new Error(
      `Custom error with deadline reached and subprocess_timeout ${secret}`
    );
    const spoofMsgJson = JSON.parse(
      safeProofFailure('orphan-live', spoofMsgErr)
    );
    expect(spoofMsgJson.reason).toBeUndefined();
    expect(JSON.stringify(spoofMsgJson).includes(secret)).toBe(false);
  });
});
