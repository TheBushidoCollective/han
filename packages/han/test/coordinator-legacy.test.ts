import { expect, test } from 'bun:test';
import {
  type LegacyIdentity,
  validateInspectResult,
  validateRetireResult,
  validateStopResult,
} from '../lib/coordinator/legacy.ts';

const validIdentity: LegacyIdentity = {
  pid: 12345,
  startTime: '100.200',
  httpsPort: 41957,
  grpcPort: 41958,
  exe: '/usr/local/bin/han-coordinator',
};

test('validateInspectResult accepts canonical states', () => {
  expect(validateInspectResult({ status: 'absent' })).toEqual({
    status: 'absent',
  });
  expect(validateInspectResult({ status: 'modern', pid: 1234 })).toEqual({
    status: 'modern',
    pid: 1234,
  });
  expect(validateInspectResult({ status: 'starting', pid: 1234 })).toEqual({
    status: 'starting',
    pid: 1234,
  });
  expect(
    validateInspectResult({ status: 'legacy', identity: validIdentity })
  ).toEqual({ status: 'legacy', identity: validIdentity });
  expect(
    validateInspectResult({
      status: 'foreign',
      reason: 'other-user',
      pid: 999,
      exe: '/bin/other',
    })
  ).toEqual({
    status: 'foreign',
    reason: 'other-user',
    pid: 999,
    exe: '/bin/other',
  });
});

test('validateInspectResult rejects extra keys and malformed values', () => {
  // Extra keys
  expect(() => validateInspectResult({ status: 'absent', extra: 1 })).toThrow();
  expect(() =>
    validateInspectResult({ status: 'modern', pid: 123, extra: 2 })
  ).toThrow();
  expect(() =>
    validateInspectResult({
      status: 'legacy',
      identity: { ...validIdentity, extra: 3 },
    })
  ).toThrow();

  // Missing keys
  expect(() => validateInspectResult({ status: 'modern' })).toThrow();
  expect(() => validateInspectResult({ status: 'legacy' })).toThrow();
  expect(() =>
    validateInspectResult({
      status: 'foreign',
      reason: 'other-user',
    })
  ).toThrow();

  // Malformed values
  expect(() =>
    validateInspectResult({ status: 'modern', pid: '123' })
  ).toThrow();
  expect(() =>
    validateInspectResult({
      status: 'foreign',
      reason: 'invalid-reason',
      pid: null,
      exe: null,
    })
  ).toThrow();
});

test('validateStopResult accepts canonical states and rejects malformed responses', () => {
  expect(
    validateStopResult({
      status: 'stopped',
      escalation: 'none',
      retired: ['coordinator.pid'],
    })
  ).toEqual({
    status: 'stopped',
    escalation: 'none',
    retired: ['coordinator.pid'],
  });
  expect(validateStopResult({ status: 'changed' })).toEqual({
    status: 'changed',
  });
  expect(
    validateStopResult({ status: 'stuck', pid: 123, exe: '/bin/han' })
  ).toEqual({ status: 'stuck', pid: 123, exe: '/bin/han' });

  // Rejections
  expect(() => validateStopResult({ status: 'changed', extra: 1 })).toThrow();
  expect(() =>
    validateStopResult({
      status: 'stopped',
      escalation: 'invalid-esc',
      retired: [],
    })
  ).toThrow();
  expect(() => validateStopResult({ status: 'stuck', pid: '123' })).toThrow();
});

test('validateRetireResult accepts canonical states and rejects malformed responses', () => {
  expect(
    validateRetireResult({ status: 'clean', retired: ['coordinator.pid'] })
  ).toEqual({ status: 'clean', retired: ['coordinator.pid'] });
  expect(
    validateRetireResult({
      status: 'retired',
      retired: ['coordinator.pid'],
      supervisorPid: 54321,
    })
  ).toEqual({
    status: 'retired',
    retired: ['coordinator.pid'],
    supervisorPid: 54321,
  });
  expect(
    validateRetireResult({ status: 'blocked', pid: 123, exe: '/bin/han' })
  ).toEqual({ status: 'blocked', pid: 123, exe: '/bin/han' });
  expect(validateRetireResult({ status: 'listener-present' })).toEqual({
    status: 'listener-present',
  });

  // Rejections
  expect(() => validateRetireResult({ status: 'clean', extra: 1 })).toThrow();
  expect(() =>
    validateRetireResult({ status: 'retired', retired: 'not-array' })
  ).toThrow();
  expect(() =>
    validateRetireResult({ status: 'listener-present', pid: 123 })
  ).toThrow();
});
