import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import type { Command } from 'commander';
import { isHooksEnabled } from '../../config/han-settings.ts';
import { isDebugMode } from '../../shared.ts';

/**
 * PreToolUse hook payload structure from Claude Code
 */
interface PreToolUsePayload {
  session_id?: string;
  tool_name?: string;
  tool_input?: {
    prompt?: string;
    args?: string;
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
 * Execute a command and return its output
 */
function executeContextCommand(command: string): string {
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000, // 30 second timeout
      env: process.env,
    });
    return output.trim();
  } catch (error) {
    if (isDebugMode()) {
      console.error(
        `[wrap-subagent-context] Error executing context command: ${error}`
      );
    }
    return '';
  }
}

/**
 * Read context from a file
 */
function readContextFile(filePath: string): string {
  try {
    if (existsSync(filePath)) {
      return readFileSync(filePath, 'utf-8').trim();
    }
  } catch (error) {
    if (isDebugMode()) {
      console.error(
        `[wrap-subagent-context] Error reading context file: ${error}`
      );
    }
  }
  return '';
}

/**
 * Wrap context and inject into Task/Skill tool prompts.
 *
 * This is a PreToolUse hook helper that:
 * 1. Reads the hook payload from stdin
 * 2. Generates context from a command or file
 * 3. Wraps context in <subagent-context> tags
 * 4. Outputs proper JSON with updatedInput
 *
 * Usage in .claude-plugin/hooks.json:
 * {
 *   "matcher": "Task|Skill",
 *   "hooks": [{
 *     "type": "command",
 *     "command": "han hook wrap-subagent-context --context-command 'bash ${CLAUDE_PLUGIN_ROOT}/hooks/my-context.sh'"
 *   }]
 * }
 */
async function wrapSubagentContext(options: {
  contextCommand?: string;
  contextFile?: string;
  tag?: string;
}): Promise<void> {
  const payload = readStdinPayload();

  if (!payload) {
    if (isDebugMode()) {
      console.error('[wrap-subagent-context] No stdin payload, exiting');
    }
    process.exit(0);
  }

  // Process Task and Skill tool calls
  const toolName = payload.tool_name;
  if (toolName !== 'Task' && toolName !== 'Skill') {
    if (isDebugMode()) {
      console.error(
        `[wrap-subagent-context] Not a Task or Skill tool (got: ${toolName}), exiting`
      );
    }
    process.exit(0);
  }

  const toolInput = payload.tool_input;

  // For Task tool, check prompt; for Skill tool, check args
  const targetField = toolName === 'Task' ? 'prompt' : 'args';
  const originalValue = (toolInput?.[targetField] as string) || '';

  // Skip if no value to inject into (for Task)
  if (!originalValue && toolName === 'Task') {
    if (isDebugMode()) {
      console.error(
        `[wrap-subagent-context] No ${targetField} in tool_input, exiting`
      );
    }
    process.exit(0);
  }

  // Use custom tag or default
  const tag = options.tag || 'subagent-context';

  // Skip if already has our injected context
  if (originalValue.includes(`<${tag}>\n`)) {
    if (isDebugMode()) {
      console.error(
        '[wrap-subagent-context] Already has context injected, exiting'
      );
    }
    process.exit(0);
  }

  // Gather context from command or file
  let contextOutput = '';

  if (options.contextCommand) {
    contextOutput = executeContextCommand(options.contextCommand);
  } else if (options.contextFile) {
    contextOutput = readContextFile(options.contextFile);
  }

  if (!contextOutput) {
    if (isDebugMode()) {
      console.error(
        '[wrap-subagent-context] No context gathered, exiting without modification'
      );
    }
    process.exit(0);
  }

  // Wrap gathered context in tags and prepend to value
  const wrappedContext = `<${tag}>\n${contextOutput}\n</${tag}>\n\n`;
  const modifiedValue = wrappedContext + originalValue;

  // Build updated input with modified field
  const updatedInput: Record<string, unknown> = { ...toolInput };
  updatedInput[targetField] = modifiedValue;

  // Output JSON with updatedInput
  // IMPORTANT: Do NOT set permissionDecision - it breaks updatedInput for Task tool
  const output: PreToolUseOutput = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      updatedInput,
    },
  };

  console.log(JSON.stringify(output));

  if (isDebugMode()) {
    console.error(
      `[wrap-subagent-context] Injected ${contextOutput.length} bytes of context into ${toolName}.${targetField}`
    );
  }

  process.exit(0);
}

/**
 * Register the wrap-subagent-context command
 */
export function registerWrapSubagentContext(hookCommand: Command): void {
  hookCommand
    .command('wrap-subagent-context')
    .description(
      'PreToolUse hook helper that injects context into Task and Skill tool prompts.\n\n' +
        'Reads hook payload from stdin, generates context from a command or file,\n' +
        'wraps it in XML tags, and outputs proper JSON with updatedInput.\n\n' +
        'Example usage in hooks.json:\n' +
        // biome-ignore lint/suspicious/noTemplateCurlyInString: This is a shell variable placeholder, not a JS template literal
        '  han hook wrap-subagent-context --context-command \'bash "${CLAUDE_PLUGIN_ROOT}/hooks/context.sh"\''
    )
    .option(
      '--context-command <command>',
      'Shell command to execute for generating context'
    )
    .option('--context-file <path>', 'File path to read context from')
    .option(
      '--tag <name>',
      'XML tag name to wrap context (default: subagent-context)'
    )
    .action(async (options) => {
      if (!isHooksEnabled()) {
        process.exit(0);
      }
      await wrapSubagentContext(options);
    });
}
