/**
 * Transcript-Based Session Summarization
 *
 * Pure function that generates SessionSummary from transcript messages.
 * Deterministic: same transcript = same summary (safe for concurrent access).
 *
 * Replaces the observation-based summarization with transcript-based approach.
 */

import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import { getNativeModule } from '../native.ts';
import { getGitRemote } from './paths.ts';
import {
  parseTranscript,
  type TranscriptMessage,
} from './transcript-search.ts';
import type { Decision, SessionSummary, WorkItem } from './types.ts';

export interface TranscriptSummaryOptions {
  /** Include thinking blocks in analysis */
  includeThinking?: boolean;
  /** Maximum work items to extract */
  maxWorkItems?: number;
  /** Project name override */
  project?: string;
}

/**
 * Tool usage extracted from assistant messages
 */
interface _ExtractedToolUse {
  tool: string;
  input: Record<string, unknown>;
  timestamp: string;
}

/**
 * File operation extracted from tool usage
 */
interface FileOperation {
  path: string;
  operation: 'read' | 'write' | 'edit' | 'delete';
  timestamp: string;
}

/**
 * Summarize a transcript file
 *
 * Pure function: same transcript file = same summary output
 */
export async function summarizeTranscriptFile(
  transcriptPath: string,
  options: TranscriptSummaryOptions = {}
): Promise<SessionSummary | null> {
  if (!existsSync(transcriptPath)) {
    return null;
  }

  const messages = await parseTranscriptWithToolUse(transcriptPath, {
    includeThinking: options.includeThinking,
  });

  if (messages.length === 0) {
    return null;
  }

  const sessionId = basename(transcriptPath, '.jsonl');
  return summarizeTranscript(sessionId, messages, options);
}

/**
 * Summarize transcript messages into a SessionSummary
 *
 * Pure function: same messages = same summary output
 */
export function summarizeTranscript(
  sessionId: string,
  messages: TranscriptMessage[],
  options: TranscriptSummaryOptions = {}
): SessionSummary | null {
  if (messages.length === 0) {
    return null;
  }

  // Sort messages by timestamp for deterministic processing
  const sortedMessages = [...messages].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );

  const started_at = new Date(sortedMessages[0].timestamp).getTime();
  const ended_at = new Date(
    sortedMessages[sortedMessages.length - 1].timestamp
  ).getTime();

  // Extract file operations from messages
  const fileOps = extractFileOperations(sortedMessages);

  // Extract work items from file modifications
  const work_items = extractWorkItems(fileOps, sortedMessages, options);

  // Identify in-progress work
  const in_progress = extractInProgress(fileOps, work_items);

  // Extract decisions from conversation patterns
  const decisions = extractDecisions(sortedMessages);

  // Generate high-level summary
  const summary = generateSummaryText(sortedMessages, work_items);

  // Get project name
  const project =
    options.project || getProjectName(sortedMessages) || 'unknown';

  return {
    session_id: sessionId,
    project,
    started_at,
    ended_at,
    summary,
    work_items,
    in_progress,
    decisions,
  };
}

/**
 * Parse transcript with tool use extraction
 * Extends parseTranscript to also capture tool_use blocks
 */
async function parseTranscriptWithToolUse(
  filePath: string,
  options: { includeThinking?: boolean } = {}
): Promise<TranscriptMessage[]> {
  // Use the standard parseTranscript for basic message extraction
  const messages = await parseTranscript(filePath, options);

  // The standard parseTranscript already handles content blocks
  // We just need to ensure we have the messages
  return messages;
}

/**
 * Extract file operations from transcript messages
 *
 * Uses native Rust regex extraction for high performance.
 * Looks for patterns in message content that indicate file operations:
 * - Read tool: "Reading file_path"
 * - Write tool: "Writing to file_path"
 * - Edit tool: "Editing file_path"
 * - Bash commands: git, npm, etc.
 */
function extractFileOperations(messages: TranscriptMessage[]): FileOperation[] {
  const native = getNativeModule();
  const operations: FileOperation[] = [];

  for (const message of messages) {
    if (message.type !== 'assistant') continue;

    // Use native regex extraction for performance
    const result = native.extractFileOperations(message.content);

    for (const op of result.operations) {
      operations.push({
        path: op.path,
        operation: op.operation as FileOperation['operation'],
        timestamp: message.timestamp,
      });
    }
  }

  return operations;
}

/**
 * Extract work items from file operations
 */
function extractWorkItems(
  fileOps: FileOperation[],
  messages: TranscriptMessage[],
  options: TranscriptSummaryOptions
): WorkItem[] {
  const fileGroups = new Map<string, string[]>();

  // Group files by common prefix/directory
  const modifiedFiles = fileOps
    .filter((op) => op.operation !== 'read')
    .map((op) => op.path);

  for (const file of modifiedFiles) {
    const key = getFileGroupKey(file);
    if (!fileGroups.has(key)) {
      fileGroups.set(key, []);
    }
    const group = fileGroups.get(key);
    if (group && !group.includes(file)) {
      group.push(file);
    }
  }

  // Create work items for each group
  const workItems: WorkItem[] = [];
  const maxItems = options.maxWorkItems ?? 20;

  // Sort groups by file count for deterministic ordering
  const sortedGroups = Array.from(fileGroups.entries()).sort((a, b) => {
    // First by file count descending
    if (b[1].length !== a[1].length) return b[1].length - a[1].length;
    // Then by key alphabetically
    return a[0].localeCompare(b[0]);
  });

  for (const [key, files] of sortedGroups) {
    if (workItems.length >= maxItems) break;

    const description = generateWorkDescription(key, files);
    const outcome = determineOutcome(files, fileOps, messages);

    workItems.push({
      description,
      files,
      outcome,
    });
  }

  return workItems;
}

/**
 * Get a grouping key for a file based on directory and component name
 */
function getFileGroupKey(file: string): string {
  const parts = file.split('/');
  const fileName = parts[parts.length - 1];
  const baseName = fileName.split('.')[0];

  // If in test directory, group by test subject
  if (
    file.includes('/test/') ||
    fileName.includes('.test.') ||
    fileName.includes('.spec.')
  ) {
    return baseName.replace(/\.(test|spec)$/, '');
  }

  // Group by directory + base name for related files
  const directory = parts.length > 1 ? parts[parts.length - 2] : '';
  return directory ? `${directory}/${baseName}` : baseName;
}

/**
 * Generate work description from file group
 */
function generateWorkDescription(key: string, files: string[]): string {
  const hasTests = files.some(
    (f) => f.includes('/test/') || f.includes('.test.') || f.includes('.spec.')
  );
  const hasSource = files.some(
    (f) => !f.includes('/test/') && !f.includes('.test.')
  );

  const componentName = key.split('/').pop() || key;

  if (hasTests && hasSource) {
    return `Implemented ${componentName} with tests`;
  }
  if (hasTests) {
    return `Added tests for ${componentName}`;
  }

  // Infer action from file path patterns
  if (files.some((f) => f.includes('auth'))) {
    return `Updated authentication: ${componentName}`;
  }
  if (files.some((f) => f.includes('payment'))) {
    return `Updated payments: ${componentName}`;
  }
  if (files.some((f) => f.includes('component'))) {
    return `Updated component: ${componentName}`;
  }

  return `Updated ${componentName}`;
}

/**
 * Determine outcome based on message content after modifications
 */
function determineOutcome(
  files: string[],
  fileOps: FileOperation[],
  messages: TranscriptMessage[]
): WorkItem['outcome'] {
  // Find last modification timestamp for these files
  const relevantOps = fileOps.filter((op) => files.includes(op.path));
  if (relevantOps.length === 0) return 'completed';

  const lastModTime = Math.max(
    ...relevantOps.map((op) => new Date(op.timestamp).getTime())
  );

  // Check messages after last modification for errors
  const afterMods = messages.filter(
    (m) => new Date(m.timestamp).getTime() > lastModTime
  );

  const hasErrors = afterMods.some((m) => {
    const lower = m.content.toLowerCase();
    return (
      lower.includes('error') ||
      lower.includes('failed') ||
      lower.includes('fail:') ||
      lower.includes('exception')
    );
  });

  if (hasErrors) {
    return 'partial';
  }

  const hasSuccess = afterMods.some((m) => {
    const lower = m.content.toLowerCase();
    return (
      lower.includes('pass') ||
      lower.includes('success') ||
      lower.includes('completed') ||
      lower.includes('all tests')
    );
  });

  return hasSuccess ? 'completed' : 'completed';
}

/**
 * Extract in-progress work from reads without edits
 */
function extractInProgress(
  fileOps: FileOperation[],
  workItems: WorkItem[]
): string[] {
  const inProgress: Set<string> = new Set();
  const modifiedFiles = new Set(workItems.flatMap((item) => item.files));

  // Find files that were only read, not modified
  const readOnlyFiles = fileOps
    .filter((op) => op.operation === 'read' && !modifiedFiles.has(op.path))
    .map((op) => op.path);

  // Group by area
  const areaFiles = new Map<string, string[]>();
  for (const file of readOnlyFiles) {
    const area = extractAreaFromPath(file);
    if (!areaFiles.has(area)) {
      areaFiles.set(area, []);
    }
    areaFiles.get(area)?.push(file);
  }

  // Add investigating items for areas with multiple reads
  for (const [area, files] of areaFiles.entries()) {
    if (files.length >= 2) {
      inProgress.add(`Investigating ${area}`);
    }
  }

  return Array.from(inProgress);
}

/**
 * Extract area/topic from file path
 */
function extractAreaFromPath(pathOrDesc: string): string {
  const lower = pathOrDesc.toLowerCase();

  if (lower.includes('auth')) return 'authentication';
  if (lower.includes('payment')) return 'payments';
  if (lower.includes('user')) return 'user management';
  if (lower.includes('api')) return 'API';
  if (lower.includes('component')) return 'components';
  if (lower.includes('test')) return 'testing';
  if (lower.includes('doc')) return 'documentation';
  if (lower.includes('memory')) return 'memory system';
  if (lower.includes('config')) return 'configuration';

  const parts = pathOrDesc.split('/');
  if (parts.length > 1) {
    return parts[parts.length - 2];
  }

  return 'code';
}

/**
 * Extract decisions from conversation patterns
 *
 * Looks for:
 * - User questions followed by assistant implementations
 * - Discussion of alternatives
 * - Explicit decision language
 */
function extractDecisions(messages: TranscriptMessage[]): Decision[] {
  const decisions: Decision[] = [];

  for (let i = 0; i < messages.length - 1; i++) {
    const current = messages[i];
    const next = messages[i + 1];

    // Pattern: User asks about approach, assistant responds with decision
    if (current.type === 'user' && next.type === 'assistant') {
      const userLower = current.content.toLowerCase();
      const assistantLower = next.content.toLowerCase();

      // Look for decision patterns
      if (
        (userLower.includes('should') ||
          userLower.includes('which') ||
          userLower.includes('how')) &&
        (assistantLower.includes('recommend') ||
          assistantLower.includes('approach') ||
          assistantLower.includes('use'))
      ) {
        const topic = extractTopicFromQuestion(current.content);
        if (topic) {
          const rationale = extractRationale(next.content);
          decisions.push({
            description: `Chose ${topic} approach`,
            rationale,
          });
        }
      }
    }
  }

  // Limit to most significant decisions
  return decisions.slice(0, 5);
}

/**
 * Extract topic from user question
 */
function extractTopicFromQuestion(question: string): string | null {
  const lower = question.toLowerCase();

  // Extract key technical terms
  if (lower.includes('jwt')) return 'JWT';
  if (lower.includes('session')) return 'session-based auth';
  if (lower.includes('oauth')) return 'OAuth';
  if (lower.includes('graphql')) return 'GraphQL';
  if (lower.includes('rest')) return 'REST API';
  if (lower.includes('websocket')) return 'WebSocket';
  if (lower.includes('redux')) return 'Redux';
  if (lower.includes('context')) return 'React Context';
  if (lower.includes('typescript')) return 'TypeScript';
  if (lower.includes('testing')) return 'testing strategy';
  if (lower.includes('database')) return 'database';
  if (lower.includes('cache')) return 'caching';

  return null;
}

/**
 * Extract rationale from assistant response
 */
function extractRationale(response: string): string {
  // Look for sentences with reasoning
  const sentences = response.split(/[.!?]+/);

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (
      lower.includes('because') ||
      lower.includes('since') ||
      lower.includes('this approach') ||
      lower.includes('recommend')
    ) {
      return sentence.trim().slice(0, 200);
    }
  }

  // Fallback to first substantive sentence
  for (const sentence of sentences) {
    if (sentence.trim().length > 20) {
      return sentence.trim().slice(0, 200);
    }
  }

  return 'Based on project requirements';
}

/**
 * Generate summary text from messages and work items
 */
function generateSummaryText(
  messages: TranscriptMessage[],
  workItems: WorkItem[]
): string {
  if (workItems.length === 0) {
    // Look at user messages to understand what was discussed
    const userMessages = messages.filter((m) => m.type === 'user');
    if (userMessages.length > 0) {
      const firstUser = userMessages[0].content.toLowerCase();
      if (firstUser.includes('help') || firstUser.includes('explain')) {
        return 'Discussed code and provided explanations';
      }
      if (firstUser.includes('review') || firstUser.includes('look at')) {
        return 'Reviewed and explored codebase';
      }
    }
    return 'Explored codebase';
  }

  // Extract key topics from all work
  const allText = workItems
    .map((item) => `${item.description} ${item.files.join(' ')}`)
    .join(' ')
    .toLowerCase();

  const topics: string[] = [];

  if (allText.includes('register') || allText.includes('registration')) {
    topics.push('user registration');
  }
  if (allText.includes('login') || allText.includes('auth')) {
    topics.push('authentication');
  }
  if (allText.includes('payment')) {
    topics.push('payments');
  }
  if (allText.includes('validation')) {
    topics.push('validation');
  }
  if (allText.includes('component')) {
    topics.push('UI components');
  }
  if (allText.includes('test')) {
    topics.push('testing');
  }
  if (allText.includes('memory')) {
    topics.push('memory system');
  }
  if (allText.includes('api')) {
    topics.push('API');
  }

  if (topics.length > 0) {
    return `Worked on ${topics.slice(0, 3).join(', ')}`;
  }

  // Fallback to area-based summary
  const areas = new Set<string>();
  for (const item of workItems) {
    const area = extractAreaFromWorkItem(item);
    areas.add(area);
  }

  if (areas.size === 1) {
    return `Worked on ${Array.from(areas)[0]}`;
  }

  return `Worked on ${Array.from(areas).slice(0, 3).join(', ')}`;
}

/**
 * Extract area from work item
 */
function extractAreaFromWorkItem(item: WorkItem): string {
  const desc = item.description.toLowerCase();

  if (desc.includes('auth')) return 'authentication';
  if (desc.includes('payment')) return 'payments';
  if (desc.includes('user')) return 'user management';
  if (desc.includes('component')) return 'UI components';
  if (desc.includes('test')) return 'testing';
  if (desc.includes('api')) return 'API';
  if (desc.includes('memory')) return 'memory system';

  const match = desc.match(/(?:updated|implemented)\s+(\w+)/);
  if (match) return match[1];

  return 'features';
}

/**
 * Get project name from messages or git remote
 */
function getProjectName(messages: TranscriptMessage[]): string | null {
  // Try to get from message cwd
  const messageWithCwd = messages.find((m) => m.cwd);
  if (messageWithCwd?.cwd) {
    const remote = getGitRemote(messageWithCwd.cwd);
    if (remote) {
      return extractProjectNameFromRemote(remote);
    }

    // Fallback to directory name
    const parts = messageWithCwd.cwd.split('/');
    return parts[parts.length - 1] || null;
  }

  // Try current directory
  const remote = getGitRemote();
  if (remote) {
    return extractProjectNameFromRemote(remote);
  }

  return null;
}

/**
 * Extract project name from git remote URL
 */
function extractProjectNameFromRemote(gitRemote: string): string {
  const match = gitRemote.match(/[/:]([\w-]+)(\.git)?$/);
  if (match) {
    return match[1];
  }
  return 'unknown';
}
