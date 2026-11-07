import { describe, expect, test } from 'bun:test';
import {
  ownedProcessScript,
  ProofProbeDiagnosticComplete,
  serializeDiagnosticRecord,
} from '../scripts/windows-probe-diagnostic.ts';
import { safeProofFailure } from '../scripts/windows-proof-diagnostics.ts';

describe('windows-probe-diagnostic', () => {
  describe('ownedProcessScript', () => {
    test('trace=false matches production script template exactly without kill', () => {
      const script = ownedProcessScript(1234, false, false);
      const expected =
        "$ErrorActionPreference='Stop'; try { $p=Get-Process -Id 1234 -ErrorAction Stop } catch { if ($_.FullyQualifiedErrorId -like 'NoProcessFoundForGivenId*') { exit 3 }; exit 6 }; try { $actual=[System.IO.Path]::GetFullPath($p.Path); $expected=[System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $env:HAN_PROOF_IMAGE).Path); if ($actual -ne $expected) { exit 4 }; if ($p.StartTime.ToUniversalTime().ToFileTimeUtc().ToString() -ne $env:HAN_PROOF_TIME) { exit 5 };  exit 0 } catch { exit 6 }";
      expect(script).toBe(expected);
    });

    test('trace=false includes Stop-Process when kill=true', () => {
      const script = ownedProcessScript(1234, true, false);
      expect(script).toContain(
        'Stop-Process -InputObject $p -Force -ErrorAction Stop; exit 0'
      );
    });

    test('trace=true injects hanTrace hooks and prelude', () => {
      const script = ownedProcessScript(1234, false, true);
      expect(script).toContain('$hanTraceStart=');
      expect(script).toContain("hanTrace 'S0';");
      expect(script).toContain("hanTrace 'S1';");
      expect(script).toContain("hanTrace 'S2';");
      expect(script).toContain("hanTrace 'S3';");
      expect(script).toContain("hanTrace 'X0';");
      expect(script).toContain("hanTrace 'X3';");
      expect(script).toContain("hanTrace 'X4';");
      expect(script).toContain("hanTrace 'X5';");
      expect(script).toContain("hanTrace 'X6A';");
      expect(script).toContain("hanTrace 'X6B';");
    });

    test('rejects non-positive or non-safe integer pid', () => {
      expect(() => ownedProcessScript(0, false)).toThrow('Invalid process id');
      expect(() => ownedProcessScript(-10, false)).toThrow(
        'Invalid process id'
      );
      expect(() => ownedProcessScript(1.5, false)).toThrow(
        'Invalid process id'
      );
      expect(() => ownedProcessScript(Number.NaN, false)).toThrow(
        'Invalid process id'
      );
    });
  });

  describe('ProofProbeDiagnosticComplete', () => {
    test('maps to reason probe_diagnostic in safeProofFailure', () => {
      const error = new ProofProbeDiagnosticComplete();
      expect(error.name).toBe('ProofProbeDiagnosticComplete');
      const failure = JSON.parse(
        safeProofFailure('initial-start-coordinator', error)
      );
      expect(failure).toEqual({
        phase: 'initial-start-coordinator',
        exitStatus: null,
        diagnostic: null,
        reason: 'probe_diagnostic',
      });
    });
  });

  describe('serializeDiagnosticRecord', () => {
    test('serializes valid control record', () => {
      const control = {
        variant: 'os-liveness-control',
        bunExitedBeforeCheck: false,
        classified: 'exited',
        reaped: true,
      };
      const json = serializeDiagnosticRecord(control);
      expect(JSON.parse(json)).toEqual(control);
      expect(json.includes('\\')).toBe(false);
    });

    test('rejects control record with missing or extra keys', () => {
      expect(() =>
        serializeDiagnosticRecord({
          variant: 'os-liveness-control',
          bunExitedBeforeCheck: false,
          classified: 'exited',
        })
      ).toThrow('Invalid control record keys');

      expect(() =>
        serializeDiagnosticRecord({
          variant: 'os-liveness-control',
          bunExitedBeforeCheck: false,
          classified: 'exited',
          reaped: true,
          extra: true,
        })
      ).toThrow('Invalid control record keys');
    });

    test('rejects control record with invalid classified status', () => {
      expect(() =>
        serializeDiagnosticRecord({
          variant: 'os-liveness-control',
          bunExitedBeforeCheck: false,
          classified: 'unknown-status',
          reaped: true,
        })
      ).toThrow('Invalid classified status');
    });

    test('serializes valid launch record', () => {
      const launch = {
        variant: 'proof-hidden-traced',
        at20s: {
          ms: 20050,
          bunExited: false,
          os: 'alive',
          last: 'S1',
        },
        ps: {
          S0: [100, 50],
          S1: [250, 120],
        },
        traceBytes: 128,
        otherTraceLines: 0,
        osPoll: {
          alive: 40,
          exited: 0,
          error: 0,
        },
        osExitMs: null,
        bunExitMs: 25000,
        exitCode: 0,
        killedAtCap: false,
        reaped: true,
        pipeRetained: false,
      };
      const json = serializeDiagnosticRecord(launch);
      expect(JSON.parse(json)).toEqual(launch);
      expect(json.includes('\\')).toBe(false);
    });

    test('rejects launch record with integer exceeding 10^7 cap', () => {
      const invalid = {
        variant: 'proof-hidden-traced',
        at20s: {
          ms: 10_000_001,
          bunExited: false,
          os: 'alive',
          last: 'S1',
        },
        ps: {},
        traceBytes: 0,
        otherTraceLines: 0,
        osPoll: { alive: 0, exited: 0, error: 0 },
        osExitMs: null,
        bunExitMs: null,
        exitCode: null,
        killedAtCap: false,
        reaped: true,
        pipeRetained: null,
      };
      expect(() => serializeDiagnosticRecord(invalid)).toThrow(
        'Invalid at20s.ms'
      );
    });

    test('rejects launch record with negative integers where non-negative required', () => {
      const invalid = {
        variant: 'proof-hidden-traced',
        at20s: {
          ms: -5,
          bunExited: false,
          os: 'alive',
          last: 'S1',
        },
        ps: {},
        traceBytes: 0,
        otherTraceLines: 0,
        osPoll: { alive: 0, exited: 0, error: 0 },
        osExitMs: null,
        bunExitMs: null,
        exitCode: null,
        killedAtCap: false,
        reaped: true,
        pipeRetained: null,
      };
      expect(() => serializeDiagnosticRecord(invalid)).toThrow(
        'Invalid at20s.ms'
      );
    });

    test('rejects launch record with unknown variant name', () => {
      const invalid = {
        variant: 'unrecognized-variant',
        at20s: {
          ms: null,
          bunExited: true,
          os: 'not-checked',
          last: 'none',
        },
        ps: {},
        traceBytes: 0,
        otherTraceLines: 0,
        osPoll: { alive: 0, exited: 0, error: 0 },
        osExitMs: null,
        bunExitMs: 1200,
        exitCode: 0,
        killedAtCap: false,
        reaped: true,
        pipeRetained: false,
      };
      expect(() => serializeDiagnosticRecord(invalid)).toThrow(
        'Invalid variant'
      );
    });

    test('rejects invalid token in ps', () => {
      const invalid = {
        variant: 'proof-hidden-traced',
        at20s: {
          ms: null,
          bunExited: true,
          os: 'not-checked',
          last: 'none',
        },
        ps: {
          INVALID_TOKEN: [100, 50],
        },
        traceBytes: 0,
        otherTraceLines: 0,
        osPoll: { alive: 0, exited: 0, error: 0 },
        osExitMs: null,
        bunExitMs: 1200,
        exitCode: 0,
        killedAtCap: false,
        reaped: true,
        pipeRetained: false,
      };
      expect(() => serializeDiagnosticRecord(invalid)).toThrow(
        'Invalid token in ps'
      );
    });

    test('rejects any record containing backslashes', () => {
      const invalid = {
        variant: 'proof-hidden-traced',
        at20s: {
          ms: null,
          bunExited: true,
          os: 'not-checked',
          last: 'none\\bad',
        },
        ps: {},
        traceBytes: 0,
        otherTraceLines: 0,
        osPoll: { alive: 0, exited: 0, error: 0 },
        osExitMs: null,
        bunExitMs: 1200,
        exitCode: 0,
        killedAtCap: false,
        reaped: true,
        pipeRetained: false,
      };
      expect(() => serializeDiagnosticRecord(invalid)).toThrow();
    });
  });
});
