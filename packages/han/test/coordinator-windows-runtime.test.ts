import { expect, test } from 'bun:test';
import { CoordinatorSecurityError, parseWindowsRuntimeResponse, windowsCreateLauncher, windowsProcessState, windowsRelease } from '../lib/coordinator/windows-runtime.ts';

const response = (stdout: string, status: number | null = 0) => ({stdout, status});

test('accepts only the versioned success envelope', () => {
  expect(parseWindowsRuntimeResponse(response('{"version":1,"ok":true,"result":null}'))).toBeNull();
  for (const body of [
    '', '{', '{}', 'null', '[]',
    '{"version":2,"ok":true,"result":null}',
    '{"version":1,"ok":false,"error":{"code":"ENOENT"}}',
    '{"version":1,"ok":true}',
    '{"version":1,"ok":true,"result":null} trailing',
    'x'.repeat(128 * 1024 + 1),
  ]) expect(() => parseWindowsRuntimeResponse(response(body))).toThrow(CoordinatorSecurityError);
});

test('missing executable, nonzero exit and excessive output are not absence', () => {
  expect(() => parseWindowsRuntimeResponse({error: new Error('ENOENT'), status:null, stdout:null})).toThrow(CoordinatorSecurityError);
  expect(() => parseWindowsRuntimeResponse(response('{"version":1,"ok":true,"result":null}', 1))).toThrow(CoordinatorSecurityError);
  expect(() => parseWindowsRuntimeResponse(response(' '.repeat(128 * 1024 + 1)))).toThrow(CoordinatorSecurityError);
});

test('rejects invalid launcher origins and tokens before starting a helper', () => {
  for (const origin of ['http://localhost:1234', 'https://127.0.0.1:1234', 'http://127.0.0.1:0', 'http://127.0.0.1:1234/', 'http://127.0.0.1:65536', 'http://user@127.0.0.1:1234'])
    expect(() => windowsCreateLauncher('/tmp/han', origin, 'a'.repeat(43))).toThrow(CoordinatorSecurityError);
  expect(() => windowsCreateLauncher('/tmp/han', 'http://127.0.0.1:1234', 'bad')).toThrow(CoordinatorSecurityError);
});

test('rejects incomplete process and claim identities before invoking helper', () => {
  expect(() => windowsProcessState('/tmp/han', {pid:123, creationTime:'', userSid:'S-1-5-21'})).toThrow(CoordinatorSecurityError);
  expect(() => windowsRelease('/tmp/han', 'supervisor', {nonce:'bad'} as never)).toThrow(CoordinatorSecurityError);
});
