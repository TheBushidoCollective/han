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
import { invalidateFile } from './cache';
import { buildPromptContext, buildSessionContext } from './context';
import { buildDisciplineContext, discoverDisciplines, formatDisciplineList, } from './disciplines';
import { discoverHooks, getHooksByEvent, resolvePluginPaths, } from './discovery';
import { BridgeEventLogger } from './events';
import { executeHooksParallel } from './executor';
import { formatInlineResults, formatNotificationResults, formatStopResults, } from './formatter';
import { matchPostToolUseHooks, matchStopHooks } from './matcher';
import { discoverAllSkills, formatSkillList, loadSkillContent, } from './skills';
import { mapToolName, } from './types';
const PREFIX = '[han]';
/**
 * Extract file path(s) from an OpenCode tool event.
 *
 * OpenCode provides tool output with title/output/metadata.
 * For edit/write tools, the file path is typically in the metadata
 * or can be inferred from the tool output.
 */
function extractFilePaths(_input, output) {
    const paths = [];
    // Check metadata for file path
    if (output.metadata) {
        const meta = output.metadata;
        if (typeof meta.path === 'string')
            paths.push(meta.path);
        if (typeof meta.file_path === 'string')
            paths.push(meta.file_path);
        if (typeof meta.filePath === 'string')
            paths.push(meta.filePath);
    }
    // Check title for file path (common pattern: "Edit: src/foo.ts")
    if (paths.length === 0 && output.title) {
        const titleMatch = output.title.match(/(?:edit|write|create|modify):\s*(.+)/i);
        if (titleMatch) {
            paths.push(titleMatch[1].trim());
        }
    }
    return paths;
}
/**
 * Start the Han coordinator daemon in the background.
 * The coordinator indexes JSONL event files and serves the Browse UI.
 * We pass the OpenCode watch path so it picks up our events.
 */
function startCoordinator(watchDir) {
    try {
        const { spawn } = require('node:child_process');
        // Start coordinator if not already running
        const child = spawn('han', ['coordinator', 'ensure', '--background', '--watch-path', watchDir], {
            stdio: 'ignore',
            detached: true,
            env: {
                ...process.env,
                HAN_PROVIDER: 'opencode',
            },
        });
        // Unref so the coordinator doesn't prevent OpenCode from exiting
        child.unref();
        console.error(`${PREFIX} Coordinator ensure started (watch: ${watchDir})`);
    }
    catch {
        // han CLI not installed - coordinator won't index our events
        // but validation still works fine without it
        console.error(`${PREFIX} Could not start coordinator (han CLI not found). ` +
            `Browse UI won't show OpenCode sessions.`);
    }
}
/**
 * Main OpenCode plugin entry point.
 */
async function hanBridgePlugin(ctx) {
    const { client, directory } = ctx;
    // ─── Plugin Discovery ───────────────────────────────────────────────────
    // Resolve all installed plugins to their filesystem paths.
    // This is shared by hooks, skills, and disciplines.
    const resolvedPlugins = resolvePluginPaths(directory);
    // ─── Hook Discovery ──────────────────────────────────────────────────────
    const allHooks = discoverHooks(directory);
    const postToolUseHooks = getHooksByEvent(allHooks, 'PostToolUse');
    const preToolUseHooks = getHooksByEvent(allHooks, 'PreToolUse');
    const stopHooks = getHooksByEvent(allHooks, 'Stop');
    // ─── Skill Discovery ──────────────────────────────────────────────────────
    const allSkills = discoverAllSkills(resolvedPlugins);
    const skillsByName = new Map();
    for (const skill of allSkills) {
        skillsByName.set(skill.name, skill);
    }
    // ─── Discipline Discovery ──────────────────────────────────────────────────
    const allDisciplines = discoverDisciplines(resolvedPlugins, allSkills);
    const disciplinesByName = new Map();
    for (const d of allDisciplines) {
        disciplinesByName.set(d.name, d);
    }
    // Active discipline for system prompt injection
    let activeDiscipline = null;
    // ─── Logging ──────────────────────────────────────────────────────────────
    const pluginCount = resolvedPlugins.size;
    const skillCount = allSkills.length;
    const disciplineCount = allDisciplines.length;
    if (pluginCount === 0) {
        console.error(`${PREFIX} No Han plugins found. ` +
            `Install plugins: han plugin install --auto`);
        return {};
    }
    console.error(`${PREFIX} Discovered ${pluginCount} plugins: ` +
        `${preToolUseHooks.length} PreToolUse, ` +
        `${postToolUseHooks.length} PostToolUse, ` +
        `${stopHooks.length} Stop hooks, ` +
        `${skillCount} skills, ` +
        `${disciplineCount} disciplines`);
    // ─── Session State ───────────────────────────────────────────────────────
    const sessionId = crypto.randomUUID();
    const pendingValidations = new Map();
    // ─── Event Logger ──────────────────────────────────────────────────────
    const eventLogger = new BridgeEventLogger(sessionId, directory);
    // Set HAN_PROVIDER for child processes (hook commands)
    process.env.HAN_PROVIDER = 'opencode';
    process.env.HAN_SESSION_ID = sessionId;
    // ─── Coordinator ───────────────────────────────────────────────────────
    startCoordinator(eventLogger.getWatchDir());
    // ─── Plugin Return ─────────────────────────────────────────────────────
    return {
        // ─── Custom Tools ─────────────────────────────────────────────────────
        // Registered with OpenCode so the LLM can call them directly.
        tool: {
            /**
             * han_skills - Browse and load Han's skill library.
             *
             * The LLM calls this to discover available skills and load
             * their full SKILL.md content when it needs expertise.
             */
            han_skills: {
                description: 'Browse and load Han skills (400+ specialized coding skills). ' +
                    'Use action="list" to search available skills, ' +
                    'action="load" with skill name to get full skill content.',
                parameters: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['list', 'load'],
                            description: 'Action to perform: "list" to search skills, "load" to get skill content',
                        },
                        skill: {
                            type: 'string',
                            description: 'Skill name to load (required for action=load)',
                        },
                        filter: {
                            type: 'string',
                            description: 'Search filter for skill names/descriptions (optional for action=list)',
                        },
                    },
                    required: ['action'],
                },
                async execute(args) {
                    if (args.action === 'load') {
                        if (!args.skill) {
                            return {
                                output: 'Error: skill parameter required for action=load',
                            };
                        }
                        const skill = skillsByName.get(args.skill);
                        if (!skill) {
                            // Try partial match
                            const matches = allSkills.filter((s) => s.name.toLowerCase().includes(args.skill?.toLowerCase() ?? ''));
                            if (matches.length === 1) {
                                return { output: loadSkillContent(matches[0]) };
                            }
                            if (matches.length > 1) {
                                return {
                                    output: `Multiple skills match "${args.skill}":\n` +
                                        matches.map((s) => `- ${s.name}`).join('\n') +
                                        '\n\nBe more specific.',
                                };
                            }
                            return {
                                output: `Skill "${args.skill}" not found. Use action="list" to see available skills.`,
                            };
                        }
                        return { output: loadSkillContent(skill) };
                    }
                    // Default: list
                    return { output: formatSkillList(allSkills, args.filter) };
                },
            },
            /**
             * han_discipline - Activate specialized agent disciplines.
             *
             * When activated, the discipline's context is injected into
             * every subsequent LLM call via experimental.chat.system.transform.
             */
            han_discipline: {
                description: 'Activate a Han discipline (specialized agent persona). ' +
                    'Use action="list" to see available disciplines, ' +
                    'action="activate" to switch, action="deactivate" to clear.',
                parameters: {
                    type: 'object',
                    properties: {
                        action: {
                            type: 'string',
                            enum: ['list', 'activate', 'deactivate'],
                            description: 'Action: "list", "activate", or "deactivate"',
                        },
                        discipline: {
                            type: 'string',
                            description: 'Discipline name (required for activate)',
                        },
                    },
                    required: ['action'],
                },
                async execute(args) {
                    if (args.action === 'activate') {
                        if (!args.discipline) {
                            return {
                                output: 'Error: discipline parameter required for activate',
                            };
                        }
                        const d = disciplinesByName.get(args.discipline);
                        if (!d) {
                            return {
                                output: `Discipline "${args.discipline}" not found.\n\n` +
                                    formatDisciplineList(allDisciplines),
                            };
                        }
                        activeDiscipline = d;
                        return {
                            output: `Activated discipline: **${d.name}**\n\n` +
                                `${d.description}\n\n` +
                                (d.skills.length > 0
                                    ? `${d.skills.length} specialized skills available. ` +
                                        `Use han_skills to load any of them.`
                                    : ''),
                        };
                    }
                    if (args.action === 'deactivate') {
                        const prev = activeDiscipline?.name;
                        activeDiscipline = null;
                        return {
                            output: prev
                                ? `Deactivated discipline: ${prev}`
                                : 'No discipline was active.',
                        };
                    }
                    // Default: list
                    return { output: formatDisciplineList(allDisciplines) };
                },
            },
        },
        // ─── System Prompt Injection ─────────────────────────────────────────
        // Inject core guidelines and active discipline context into every LLM call.
        // This replaces Claude Code's SessionStart context injection +
        // session-references must-read-first tags.
        'experimental.chat.system.transform': async (_input, output) => {
            // Core guidelines (professional honesty, no time estimates, etc.)
            output.system.push(buildSessionContext(skillCount, disciplineCount));
            // Active discipline context
            if (activeDiscipline) {
                output.system.push(buildDisciplineContext(activeDiscipline));
            }
        },
        // ─── Chat Message Hook ──────────────────────────────────────────────
        // Mirrors Claude Code's UserPromptSubmit hook: inject datetime
        // on each user message so the LLM knows the current time.
        'chat.message': async (_input, output) => {
            const timeContext = buildPromptContext();
            output.parts.push({ type: 'text', text: `\n\n${timeContext}` });
        },
        // ─── Hook Handlers ───────────────────────────────────────────────────
        /**
         * tool.execute.before → PreToolUse hooks
         *
         * Runs before a tool executes. Enables:
         * - Pre-commit/pre-push validation gates (intercept git commands)
         * - Input modification (add context to prompts)
         * - Subagent context injection (discipline context for task tools)
         */
        'tool.execute.before': async (input, output) => {
            const claudeToolName = mapToolName(input.tool);
            // Inject discipline context into task/agent tool prompts
            if (activeDiscipline && output.args) {
                const prompt = output.args.prompt;
                const message = output.args.message;
                const target = prompt ?? message;
                if (target && (claudeToolName === 'Task' || input.tool === 'agent')) {
                    const context = buildDisciplineContext(activeDiscipline);
                    const key = prompt ? 'prompt' : 'message';
                    output.args[key] =
                        `<subagent-context>\n${context}\n</subagent-context>\n\n${target}`;
                }
            }
            // Run PreToolUse hooks (e.g., pre-commit validation)
            if (preToolUseHooks.length > 0) {
                const matching = preToolUseHooks.filter((h) => {
                    if (!h.toolFilter)
                        return true;
                    return h.toolFilter.includes(claudeToolName);
                });
                if (matching.length > 0) {
                    const results = await executeHooksParallel(matching, [], {
                        cwd: directory,
                        sessionId,
                        eventLogger,
                        hookType: 'PreToolUse',
                    });
                    // If any PreToolUse hook fails, log it as a warning in output
                    const failures = results.filter((r) => !r.skipped && r.exitCode !== 0);
                    if (failures.length > 0) {
                        const warnings = failures
                            .map((r) => `[${r.hook.pluginName}/${r.hook.name}]: ${r.stdout || r.stderr}`)
                            .join('\n');
                        console.error(`${PREFIX} PreToolUse warnings:\n${warnings}`);
                    }
                }
            }
        },
        /**
         * tool.execute.after → PostToolUse hooks
         *
         * This is the PRIMARY validation path. When the agent edits a file,
         * we run matching validation hooks (biome, eslint, tsc, etc.) as
         * parallel promises and deliver results as notifications.
         */
        'tool.execute.after': async (input, output) => {
            const claudeToolName = mapToolName(input.tool);
            const filePaths = extractFilePaths(input, output);
            if (filePaths.length === 0)
                return;
            // Log file changes and invalidate cache
            for (const fp of filePaths) {
                eventLogger.logFileChange(claudeToolName, fp);
                invalidateFile(fp);
            }
            // Find hooks matching this tool + file
            const matching = matchPostToolUseHooks(postToolUseHooks, claudeToolName, filePaths[0], directory);
            if (matching.length === 0)
                return;
            // Run all matching hooks as parallel promises
            const validationKey = `${input.callID}-${filePaths.join(',')}`;
            const validationPromise = (async () => {
                try {
                    const results = await executeHooksParallel(matching, filePaths, {
                        cwd: directory,
                        sessionId,
                        eventLogger,
                        hookType: 'PostToolUse',
                    });
                    // Inline feedback: append failures directly to tool output
                    const inline = formatInlineResults(results);
                    if (inline) {
                        output.output += inline;
                    }
                    // Async notification: send detailed results as a message
                    const notification = formatNotificationResults(results, filePaths);
                    if (notification) {
                        try {
                            await client.session.prompt({
                                path: { id: input.sessionID },
                                body: {
                                    noReply: true,
                                    parts: [{ type: 'text', text: notification }],
                                },
                            });
                        }
                        catch (err) {
                            // Session may be busy; inline feedback is the fallback
                            console.error(`${PREFIX} Could not send notification:`, err instanceof Error ? err.message : err);
                        }
                    }
                }
                catch (err) {
                    console.error(`${PREFIX} PostToolUse hook error:`, err instanceof Error ? err.message : err);
                }
                finally {
                    pendingValidations.delete(validationKey);
                }
            })();
            pendingValidations.set(validationKey, validationPromise);
        },
        /**
         * Generic event handler for session lifecycle events.
         *
         * session.idle → Stop hooks (broader project validation)
         */
        event: async ({ event }) => {
            if (event.type === 'session.idle') {
                const eventSessionId = event.properties?.sessionID;
                // Wait for any pending PostToolUse validations to finish
                if (pendingValidations.size > 0) {
                    await Promise.allSettled(pendingValidations.values());
                }
                // Run Stop hooks for full project validation
                const matching = matchStopHooks(stopHooks, directory);
                if (matching.length === 0)
                    return;
                try {
                    const results = await executeHooksParallel(matching, [], {
                        cwd: directory,
                        sessionId,
                        timeout: 120_000, // Stop hooks get more time
                        eventLogger,
                        hookType: 'Stop',
                    });
                    const message = formatStopResults(results);
                    if (message && eventSessionId) {
                        await client.session.prompt({
                            path: { id: eventSessionId },
                            body: {
                                parts: [{ type: 'text', text: message }],
                            },
                        });
                    }
                }
                catch (err) {
                    console.error(`${PREFIX} Stop hook error:`, err instanceof Error ? err.message : err);
                }
            }
        },
        /**
         * Stop hook - backup validation gate.
         *
         * OpenCode calls this when the agent signals completion.
         * If Stop hooks find issues, forces the agent to continue.
         */
        stop: async () => {
            const matching = matchStopHooks(stopHooks, directory);
            if (matching.length === 0)
                return undefined;
            try {
                const results = await executeHooksParallel(matching, [], {
                    cwd: directory,
                    sessionId,
                    timeout: 120_000,
                    eventLogger,
                    hookType: 'Stop',
                });
                const message = formatStopResults(results);
                if (message) {
                    // Flush events before returning so coordinator has latest data
                    eventLogger.flush();
                    return {
                        continue: true,
                        assistantMessage: message,
                    };
                }
            }
            catch (err) {
                console.error(`${PREFIX} Stop validation error:`, err instanceof Error ? err.message : err);
            }
            return undefined;
        },
    };
}
export default hanBridgePlugin;
