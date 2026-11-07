import { describe, expect, test } from 'bun:test';
import {
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
      markerFile: 'receipt-held' as const,
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
});
