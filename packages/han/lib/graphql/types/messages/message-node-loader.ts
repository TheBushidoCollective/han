/**
 * GraphQL Message Node Loader
 *
 * Node loading helpers for the Message type.
 */

import { join } from 'node:path';
import {
  getSessionMessagesPaginated,
  type SessionMessage,
} from '../../../api/sessions.ts';
import { getClaudeConfigDir } from '../../../config/claude-settings.ts';
import { getMessage, getProjectBySlug, getSession } from '../../../grpc/data-access.ts';
import { registerNodeLoader } from '../../node-registry.ts';
import type { MessageWithSession } from './message-interface.ts';

/**
 * Get a single message by its composite ID components
 * Loads the session's messages and finds the one at the specified line number
 *
 * @param projectDir - Encoded project directory (e.g., "-Volumes-dev-src-...")
 * @param sessionId - Session UUID
 * @param lineNumber - Line number in the JSONL file (1-based)
 * @returns The message with session context, or null if not found
 */
export async function getMessageByLineNumber(
  projectDir: string,
  sessionId: string,
  lineNumber: number
): Promise<MessageWithSession | null> {
  // Load messages for the session
  // Line numbers are 1-based, offset is 0-based
  // To get the message at lineNumber N, we need offset = N-1, limit = 1
  const { messages } = await getSessionMessagesPaginated(
    sessionId,
    lineNumber - 1,
    1
  );

  if (messages.length === 0) {
    return null;
  }

  const msg = messages[0];
  return {
    ...msg,
    projectDir,
    sessionId,
    lineNumber,
  };
}

/**
 * Convert a native Message to MessageWithSession
 * Used by the node loader and message query to return the proper GraphQL type
 */
export async function nativeMessageToMessageWithSession(
  msg: NonNullable<Awaited<ReturnType<typeof getMessage>>>
): Promise<MessageWithSession> {
  // Get project directory from session
  let projectDir = '';
  const session = await getSession(msg.sessionId);
  if (session?.projectId) {
    const project = await getProjectBySlug(session.projectId);
    if (project) {
      const configDir = getClaudeConfigDir();
      projectDir = join(configDir, 'projects', project.slug);
    }
  }

  // Convert native Message to SessionMessage format
  const sessionMessage: SessionMessage = {
    id: msg.id,
    type: msg.messageType,
    role: msg.role ?? undefined,
    content: msg.content ?? undefined,
    timestamp: msg.timestamp,
    sessionId: msg.sessionId,
    rawJson: msg.rawJson ?? undefined,
    toolName: msg.toolName ?? undefined,
    agentId: msg.agentId ?? undefined,
    parentId: msg.parentId ?? undefined,
  };

  return {
    ...sessionMessage,
    projectDir,
    sessionId: msg.sessionId,
    lineNumber: msg.lineNumber,
  };
}

/**
 * Register node loader for Message type
 * ID format: UUID (the message's unique identifier)
 */
registerNodeLoader('Message', async (messageId: string) => {
  // Fetch message by UUID directly from the database
  const msg = await getMessage(messageId);
  if (!msg) {
    console.warn(`Message not found: ${messageId}`);
    return null;
  }

  return nativeMessageToMessageWithSession(msg);
});
