import { expect, test } from 'bun:test';
import {
  type WindowsChildDescriptor,
  readWindowsChildDescriptor,
} from '../lib/coordinator/windows-runtime.ts';
import type { LocalCoordinatorDescriptor } from '../lib/coordinator/connection.ts';

const sampleDescriptor: LocalCoordinatorDescriptor = {
  transportVersion: 1,
  instanceId: '11111111-1111-4111-8111-111111111111',
  pid: 1234,
  httpsPort: 41957,
  grpcPort: 41958,
  certificatePem:
    '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----',
  bearerToken: 'a'.repeat(43),
  supervisor: {
    pid: 5678,
    nonce: '22222222-2222-4222-8222-222222222222',
    generationId: '33333333-3333-4333-8333-333333333333',
  },
  process: {
    pid: 1234,
    creationTime: '133000000000000000',
    userSid: 'S-1-5-21-1-2-3-4',
  },
};

function fakeSubprocess(output: string, exitCode: number | null = null) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (output.length > 0) {
        controller.enqueue(encoder.encode(output));
      }
      controller.close();
    },
  });
  return {
    pid: 1234,
    stdout: stream,
    exitCode,
  } as unknown as Bun.Subprocess;
}

test('complete receipt is readable and validates descriptor', async () => {
  const receiptJson = `${JSON.stringify({
    version: 1,
    descriptor: sampleDescriptor,
  })}\n`;
  const child = fakeSubprocess(receiptJson, 0);
  const descriptor = await readWindowsChildDescriptor(
    child,
    sampleDescriptor.supervisor,
    Date.now() + 5000
  );
  expect(descriptor).not.toBeNull();
  expect(descriptor?.instanceId).toBe(sampleDescriptor.instanceId);
  expect(descriptor?.pid).toBe(sampleDescriptor.pid);
  expect(descriptor?.process?.creationTime).toBe(
    sampleDescriptor.process?.creationTime
  );
});

test('complete receipt remains readable when child is already exited', async () => {
  const receiptJson = `${JSON.stringify({
    version: 1,
    descriptor: sampleDescriptor,
  })}\n`;
  const child = fakeSubprocess(receiptJson, 0);
  expect(child.exitCode).toBe(0);
  const descriptor = await readWindowsChildDescriptor(
    child,
    sampleDescriptor.supervisor,
    Date.now() + 5000
  );
  expect(descriptor?.instanceId).toBe(sampleDescriptor.instanceId);
});

test('truncated receipt before LF fails closed', async () => {
  const receiptJson = JSON.stringify({
    version: 1,
    descriptor: sampleDescriptor,
  }); // Note: missing newline
  const child = fakeSubprocess(receiptJson, 1);
  expect(
    readWindowsChildDescriptor(
      child,
      sampleDescriptor.supervisor,
      Date.now() + 5000
    )
  ).rejects.toThrow();
});

test('receipt with invalid version fails closed', async () => {
  const receiptJson = `${JSON.stringify({
    version: 2,
    descriptor: sampleDescriptor,
  })}\n`;
  const child = fakeSubprocess(receiptJson, 0);
  expect(
    readWindowsChildDescriptor(
      child,
      sampleDescriptor.supervisor,
      Date.now() + 5000
    )
  ).rejects.toThrow();
});

test('receipt missing required process identity on Windows fails closed', async () => {
  const missingProcess = {
    ...sampleDescriptor,
    process: undefined,
  };
  const receiptJson = `${JSON.stringify({
    version: 1,
    descriptor: missingProcess,
  })}\n`;
  const child = fakeSubprocess(receiptJson, 0);
  expect(
    readWindowsChildDescriptor(
      child,
      sampleDescriptor.supervisor,
      Date.now() + 5000
    )
  ).rejects.toThrow();
});

test('receipt with mismatched child PID fails closed', async () => {
  const mismatchedPid = {
    ...sampleDescriptor,
    pid: 9999,
    process: {
      ...sampleDescriptor.process,
      pid: 9999,
    },
  };
  const receiptJson = `${JSON.stringify({
    version: 1,
    descriptor: mismatchedPid,
  })}\n`;
  const child = fakeSubprocess(receiptJson, 0);
  expect(
    readWindowsChildDescriptor(
      child,
      sampleDescriptor.supervisor,
      Date.now() + 5000
    )
  ).rejects.toThrow();
});

test('receipt with mismatched supervisor binding fails closed', async () => {
  const receiptJson = `${JSON.stringify({
    version: 1,
    descriptor: sampleDescriptor,
  })}\n`;
  const child = fakeSubprocess(receiptJson, 0);
  const differentSupervisor = {
    pid: 5678,
    nonce: '99999999-9999-4999-8999-999999999999',
    generationId: '88888888-8888-4888-8888-888888888888',
  };
  expect(
    readWindowsChildDescriptor(child, differentSupervisor, Date.now() + 5000)
  ).rejects.toThrow();
});
