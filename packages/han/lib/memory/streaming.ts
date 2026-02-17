/**
 * Memory Agent Streaming
 *
 * Stubs for Browse UI integration. In the gRPC architecture, streaming
 * is handled by the Rust coordinator, not the TypeScript CLI.
 */

import {
  type MemoryAgentResponse,
  type MemoryQueryParams,
  queryMemoryAgent,
} from './memory-agent.ts';

/**
 * Active memory query sessions
 */
const activeSessions = new Map<
  string,
  {
    question: string;
    startedAt: number;
    status: 'running' | 'complete' | 'error';
  }
>();

/**
 * Query memory (no streaming in CLI mode — streaming handled by coordinator)
 */
export async function queryMemoryWithStreaming(
  params: MemoryQueryParams
): Promise<MemoryAgentResponse> {
  return queryMemoryAgent(params);
}

/**
 * Start a memory query session for Browse UI streaming.
 * Returns a session ID (no actual streaming in CLI mode).
 */
export async function startMemoryQuerySession(
  params: MemoryQueryParams
): Promise<string> {
  const sessionId = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  activeSessions.set(sessionId, {
    question: params.question,
    startedAt: Date.now(),
    status: 'running',
  });

  queryMemoryAgent(params)
    .then((result) => {
      const session = activeSessions.get(sessionId);
      if (session) {
        session.status = result.success ? 'complete' : 'error';
      }
      setTimeout(() => activeSessions.delete(sessionId), 60000);
    })
    .catch(() => {
      const session = activeSessions.get(sessionId);
      if (session) session.status = 'error';
      setTimeout(() => activeSessions.delete(sessionId), 60000);
    });

  return sessionId;
}

/**
 * Get active memory query sessions
 */
export function getActiveMemorySessions(): Array<{
  sessionId: string;
  question: string;
  startedAt: number;
  status: 'running' | 'complete' | 'error';
}> {
  return Array.from(activeSessions.entries()).map(([sessionId, data]) => ({
    sessionId,
    ...data,
  }));
}

/**
 * Get a specific memory session's status
 */
export function getMemorySessionStatus(sessionId: string): {
  status: 'running' | 'complete' | 'error' | 'not_found';
} {
  const session = activeSessions.get(sessionId);
  if (!session) return { status: 'not_found' };
  return { status: session.status };
}
