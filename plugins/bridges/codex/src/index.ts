#!/usr/bin/env bun
/**
 * Han Bridge for Codex CLI
 *
 * CLI entry point called by Codex's hook system (Claude-Code-style
 * lifecycle hooks, enabled with [features] hooks = true in
 * ~/.codex/config.toml). Each Codex hook event dispatches to a handler
 * that discovers, matches, and executes Han validation hooks.
 *
 * Unlike the OpenCode bridge (in-process JS plugin), this is a shell
 * command that Codex invokes. It reads JSON from stdin, runs Han hooks,
 * and outputs a JSON decision to stdout.
 *
 * Usage (from ~/.codex/hooks.json):
 *   "command": "npx -y codex-plugin-han <event>"
 *
 * Events:
 *   session-start      -> SessionStart (additionalContext + coordinator)
 *   user-prompt-submit -> UserPromptSubmit (datetime context)
 *   pre-tool-use       -> PreToolUse (hookSpecificOutput permissionDecision)
 *   permission-request -> PermissionRequest (hookSpecificOutput decision)
 *   post-tool-use      -> PostToolUse (decision block = tool feedback)
 *   pre-compact        -> PreCompact (no-op, keeps protocol happy)
 *   post-compact       -> PostCompact (no-op)
 *   subagent-start     -> SubagentStart (no-op)
 *   subagent-stop      -> SubagentStop (Stop hooks, decision block)
 *   stop               -> Stop (decision block forces continuation)
 *
 * Architecture:
 *
 *   Codex fires hook event
 *     -> stdin JSON payload { hook_event_name, cwd, tool_name, tool_input }
 *     -> bridge reads payload, maps Codex tool names to Claude Code names
 *     -> discovery.ts finds installed plugins' hooks
 *     -> matcher.ts filters by tool name + file pattern
 *     -> executor.ts runs matching hook commands as parallel promises
 *     -> formatter.ts structures results into Codex JSON decisions
 *     -> stdout JSON (only valid JSON goes to stdout; logs go to stderr)
 */

import { isAbsolute, resolve } from 'node:path';
import { invalidateFile } from './cache';
import { buildPromptContext, buildSessionContext } from './context';
import { buildDisciplineContext, discoverDisciplines } from './disciplines';
import {
  discoverHooks,
  getHooksByEvent,
  resolvePluginPaths,
} from './discovery';
import { BridgeEventLogger } from './events';
import { executeHooksParallel } from './executor';
import {
  formatPermissionRequestResults,
  formatPostToolUseResults,
  formatPreToolUseResults,
  formatStopResults,
} from './formatter';
import { matchPostToolUseHooks, matchStopHooks } from './matcher';
import { discoverAllSkills } from './skills';
import {
  type CodexHookOutput,
  type CodexHookPayload,
  mapToolName,
} from './types';

const PREFIX = '[han]';

/**
 * Read JSON payload from stdin.
 * Codex passes hook context as JSON via stdin.
 */
async function readStdin(): Promise<CodexHookPayload> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }

  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw) as CodexHookPayload;
  } catch {
    console.error(`${PREFIX} Failed to parse stdin JSON`);
    return {};
  }
}

/**
 * Write JSON to stdout. This is the ONLY output Codex reads.
 */
function writeOutput(output: CodexHookOutput): void {
  process.stdout.write(JSON.stringify(output));
}

/**
 * Extract file path(s) from a Codex tool payload.
 *
 * Edit/Write aliases carry file_path in tool_input. apply_patch carries
 * a patch document, so file paths are pulled from its file headers.
 */
function extractFilePaths(payload: CodexHookPayload): string[] {
  const paths: string[] = [];
  const cwd = payload.cwd || process.cwd();
  const input = payload.tool_input;

  if (input) {
    if (typeof input.file_path === 'string') paths.push(input.file_path);
    if (typeof input.filePath === 'string') paths.push(input.filePath);
    if (typeof input.path === 'string') paths.push(input.path);

    // apply_patch: parse "*** Update File: <path>" style headers
    for (const key of ['patch', 'input']) {
      const text = input[key];
      if (typeof text !== 'string') continue;
      for (const match of text.matchAll(/^\*\*\* \w+ File: (.+)$/gm)) {
        paths.push(match[1].trim());
      }
    }
  }

  if (
    payload.tool_response &&
    typeof payload.tool_response === 'object' &&
    !Array.isArray(payload.tool_response)
  ) {
    const resp = payload.tool_response as Record<string, unknown>;
    if (typeof resp.file_path === 'string' && !paths.includes(resp.file_path)) {
      paths.push(resp.file_path);
    }
  }

  // Normalize and validate paths - reject traversal attempts
  return paths
    .map((p) => (isAbsolute(p) ? resolve(p) : resolve(cwd, p)))
    .filter((p) => {
      if (!p.startsWith(cwd)) {
        console.error(`${PREFIX} Rejected path outside project: ${p}`);
        return false;
      }
      return true;
    });
}

/**
 * Start the Han coordinator daemon in the background.
 * The coordinator indexes JSONL event files and serves the Browse UI.
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
          HAN_PROVIDER: 'codex',
          HAN_SESSION_ID: process.env.HAN_SESSION_ID ?? '',
        },
      }
    );

    child.unref();
    console.error(`${PREFIX} Coordinator ensure started (watch: ${watchDir})`);
  } catch {
    console.error(
      `${PREFIX} Could not start coordinator (han CLI not found). ` +
        `Browse UI won't show Codex sessions.`
    );
  }
}

/**
 * Run PreToolUse hooks matching the payload's tool.
 * Shared by the pre-tool-use and permission-request handlers.
 */
async function runPreToolHooks(
  payload: CodexHookPayload,
  directory: string,
  sessionId: string
) {
  const allHooks = discoverHooks(directory);
  const preToolUseHooks = getHooksByEvent(allHooks, 'PreToolUse');

  if (preToolUseHooks.length === 0) return null;

  const claudeToolName = mapToolName(payload.tool_name ?? '');

  const matching = preToolUseHooks.filter((h) => {
    if (!h.toolFilter) return true;
    return h.toolFilter.includes(claudeToolName);
  });

  if (matching.length === 0) return null;

  const eventLogger = new BridgeEventLogger(sessionId, directory);

  const results = await executeHooksParallel(matching, [], {
    cwd: directory,
    sessionId,
    eventLogger,
    hookType: 'PreToolUse',
  });

  eventLogger.flush();

  return results;
}

// ─── Event Handlers ─────────────────────────────────────────────────────────

/**
 * SessionStart: inject Han context and start the coordinator.
 */
async function handleSessionStart(
  _payload: CodexHookPayload,
  directory: string,
  sessionId: string
): Promise<CodexHookOutput> {
  const resolvedPlugins = resolvePluginPaths(directory);
  const allSkills = discoverAllSkills(resolvedPlugins);
  const allDisciplines = discoverDisciplines(resolvedPlugins, allSkills);

  if (resolvedPlugins.size === 0) {
    console.error(
      `${PREFIX} No Han plugins found. Install plugins: han plugin install --auto`
    );
    return {};
  }

  const parts = [buildSessionContext(allSkills.length, allDisciplines.length)];

  // Active discipline via HAN_DISCIPLINE env (set in shell or Codex config)
  const activeName = process.env.HAN_DISCIPLINE;
  if (activeName) {
    const active = allDisciplines.find((d) => d.name === activeName);
    if (active) {
      parts.push(buildDisciplineContext(active));
    } else {
      console.error(`${PREFIX} HAN_DISCIPLINE="${activeName}" not found`);
    }
  }

  // Start coordinator for Browse UI visibility
  const eventLogger = new BridgeEventLogger(sessionId, directory);
  startCoordinator(eventLogger.getWatchDir());

  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: parts.join('\n\n'),
    },
  };
}

/**
 * UserPromptSubmit: inject current datetime on each prompt.
 */
async function handleUserPromptSubmit(
  _payload: CodexHookPayload,
  _directory: string,
  _sessionId: string
): Promise<CodexHookOutput> {
  return {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: buildPromptContext(),
    },
  };
}

/**
 * PreToolUse: deny the tool call when a Han PreToolUse hook fails.
 */
async function handlePreToolUse(
  payload: CodexHookPayload,
  directory: string,
  sessionId: string
): Promise<CodexHookOutput> {
  const results = await runPreToolHooks(payload, directory, sessionId);
  if (!results) return {};

  return formatPreToolUseResults(results) ?? {};
}

/**
 * PermissionRequest: deny the permission prompt when a Han hook fails.
 */
async function handlePermissionRequest(
  payload: CodexHookPayload,
  directory: string,
  sessionId: string
): Promise<CodexHookOutput> {
  const results = await runPreToolHooks(payload, directory, sessionId);
  if (!results) return {};

  return formatPermissionRequestResults(results) ?? {};
}

/**
 * PostToolUse: run validation hooks after edits (primary validation path).
 * Failures replace the tool result with feedback via decision: "block".
 */
async function handlePostToolUse(
  payload: CodexHookPayload,
  directory: string,
  sessionId: string
): Promise<CodexHookOutput> {
  const allHooks = discoverHooks(directory);
  const postToolUseHooks = getHooksByEvent(allHooks, 'PostToolUse');

  if (postToolUseHooks.length === 0) return {};

  const claudeToolName = mapToolName(payload.tool_name ?? '');
  const filePaths = extractFilePaths(payload);

  if (filePaths.length === 0) return {};

  const eventLogger = new BridgeEventLogger(sessionId, directory);

  // Log file changes and invalidate cache
  for (const fp of filePaths) {
    eventLogger.logFileChange(claudeToolName, fp);
    invalidateFile(fp);
  }

  const matching = matchPostToolUseHooks(
    postToolUseHooks,
    claudeToolName,
    filePaths[0],
    directory
  );

  if (matching.length === 0) return {};

  const results = await executeHooksParallel(matching, filePaths, {
    cwd: directory,
    sessionId,
    eventLogger,
    hookType: 'PostToolUse',
  });

  eventLogger.flush();

  return formatPostToolUseResults(results) ?? {};
}

/**
 * Stop / SubagentStop: full project validation when the agent finishes.
 * Failures emit decision: "block" so Codex turns the reason into a new
 * user prompt and the agent keeps working.
 */
async function handleStop(
  _payload: CodexHookPayload,
  directory: string,
  sessionId: string
): Promise<CodexHookOutput> {
  const allHooks = discoverHooks(directory);
  const stopHooks = getHooksByEvent(allHooks, 'Stop');
  const matching = matchStopHooks(stopHooks, directory);

  if (matching.length === 0) return {};

  const eventLogger = new BridgeEventLogger(sessionId, directory);

  const results = await executeHooksParallel(matching, [], {
    cwd: directory,
    sessionId,
    timeout: 120_000,
    eventLogger,
    hookType: 'Stop',
  });

  eventLogger.flush();

  return formatStopResults(results) ?? {};
}

/**
 * PreCompact / PostCompact / SubagentStart: no Han hook equivalents.
 * Events are flushed after each hook execution, so nothing to do.
 */
async function handleNoop(): Promise<CodexHookOutput> {
  return {};
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const event = process.argv[2];

  if (!event) {
    console.error(`${PREFIX} Usage: codex-plugin-han <event>`);
    console.error(
      `${PREFIX} Events: session-start, user-prompt-submit, pre-tool-use, ` +
        `permission-request, post-tool-use, pre-compact, post-compact, ` +
        `subagent-start, subagent-stop, stop`
    );
    writeOutput({});
    process.exit(0);
  }

  // Set provider env for child processes
  process.env.HAN_PROVIDER = 'codex';

  const payload = await readStdin();

  // Prefer Codex's session id so events group with the Codex session
  if (!process.env.HAN_SESSION_ID) {
    process.env.HAN_SESSION_ID = payload.session_id ?? crypto.randomUUID();
  }
  const sessionId = process.env.HAN_SESSION_ID;

  const directory = payload.cwd || process.cwd();

  console.error(
    `${PREFIX} Event: ${event}, tool: ${payload.tool_name ?? '(none)'}`
  );

  try {
    let output: CodexHookOutput;

    switch (event) {
      case 'session-start':
        output = await handleSessionStart(payload, directory, sessionId);
        break;
      case 'user-prompt-submit':
        output = await handleUserPromptSubmit(payload, directory, sessionId);
        break;
      case 'pre-tool-use':
        output = await handlePreToolUse(payload, directory, sessionId);
        break;
      case 'permission-request':
        output = await handlePermissionRequest(payload, directory, sessionId);
        break;
      case 'post-tool-use':
        output = await handlePostToolUse(payload, directory, sessionId);
        break;
      case 'pre-compact':
      case 'post-compact':
      case 'subagent-start':
        output = await handleNoop();
        break;
      case 'subagent-stop':
      case 'stop':
        output = await handleStop(payload, directory, sessionId);
        break;
      default:
        console.error(`${PREFIX} Unknown event: ${event}`);
        output = {};
    }

    writeOutput(output);
  } catch (err) {
    console.error(
      `${PREFIX} Error handling ${event}:`,
      err instanceof Error ? err.message : err
    );
    // Always output valid JSON, even on error
    writeOutput({});
  }
}

main();
