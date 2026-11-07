import { describe, expect, test } from 'bun:test';
import {
  classifySupervisorError,
  ProofCommandError,
  safeHelperDiagnostic,
  safeProcessDiagnostic,
  safeProofFailure,
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
});
