import type { Command } from 'commander';
import { registerHookAutoDetect } from './auto-detect.ts';
import { registerHookContext } from './context.ts';
import { registerHookDispatch } from './dispatch.ts';
import { registerHookExplain } from './explain.tsx';
import { registerInjectSubagentContext } from './inject-subagent-context.ts';
import { registerHookList } from './list.ts';
import { registerHookOrchestrate } from './orchestrate.ts';
import { createReferenceCommand } from './reference/index.ts';
import { registerHookRun } from './run.ts';
import { registerHookTest } from './test.tsx';
import { registerHookWait } from './wait.ts';
import { registerWrapSubagentContext } from './wrap-subagent-context.ts';

/**
 * Register all hook-related commands under `han hook`
 */
export function registerHookCommands(program: Command): void {
  const hookCommand = program.command('hook').description('Hook utilities');

  registerHookAutoDetect(hookCommand);
  registerHookContext(hookCommand);
  registerHookDispatch(hookCommand);
  registerHookExplain(hookCommand);
  registerInjectSubagentContext(hookCommand);
  registerHookList(hookCommand);
  registerHookOrchestrate(hookCommand);
  registerHookRun(hookCommand);
  registerHookTest(hookCommand);
  registerHookWait(hookCommand);
  registerWrapSubagentContext(hookCommand);
  hookCommand.addCommand(createReferenceCommand());
}
