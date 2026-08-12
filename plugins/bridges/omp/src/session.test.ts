import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  deriveSessionIdFromFile,
  pathToSlug,
  readSessionHeaderId,
  resolveSessionId,
} from './session';

const workspace = mkdtempSync(join(tmpdir(), 'han-omp-session-'));
afterAll(() => rmSync(workspace, { recursive: true, force: true }));

/** Write a session file and return its path. */
function writeSessionFile(name: string, lines: string[]): string {
  const path = join(workspace, name);
  writeFileSync(path, `${lines.join('\n')}\n`);
  return path;
}

describe('pathToSlug', () => {
  // The slug must match the OpenCode bridge's byte-for-byte, or the same
  // project indexed from two harnesses lands under two different slugs.
  test('collapses separators and dots into hyphens', () => {
    expect(pathToSlug('/Users/j/dev/src/github.com/org/repo')).toBe(
      '-Users-j-dev-src-github-com-org-repo'
    );
  });

  test('replaces only the leading slash, not every path root character', () => {
    expect(pathToSlug('/tmp')).toBe('-tmp');
    expect(pathToSlug('/')).toBe('-');
  });

  test('leaves a relative path without a leading hyphen', () => {
    expect(pathToSlug('dev/src/app.v2')).toBe('dev-src-app-v2');
  });

  test('rewrites dotfile and dotted directory segments', () => {
    expect(pathToSlug('/home/j/.config/my.app')).toBe('-home-j--config-my-app');
  });
});

describe('deriveSessionIdFromFile', () => {
  test('extracts the id from a real omp session filename', () => {
    expect(
      deriveSessionIdFromFile(
        '/Users/j/.omp/agent/sessions/-dev-src-app/2026-08-11T06-02-09-379Z_019fef6a-0063-7000-8a19-d9914e3949f0.jsonl'
      )
    ).toBe('019fef6a-0063-7000-8a19-d9914e3949f0');
  });

  test('splits on the last underscore, not the first', () => {
    // A timestamp format containing an underscore must not truncate the id.
    // omp session ids are UUIDv7 and never contain one.
    expect(deriveSessionIdFromFile('2026-08-11_06-02-09_abc123.jsonl')).toBe(
      'abc123'
    );
  });

  test('keeps the whole stem when there is no timestamp prefix', () => {
    expect(deriveSessionIdFromFile('/tmp/custom-session.jsonl')).toBe(
      'custom-session'
    );
  });

  test('handles a path with no .jsonl extension', () => {
    expect(deriveSessionIdFromFile('/tmp/2026-01-01T00-00-00-000Z_sess')).toBe(
      'sess'
    );
  });

  test('falls back to the stem when the underscore is trailing', () => {
    // Returning "" here would produce a nameless events file.
    expect(deriveSessionIdFromFile('/tmp/2026-01-01T00-00-00-000Z_.jsonl')).toBe(
      '2026-01-01T00-00-00-000Z_'
    );
  });

  test('returns null when there is no usable name', () => {
    expect(deriveSessionIdFromFile(undefined)).toBeNull();
    expect(deriveSessionIdFromFile(null)).toBeNull();
    expect(deriveSessionIdFromFile('')).toBeNull();
    expect(deriveSessionIdFromFile('/tmp/.jsonl')).toBeNull();
  });
});

describe('readSessionHeaderId', () => {
  const header =
    '{"type":"session","version":3,"id":"019fef6a-0063-7000-8a19-d9914e3949f0","timestamp":"2026-08-11T06:02:09.379Z","cwd":"/x"}';

  test('skips the fixed-width title slot that precedes the header', () => {
    const path = writeSessionFile('titled.jsonl', [
      '{"type":"title","v":1,"title":"t","source":"auto","pad":"    "}',
      header,
      '{"type":"model_change","id":"684024a6","parentId":null,"model":"anthropic/claude-opus-5"}',
    ]);
    expect(readSessionHeaderId(path)).toBe(
      '019fef6a-0063-7000-8a19-d9914e3949f0'
    );
  });

  test('reads a legacy file whose first line is the header', () => {
    const path = writeSessionFile('legacy.jsonl', [header]);
    expect(readSessionHeaderId(path)).toBe(
      '019fef6a-0063-7000-8a19-d9914e3949f0'
    );
  });

  test('returns null for a missing file rather than throwing', () => {
    expect(readSessionHeaderId(join(workspace, 'absent.jsonl'))).toBeNull();
  });

  test('returns null when no header is present', () => {
    const path = writeSessionFile('headerless.jsonl', [
      '{"type":"message","id":"aaaa1111"}',
    ]);
    expect(readSessionHeaderId(path)).toBeNull();
  });

  test('survives a truncated or corrupt leading line', () => {
    const path = writeSessionFile('corrupt.jsonl', ['{"type":"tit', header]);
    expect(readSessionHeaderId(path)).toBe(
      '019fef6a-0063-7000-8a19-d9914e3949f0'
    );
  });
});

describe('resolveSessionId', () => {
  test('prefers the on-disk header over the filename', () => {
    // A file omp did not name itself: the header is authoritative.
    const path = writeSessionFile('renamed_zzz.jsonl', [
      '{"type":"session","version":3,"id":"019fef6a-0063-7000-8a19-d9914e3949f0","cwd":"/x"}',
    ]);
    expect(resolveSessionId(path)).toBe(
      '019fef6a-0063-7000-8a19-d9914e3949f0'
    );
  });

  test('falls back to the filename before the session exists on disk', () => {
    // omp keeps a session in memory until its first assistant message, so at
    // session_start the path routinely names a file that is not there yet.
    const path = join(
      workspace,
      '2026-08-11T06-02-09-379Z_019fef6a-0063-7000-8a19-d9914e3949f0.jsonl'
    );
    expect(resolveSessionId(path)).toBe(
      '019fef6a-0063-7000-8a19-d9914e3949f0'
    );
  });

  test('returns null when omp reports no session file at all', () => {
    expect(resolveSessionId(undefined)).toBeNull();
  });
});
