import { afterEach, describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  CoordinatorConnectionRefusedError,
  CoordinatorSecurityError,
  coordinatorFetch,
  isExplicitConnectionRefusal,
  type LocalCoordinatorDescriptor,
} from '../lib/coordinator/connection.ts';

describe('coordinator transport error classification', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const descriptor: LocalCoordinatorDescriptor = {
    transportVersion: 1,
    instanceId: 'test-instance',
    pid: process.pid,
    httpsPort: 41957,
    grpcPort: 41958,
    certificatePem: '-----BEGIN CERTIFICATE-----\ntest',
    bearerToken: 'a'.repeat(43),
    supervisor: null,
  };

  test('a TypeError with own code ECONNREFUSED becomes CoordinatorConnectionRefusedError with cause preserved', async () => {
    try {
      const refusal = new TypeError('fetch failed');
      Object.defineProperty(refusal, 'code', {
        value: 'ECONNREFUSED',
        enumerable: true,
      });
      globalThis.fetch = (async () => {
        throw refusal;
      }) as unknown as typeof fetch;

      await expect(
        coordinatorFetch(descriptor, 41957, '/health')
      ).rejects.toThrow(CoordinatorConnectionRefusedError);

      try {
        await coordinatorFetch(descriptor, 41957, '/health');
      } catch (error) {
        expect(error instanceof CoordinatorConnectionRefusedError).toBe(true);
        expect(error instanceof CoordinatorSecurityError).toBe(true);
        expect((error as CoordinatorConnectionRefusedError).cause).toBe(
          refusal
        );
        expect(isExplicitConnectionRefusal(error)).toBe(true);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('an inherited code ECONNREFUSED stays generic CoordinatorSecurityError', async () => {
    try {
      const proto = { code: 'ECONNREFUSED' };
      const inherited = Object.create(proto);
      inherited.message = 'fetch failed';
      globalThis.fetch = (async () => {
        throw inherited;
      }) as unknown as typeof fetch;

      try {
        await coordinatorFetch(descriptor, 41957, '/health');
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error instanceof CoordinatorConnectionRefusedError).toBe(false);
        expect(error instanceof CoordinatorSecurityError).toBe(true);
        expect(isExplicitConnectionRefusal(error)).toBe(false);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('ECONNRESET stays generic CoordinatorSecurityError', async () => {
    try {
      const reset = new TypeError('fetch failed');
      Object.defineProperty(reset, 'code', {
        value: 'ECONNRESET',
        enumerable: true,
      });
      globalThis.fetch = (async () => {
        throw reset;
      }) as unknown as typeof fetch;

      try {
        await coordinatorFetch(descriptor, 41957, '/health');
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error instanceof CoordinatorConnectionRefusedError).toBe(false);
        expect(error instanceof CoordinatorSecurityError).toBe(true);
        expect(isExplicitConnectionRefusal(error)).toBe(false);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('a message containing ECONNREFUSED with another code stays generic CoordinatorSecurityError', async () => {
    try {
      const otherCode = new TypeError(
        'connection failed: ECONNREFUSED in message'
      );
      Object.defineProperty(otherCode, 'code', {
        value: 'EPROTO',
        enumerable: true,
      });
      globalThis.fetch = (async () => {
        throw otherCode;
      }) as unknown as typeof fetch;

      try {
        await coordinatorFetch(descriptor, 41957, '/health');
        expect.unreachable('should have thrown');
      } catch (error) {
        expect(error instanceof CoordinatorConnectionRefusedError).toBe(false);
        expect(error instanceof CoordinatorSecurityError).toBe(true);
        expect(isExplicitConnectionRefusal(error)).toBe(false);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('a plain CoordinatorSecurityError whose message says ECONNREFUSED is classified false', () => {
    const plain = new CoordinatorSecurityError(
      'Coordinator connection failed: ECONNREFUSED: Unable to connect'
    );
    expect(isExplicitConnectionRefusal(plain)).toBe(false);

    const wrappedPlain = new ConnectError(
      'wrapped untyped refusal',
      Code.Unknown,
      undefined,
      undefined,
      plain
    );
    expect(isExplicitConnectionRefusal(wrappedPlain)).toBe(false);
  });

  test('coordinatorFetch forces proxy: false after spread options', async () => {
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = (async (
      _url: string | URL | Request,
      init?: RequestInit
    ) => {
      capturedInit = init;
      return new Response(JSON.stringify({ status: 'ok', pid: process.pid }), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    try {
      await coordinatorFetch(descriptor, 41957, '/health', {
        proxy: 'http://evil.proxy:8080',
      } as unknown as RequestInit);
      expect((capturedInit as { proxy?: unknown })?.proxy).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('coordinator module import order independence', () => {
  const connectionPath = resolve(
    import.meta.dir,
    '../lib/coordinator/connection.ts'
  );
  const runtimePath = resolve(
    import.meta.dir,
    '../lib/coordinator/windows-runtime.ts'
  );
  const errorsPath = resolve(import.meta.dir, '../lib/coordinator/errors.ts');

  test('windows-runtime imported before connection succeeds without TDZ error', async () => {
    const code = `
      await import(${JSON.stringify(runtimePath)});
      await import(${JSON.stringify(connectionPath)});
    `;
    const proc = Bun.spawn([process.execPath, '-e', code], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr as ReadableStream).text();
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
  });

  test('connection imported before windows-runtime succeeds without TDZ error', async () => {
    const code = `
      await import(${JSON.stringify(connectionPath)});
      await import(${JSON.stringify(runtimePath)});
    `;
    const proc = Bun.spawn([process.execPath, '-e', code], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr as ReadableStream).text();
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
  });

  test('windows-runtime standalone import succeeds without TDZ error', async () => {
    const code = `
      await import(${JSON.stringify(runtimePath)});
    `;
    const proc = Bun.spawn([process.execPath, '-e', code], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr as ReadableStream).text();
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
  });

  test('errors module standalone import succeeds and exports classes', async () => {
    const code = `
      const errors = await import(${JSON.stringify(errorsPath)});
      if (!errors.CoordinatorSecurityError || !errors.CoordinatorConnectionRefusedError) {
        process.exit(1);
      }
    `;
    const proc = Bun.spawn([process.execPath, '-e', code], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr as ReadableStream).text();
    expect(exitCode).toBe(0);
    expect(stderr).toBe('');
  });
});
