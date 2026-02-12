#!/usr/bin/env bun

/**
 * Han Bridge for Gemini CLI
 *
 * Entry point invoked by Gemini CLI hooks via hooks.json.
 * Each hook event calls this script with the event name as the first argument.
 * Gemini CLI passes context via stdin JSON and expects stdout JSON responses.
 *
 * Architecture:
 *
 *   AfterTool (write_file/edit_file)
 *     -> discovery.ts finds installed plugins' PostToolUse hooks
 *     -> matcher.ts filters by tool name + file pattern
 *     -> executor.ts runs matching hook commands as parallel promises
 *     -> formatter.ts structures results into Gemini CLI JSON response
 *     -> stdout JSON with systemMessage for validation errors
 *
 *   AfterAgent (agent finished)
 *     -> discovery.ts finds installed plugins' Stop hooks
 *     -> executor.ts runs matching hooks
 *     -> formatter.ts structures results
 *     -> stdout JSON with decision:"block" if failures (forces continuation)
 *
 *   SessionStart
 *     -> discovery.ts counts plugins, hooks, skills, disciplines
 *     -> stdout JSON with systemMessage summarizing capabilities
 *
 *   BeforeAgent
 *     -> Inject current datetime as additionalContext
 *     -> stdout JSON with hookSpecificOutput
 *
 *   BeforeTool
 *     -> Run PreToolUse hooks
 *     -> stdout JSON with decision:"deny" if hook rejects
 *
 * Key difference from OpenCode bridge: Gemini CLI uses shell command hooks
 * with stdin/stdout JSON protocol, not a JS plugin API. Each hook invocation
 * is a separate process that discovers, executes, and formats independently.
 *
 * IMPORTANT: Only valid JSON goes to stdout. All logging goes to stderr.
 */

import { invalidateFile } from './cache';
import { buildPromptContext, buildSessionContext } from './context';
import { discoverDisciplines } from './disciplines';
import {
  discoverHooks,
  getHooksByEvent,
  resolvePluginPaths,
} from './discovery';
import { BridgeEventLogger } from './events';
import { executeHooksParallel } from './executor';
import {
  formatAfterAgentResults,
  formatAfterToolResults,
  formatBeforeToolResults,
} from './formatter';
import { matchPostToolUseHooks, matchStopHooks } from './matcher';
import { discoverAllSkills } from './skills';
import type { GeminiHookInput, GeminiHookOutput } from './types';
import { mapToolName } from './types';

const PREFIX = '[han]';

/**
 * Read stdin as JSON. Gemini CLI passes hook context via stdin.
 */
async function readStdin(): Promise<GeminiHookInput> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }

  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw) as GeminiHookInput;
  } catch {
    console.error(`${PREFIX} Failed to parse stdin JSON`);
    return {};
  }
}

/**
 * Write JSON to stdout. This is the ONLY output Gemini CLI reads.
 */
function writeOutput(output: GeminiHookOutput): void {
  process.stdout.write(JSON.stringify(output));
}

/**
 * Extract file path(s) from Gemini CLI tool input.
 * Gemini CLI tools use field names like "path", "file_path", "target".
 */
function extractFilePaths(input: GeminiHookInput): string[] {
  const paths: string[] = [];
  const toolInput = input.tool_input;

  if (!toolInput) return paths;

  // Check common field names for file paths
  for (const key of [
    'path',
    'file_path',
    'filePath',
    'target',
    'destination',
  ]) {
    if (typeof toolInput[key] === 'string') {
      paths.push(toolInput[key] as string);
    }
  }

  return paths;
}

/**
 * Start the Han coordinator daemon in the background.
 */
function startCoordinator(watchDir: string): void {
  try {
    const { spawn } =
      require('node:child_process') as typeof import('node:child_process');

    const child = spawn(
      'han',
      ['coordinator', 'ensure', '--background', '--watch-path', watchDir],
      {
        stdio: 'ignore',
        detached: true,
        env: {
          ...process.env,
          HAN_PROVIDER: 'gemini-cli',
        },
      }
    );

    child.unref();
    console.error(`${PREFIX} Coordinator ensure started (watch: ${watchDir})`);
  } catch {
    console.error(
      `${PREFIX} Could not start coordinator (han CLI not found). ` +
        `Browse UI won't show Gemini CLI sessions.`
    );
  }
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

/**
 * SessionStart: Discover plugins, report capabilities, start coordinator.
 */
async function handleSessionStart(
  _input: GeminiHookInput,
  projectDir: string
): Promise<GeminiHookOutput> {
  const resolvedPlugins = resolvePluginPaths(projectDir);
  const allHooks = discoverHooks(projectDir);
  const allSkills = discoverAllSkills(resolvedPlugins);
  const allDisciplines = discoverDisciplines(resolvedPlugins, allSkills);

  const pluginCount = resolvedPlugins.size;
  const hookCount = allHooks.length;
  const skillCount = allSkills.length;
  const disciplineCount = allDisciplines.length;

  if (pluginCount === 0) {
    console.error(
      `${PREFIX} No Han plugins found. Install plugins: han plugin install --auto`
    );
    return {};
  }

  console.error(
    `${PREFIX} Discovered ${pluginCount} plugins: ${hookCount} hooks, ` +
      `${skillCount} skills, ${disciplineCount} disciplines`
  );

  // Start coordinator for Browse UI visibility
  const sessionId = process.env.GEMINI_SESSION_ID ?? crypto.randomUUID();
  const eventLogger = new BridgeEventLogger(sessionId, projectDir);
  startCoordinator(eventLogger.getWatchDir());

  return {
    systemMessage: buildSessionContext(
      pluginCount,
      hookCount,
      skillCount,
      disciplineCount
    ),
  };
}

/**
 * BeforeAgent: Inject current datetime context.
 */
async function handleBeforeAgent(
  _input: GeminiHookInput,
  _projectDir: string
): Promise<GeminiHookOutput> {
  return {
    hookSpecificOutput: {
      hookEventName: 'BeforeAgent',
      additionalContext: buildPromptContext(),
    },
  };
}

/**
 * BeforeTool: Run PreToolUse hooks.
 */
async function handleBeforeTool(
  input: GeminiHookInput,
  projectDir: string
): Promise<GeminiHookOutput> {
  const allHooks = discoverHooks(projectDir);
  const preToolUseHooks = getHooksByEvent(allHooks, 'PreToolUse');

  if (preToolUseHooks.length === 0) return {};

  const toolName = input.tool_name ?? '';
  const claudeToolName = mapToolName(toolName);

  // Filter by tool name
  const matching = preToolUseHooks.filter((h) => {
    if (!h.toolFilter) return true;
    return h.toolFilter.includes(claudeToolName);
  });

  if (matching.length === 0) return {};

  const sessionId = process.env.GEMINI_SESSION_ID ?? crypto.randomUUID();
  const eventLogger = new BridgeEventLogger(sessionId, projectDir);

  const results = await executeHooksParallel(matching, [], {
    cwd: projectDir,
    sessionId,
    eventLogger,
    hookType: 'PreToolUse',
  });

  eventLogger.flush();

  const output = formatBeforeToolResults(results);
  return output ?? {};
}

/**
 * AfterTool: Run PostToolUse hooks (primary validation path).
 */
async function handleAfterTool(
  input: GeminiHookInput,
  projectDir: string
): Promise<GeminiHookOutput> {
  const allHooks = discoverHooks(projectDir);
  const postToolUseHooks = getHooksByEvent(allHooks, 'PostToolUse');

  if (postToolUseHooks.length === 0) return {};

  const toolName = input.tool_name ?? '';
  const claudeToolName = mapToolName(toolName);
  const filePaths = extractFilePaths(input);

  if (filePaths.length === 0) return {};

  // Invalidate cache for edited files
  for (const fp of filePaths) {
    invalidateFile(fp);
  }

  // Match hooks against tool name + file
  const matching = matchPostToolUseHooks(
    postToolUseHooks,
    claudeToolName,
    filePaths[0],
    projectDir
  );

  if (matching.length === 0) return {};

  const sessionId = process.env.GEMINI_SESSION_ID ?? crypto.randomUUID();
  const eventLogger = new BridgeEventLogger(sessionId, projectDir);

  // Log file changes
  for (const fp of filePaths) {
    eventLogger.logFileChange(claudeToolName, fp);
  }

  const results = await executeHooksParallel(matching, filePaths, {
    cwd: projectDir,
    sessionId,
    eventLogger,
    hookType: 'PostToolUse',
  });

  eventLogger.flush();

  const output = formatAfterToolResults(results);
  return output ?? {};
}

/**
 * AfterAgent: Run Stop hooks (full project validation).
 * Returns decision:"block" if validation fails, forcing the agent to fix issues.
 */
async function handleAfterAgent(
  _input: GeminiHookInput,
  projectDir: string
): Promise<GeminiHookOutput> {
  const allHooks = discoverHooks(projectDir);
  const stopHooks = getHooksByEvent(allHooks, 'Stop');

  if (stopHooks.length === 0) return {};

  const matching = matchStopHooks(stopHooks, projectDir);
  if (matching.length === 0) return {};

  const sessionId = process.env.GEMINI_SESSION_ID ?? crypto.randomUUID();
  const eventLogger = new BridgeEventLogger(sessionId, projectDir);

  const results = await executeHooksParallel(matching, [], {
    cwd: projectDir,
    sessionId,
    timeout: 120_000,
    eventLogger,
    hookType: 'Stop',
  });

  eventLogger.flush();

  const output = formatAfterAgentResults(results);
  return output ?? {};
}

/**
 * PreCompress: Flush event log before context compression.
 */
async function handlePreCompress(
  _input: GeminiHookInput,
  _projectDir: string
): Promise<GeminiHookOutput> {
  // Nothing to do - events are flushed after each hook execution
  return {};
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const eventType = process.argv[2];

  if (!eventType) {
    console.error(`${PREFIX} Usage: bridge.ts <EventType>`);
    console.error(
      `${PREFIX} Events: SessionStart, BeforeAgent, BeforeTool, AfterTool, AfterAgent, PreCompress`
    );
    writeOutput({});
    process.exit(0);
  }

  // Determine project directory
  const projectDir =
    process.env.GEMINI_PROJECT_DIR ??
    process.env.GEMINI_CWD ??
    process.env.CLAUDE_PROJECT_DIR ??
    process.cwd();

  // Set provider environment
  process.env.HAN_PROVIDER = 'gemini-cli';

  // Read stdin JSON from Gemini CLI
  const input = await readStdin();

  console.error(
    `${PREFIX} Event: ${eventType}, tool: ${input.tool_name ?? '(none)'}`
  );

  try {
    let output: GeminiHookOutput;

    switch (eventType) {
      case 'SessionStart':
        output = await handleSessionStart(input, projectDir);
        break;
      case 'BeforeAgent':
        output = await handleBeforeAgent(input, projectDir);
        break;
      case 'BeforeTool':
        output = await handleBeforeTool(input, projectDir);
        break;
      case 'AfterTool':
        output = await handleAfterTool(input, projectDir);
        break;
      case 'AfterAgent':
        output = await handleAfterAgent(input, projectDir);
        break;
      case 'PreCompress':
        output = await handlePreCompress(input, projectDir);
        break;
      default:
        console.error(`${PREFIX} Unknown event: ${eventType}`);
        output = {};
    }

    writeOutput(output);
  } catch (err) {
    console.error(
      `${PREFIX} Error handling ${eventType}:`,
      err instanceof Error ? err.message : err
    );
    // Always output valid JSON, even on error
    writeOutput({});
  }
}

main();
