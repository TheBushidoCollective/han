import { readFileSync } from 'node:fs';
import type { Command } from 'commander';
import { isDebugMode } from '../../shared.ts';

/**
 * PreToolUse hook payload structure from Claude Code
 */
interface PreToolUsePayload {
  session_id?: string;
  tool_name?: string;
  tool_input?: {
    prompt?: string;
    description?: string;
    subagent_type?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * PreToolUse hook output with updatedInput
 */
interface PreToolUseOutput {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse';
    updatedInput: Record<string, unknown>;
  };
}

/**
 * Read and parse stdin payload
 */
function readStdinPayload(): PreToolUsePayload | null {
  try {
    if (process.stdin.isTTY) {
      return null;
    }
    const stdin = readFileSync(0, 'utf-8');
    if (stdin.trim()) {
      return JSON.parse(stdin) as PreToolUsePayload;
    }
  } catch {
    // stdin not available or invalid JSON
  }
  return null;
}

/**
 * Inject subagent context into Task and Skill tool prompts.
 *
 * This is a PreToolUse hook that intercepts Task and Skill tool calls and prepends
 * context from wrap-subagent-context to the prompt/arguments parameter.
 *
 * The output uses `updatedInput` to modify the tool parameters without
 * blocking the tool execution (no permissionDecision is set).
 */
async function injectSubagentContext(): Promise<void> {
  const payload = readStdinPayload();

  if (!payload) {
    if (isDebugMode()) {
      console.error('[inject-subagent-context] No stdin payload, exiting');
    }
    process.exit(0);
  }

  // Process Task and Skill tool calls
  const toolName = payload.tool_name;
  if (toolName !== 'Task' && toolName !== 'Skill') {
    if (isDebugMode()) {
      console.error(
        `[inject-subagent-context] Not a Task or Skill tool (got: ${toolName}), exiting`
      );
    }
    process.exit(0);
  }

  const toolInput = payload.tool_input;

  // For Task tool, check prompt; for Skill tool, check arguments
  const targetField = toolName === 'Task' ? 'prompt' : 'arguments';
  const originalValue = (toolInput?.[targetField] as string) || '';

  // Skip if no value to inject into
  if (!originalValue && toolName === 'Task') {
    if (isDebugMode()) {
      console.error(
        `[inject-subagent-context] No ${targetField} in tool_input, exiting`
      );
    }
    process.exit(0);
  }

  // No context to inject (orchestrate removed) - pass through
  if (isDebugMode()) {
    console.error(
      '[inject-subagent-context] No context source available, exiting without modification'
    );
  }
  process.exit(0);
}

/**
 * Register the inject-subagent-context command
 */
export function registerInjectSubagentContext(hookCommand: Command): void {
  hookCommand
    .command('inject-subagent-context')
    .description(
      'PreToolUse hook that injects context into Task and Skill tool prompts.\n\n' +
        'Currently a no-op placeholder. Context injection via orchestrate has been removed.'
    )
    .action(async () => {
      await injectSubagentContext();
    });
}
