/**
 * Han Bridge for OpenCode
 *
 * Translates OpenCode's JS/TS plugin events into Han hook executions,
 * enabling Han's validation pipeline to work inside OpenCode.
 *
 * Architecture:
 *
 *   tool.execute.after (Edit/Write)
 *     -> discovery.ts finds installed plugins' PostToolUse hooks
 *     -> matcher.ts filters by tool name + file pattern
 *     -> executor.ts runs matching hook commands as parallel promises
 *     -> formatter.ts structures results into actionable feedback
 *     -> client.session.prompt() notifies agent of issues
 *
 *   session.idle (agent finished)
 *     -> discovery.ts finds installed plugins' Stop hooks
 *     -> executor.ts runs matching hooks
 *     -> formatter.ts structures results
 *     -> client.session.prompt() re-prompts agent to fix issues
 *
 *   han_skills tool (LLM-callable)
 *     -> skills.ts discovers SKILL.md from installed plugins
 *     -> LLM can list and load 400+ skills on demand
 *
 *   han_discipline tool (LLM-callable)
 *     -> disciplines.ts discovers agent personas
 *     -> System prompt injection via experimental.chat.system.transform
 *
 * Key difference from han's dispatch: hooks run as awaited promises,
 * not fire-and-forget. Results are collected, parsed, and delivered
 * as structured messages the agent can act on.
 */
import { type OpenCodeEvent, type OpenCodePluginContext, type StopResult, type ToolBeforeInput, type ToolBeforeOutput, type ToolEventInput, type ToolEventOutput } from './types';
/**
 * Main OpenCode plugin entry point.
 */
declare function hanBridgePlugin(ctx: OpenCodePluginContext): Promise<{
    tool?: undefined;
    'experimental.chat.system.transform'?: undefined;
    'chat.message'?: undefined;
    /**
     * tool.execute.before → PreToolUse hooks
     *
     * Runs before a tool executes. Enables:
     * - Pre-commit/pre-push validation gates (intercept git commands)
     * - Input modification (add context to prompts)
     * - Subagent context injection (discipline context for task tools)
     */
    'tool.execute.before'?: undefined;
    /**
     * tool.execute.after → PostToolUse hooks
     *
     * This is the PRIMARY validation path. When the agent edits a file,
     * we run matching validation hooks (biome, eslint, tsc, etc.) as
     * parallel promises and deliver results as notifications.
     */
    'tool.execute.after'?: undefined;
    /**
     * Generic event handler for session lifecycle events.
     *
     * session.idle → Stop hooks (broader project validation)
     */
    event?: undefined;
    /**
     * Stop hook - backup validation gate.
     *
     * OpenCode calls this when the agent signals completion.
     * If Stop hooks find issues, forces the agent to continue.
     */
    stop?: undefined;
} | {
    tool: {
        /**
         * han_skills - Browse and load Han's skill library.
         *
         * The LLM calls this to discover available skills and load
         * their full SKILL.md content when it needs expertise.
         */
        han_skills: {
            description: string;
            parameters: {
                type: "object";
                properties: {
                    action: {
                        type: "string";
                        enum: string[];
                        description: string;
                    };
                    skill: {
                        type: "string";
                        description: string;
                    };
                    filter: {
                        type: "string";
                        description: string;
                    };
                };
                required: string[];
            };
            execute(args: {
                action: string;
                skill?: string;
                filter?: string;
            }): Promise<{
                output: string;
            }>;
        };
        /**
         * han_discipline - Activate specialized agent disciplines.
         *
         * When activated, the discipline's context is injected into
         * every subsequent LLM call via experimental.chat.system.transform.
         */
        han_discipline: {
            description: string;
            parameters: {
                type: "object";
                properties: {
                    action: {
                        type: "string";
                        enum: string[];
                        description: string;
                    };
                    discipline: {
                        type: "string";
                        description: string;
                    };
                };
                required: string[];
            };
            execute(args: {
                action: string;
                discipline?: string;
            }): Promise<{
                output: string;
            }>;
        };
    };
    'experimental.chat.system.transform': (_input: Record<string, never>, output: {
        system: string[];
    }) => Promise<void>;
    'chat.message': (_input: Record<string, unknown>, output: {
        message: string;
        parts: unknown[];
    }) => Promise<void>;
    /**
     * tool.execute.before → PreToolUse hooks
     *
     * Runs before a tool executes. Enables:
     * - Pre-commit/pre-push validation gates (intercept git commands)
     * - Input modification (add context to prompts)
     * - Subagent context injection (discipline context for task tools)
     */
    'tool.execute.before': (input: ToolBeforeInput, output: ToolBeforeOutput) => Promise<void>;
    /**
     * tool.execute.after → PostToolUse hooks
     *
     * This is the PRIMARY validation path. When the agent edits a file,
     * we run matching validation hooks (biome, eslint, tsc, etc.) as
     * parallel promises and deliver results as notifications.
     */
    'tool.execute.after': (input: ToolEventInput, output: ToolEventOutput) => Promise<void>;
    /**
     * Generic event handler for session lifecycle events.
     *
     * session.idle → Stop hooks (broader project validation)
     */
    event: ({ event }: {
        event: OpenCodeEvent;
    }) => Promise<void>;
    /**
     * Stop hook - backup validation gate.
     *
     * OpenCode calls this when the agent signals completion.
     * If Stop hooks find issues, forces the agent to continue.
     */
    stop: () => Promise<StopResult | undefined>;
}>;
export default hanBridgePlugin;
