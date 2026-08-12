/**
 * omp session identity and usage extraction.
 *
 * Two concerns live here:
 *
 * 1. Deriving the stable ids Han keys events by: the session id and the
 *    project slug. Both are pure functions so they can be tested directly.
 * 2. Reading token and cost accounting back out of omp's session JSONL.
 *    omp's extension event bus carries no token counts and no dollar cost, so
 *    the only place those numbers exist is the persisted session file, where
 *    omp has already computed them.
 */

import { closeSync, openSync, readSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import type { OmpSessionEntry } from './types';

/** Bytes of a session file scanned when looking for the session header. */
const HEADER_SCAN_BYTES = 64 * 1024;

/** Logical lines examined before giving up on finding the session header. */
const HEADER_SCAN_LINES = 8;

/**
 * Convert a filesystem path to a Han project slug.
 *
 * Copied byte-for-byte from the OpenCode bridge so a project indexed from two
 * harnesses lands in one slug. Leading `/` becomes `-`, then every remaining
 * `/` and `.` becomes `-`:
 *
 *   /Users/j/dev/src/github.com/org/repo
 *     -> -Users-j-dev-src-github-com-org-repo
 */
export function pathToSlug(fsPath: string): string {
  return fsPath.replace(/^\//, '-').replace(/[/.]/g, '-');
}

/**
 * Derive the omp session id from its session file path.
 *
 * omp names session files `<timestamp>_<sessionId>.jsonl`, for example
 * `2026-08-11T06-02-09-379Z_019fef6a-0063-7000-8a19-d9914e3949f0.jsonl`. The
 * timestamp uses `-` as its only separator and the id is a UUIDv7, so the
 * single `_` is an unambiguous split point. Splitting on the LAST `_` rather
 * than the first keeps this correct if omp ever adopts a timestamp format
 * containing an underscore.
 *
 * A path with no `_` is not an error: a caller can point omp at an explicit
 * session file with any name. The stem is then the best available id.
 *
 * Returns null only when there is no usable name at all.
 */
export function deriveSessionIdFromFile(
  sessionFile: string | undefined | null
): string | null {
  if (!sessionFile) return null;

  const name = basename(sessionFile);
  const stem = name.endsWith('.jsonl') ? name.slice(0, -'.jsonl'.length) : name;
  if (stem.length === 0) return null;

  const separator = stem.lastIndexOf('_');
  if (separator === -1) return stem;

  const id = stem.slice(separator + 1);
  return id.length > 0 ? id : stem;
}

/**
 * Read the session id out of an omp session file's header entry.
 *
 * This is the authoritative id, but it is only available once the file exists.
 * omp keeps a new session entirely in memory until its first assistant
 * message, so at `session_start` there is routinely nothing on disk yet.
 *
 * Current omp files begin with a fixed-width `{"type":"title",...}` slot and
 * carry the `{"type":"session","id":...}` header on the following line; older
 * files start with the header. Both are handled by scanning the first few
 * lines for the header rather than assuming a position.
 *
 * Returns null when the file is missing, unreadable, or has no valid header.
 */
export function readSessionHeaderId(sessionFile: string): string | null {
  let fd: number | undefined;
  try {
    fd = openSync(sessionFile, 'r');
    const buffer = Buffer.allocUnsafe(HEADER_SCAN_BYTES);
    const bytesRead = readSync(fd, buffer, 0, HEADER_SCAN_BYTES, 0);
    if (bytesRead <= 0) return null;

    const lines = buffer.toString('utf8', 0, bytesRead).split('\n');
    const limit = Math.min(lines.length, HEADER_SCAN_LINES);
    for (let i = 0; i < limit; i++) {
      const line = lines[i]?.trim();
      if (!line) continue;
      let entry: OmpSessionEntry;
      try {
        entry = JSON.parse(line) as OmpSessionEntry;
      } catch {
        continue;
      }
      if (
        entry.type === 'session' &&
        typeof entry.id === 'string' &&
        entry.id
      ) {
        return entry.id;
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // Nothing actionable: the id has already been read or lost.
      }
    }
  }
}

/**
 * Resolve the id this bridge will tag every event with.
 *
 * The on-disk header wins when it is available, because it is what omp itself
 * considers the session id. The filename is the fallback and, for every
 * session omp names itself, produces the identical string. This is called once
 * per session and the result reused, so a session that starts memory-only and
 * later materializes on disk cannot end up with two ids.
 */
export function resolveSessionId(
  sessionFile: string | undefined | null
): string | null {
  if (!sessionFile) return null;
  return (
    readSessionHeaderId(sessionFile) ?? deriveSessionIdFromFile(sessionFile)
  );
}

/**
 * Token and cost accounting for one assistant message, normalized for Han.
 */
export interface OmpAssistantUsage {
  /** omp's 8-character session-entry id. Stable across file rewrites. */
  entryId: string;
  model: string;
  provider?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  /** Absent when omp did not compute a cost. Never substituted with zero. */
  costUsd?: number;
}

/**
 * Coerce one omp usage dimension to a token count.
 *
 * A dimension omp genuinely reports as zero and a dimension it omits both
 * become 0, because Han's token columns are counts rather than nullable
 * measurements. Cost is handled differently and deliberately: see below.
 */
function toTokenCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

/**
 * Incrementally reads assistant token usage out of an omp session JSONL file.
 *
 * Reads forward from a byte offset so a long session is not re-parsed on every
 * turn, and survives the two ways omp can invalidate that offset:
 *
 * - omp rewrites a session file in full for migrations, title-slot repair,
 *   fork, and move. A rewrite that shrinks the file is detected by size and
 *   restarts the scan from zero.
 * - A turn can land mid-write. Only whole lines are consumed; a trailing
 *   partial line is left for the next read.
 *
 * Entry ids already reported are remembered, so restarting a scan re-reads the
 * file without double counting tokens.
 */
export class SessionUsageReader {
  private offset = 0;
  private readonly reported = new Set<string>();

  constructor(private readonly sessionFile: string) {}

  /**
   * Return usage for every assistant message written since the last call.
   *
   * Returns an empty array for every condition that is not an error: the file
   * does not exist yet, nothing was appended, only a partial line was
   * appended, or the appended messages carry no usage.
   */
  readNewUsage(): OmpAssistantUsage[] {
    const size = this.currentSize();
    if (size === null) return [];

    if (size < this.offset) {
      // The file was rewritten or truncated. Re-scan; `reported` prevents
      // anything already counted from being emitted twice.
      this.offset = 0;
    }
    if (size === this.offset) return [];

    const chunk = this.readFrom(this.offset, size - this.offset);
    if (chunk === null) return [];

    const lastNewline = chunk.lastIndexOf('\n');
    if (lastNewline === -1) return [];
    this.offset += lastNewline + 1;

    const usage: OmpAssistantUsage[] = [];
    for (const line of chunk.slice(0, lastNewline).split('\n')) {
      const record = this.parseUsageLine(line);
      if (record) usage.push(record);
    }
    return usage;
  }

  private currentSize(): number | null {
    try {
      const stats = statSync(this.sessionFile);
      return stats.isFile() ? stats.size : null;
    } catch {
      // omp has not materialized the session file yet, or it was moved.
      return null;
    }
  }

  private readFrom(position: number, length: number): string | null {
    let fd: number | undefined;
    try {
      fd = openSync(this.sessionFile, 'r');
      const buffer = Buffer.allocUnsafe(length);
      const bytesRead = readSync(fd, buffer, 0, length, position);
      return bytesRead > 0 ? buffer.toString('utf8', 0, bytesRead) : null;
    } catch {
      return null;
    } finally {
      if (fd !== undefined) {
        try {
          closeSync(fd);
        } catch {
          // Already have the bytes; a failed close changes nothing.
        }
      }
    }
  }

  /**
   * Turn one JSONL line into a usage record, or null if it is not a
   * not-yet-reported assistant message carrying usage.
   */
  private parseUsageLine(line: string): OmpAssistantUsage | null {
    const trimmed = line.trim();
    if (!trimmed) return null;

    let entry: OmpSessionEntry;
    try {
      entry = JSON.parse(trimmed) as OmpSessionEntry;
    } catch {
      return null;
    }

    if (entry.type !== 'message') return null;
    const message = entry.message;
    if (!message || message.role !== 'assistant') return null;

    const usage = message.usage;
    if (!usage) return null;

    // Han requires a model on every token_usage event, and inventing one would
    // corrupt per-model cost rollups. Drop the record instead.
    const model = message.model;
    if (typeof model !== 'string' || model.length === 0) return null;

    const entryId = entry.id;
    if (typeof entryId !== 'string' || entryId.length === 0) return null;
    if (this.reported.has(entryId)) return null;
    this.reported.add(entryId);

    // A cost omp did not compute stays absent. A missing cost and a genuinely
    // free turn are different facts and must not collapse into 0.
    const total = usage.cost?.total;
    const costUsd =
      typeof total === 'number' && Number.isFinite(total) ? total : undefined;

    return {
      entryId,
      model,
      provider:
        typeof message.provider === 'string' && message.provider.length > 0
          ? message.provider
          : undefined,
      inputTokens: toTokenCount(usage.input),
      outputTokens: toTokenCount(usage.output),
      cacheReadTokens: toTokenCount(usage.cacheRead),
      cacheCreationTokens: toTokenCount(usage.cacheWrite),
      costUsd,
    };
  }
}
