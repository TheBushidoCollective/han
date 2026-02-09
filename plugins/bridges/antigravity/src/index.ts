/**
 * Han Bridge for Antigravity (Google)
 *
 * MCP server that brings Han's plugin ecosystem to Antigravity IDE.
 *
 * Architecture:
 *
 *   Antigravity doesn't have lifecycle hooks like Claude Code or OpenCode.
 *   Instead, the bridge integrates via MCP server, exposing Han's
 *   capabilities as tools the agent can call:
 *
 *   han_skills (MCP tool)
 *     -> skills.ts discovers SKILL.md from installed plugins
 *     -> Agent can list and load 400+ skills on demand
 *
 *   han_discipline (MCP tool)
 *     -> disciplines.ts discovers agent personas
 *     -> Agent activates/deactivates specialized disciplines
 *
 *   han_validate (MCP tool)
 *     -> executor.ts runs matching validation hooks
 *     -> Returns structured results for the agent to act on
 *     -> Supports file-specific (PostToolUse) and project-wide (Stop) validation
 *
 *   han_sync (MCP tool)
 *     -> sync.ts copies skills to .agent/skills/ for native discovery
 *     -> sync.ts generates .agent/rules/han-guidelines.md
 *     -> Antigravity discovers Han skills without MCP calls
 *
 * Key difference from OpenCode bridge: Antigravity lacks event hooks,
 * so validation is on-demand (agent calls han_validate) rather than
 * automatic (triggered by tool.execute.after). The agent is instructed
 * via rules to call han_validate after edits.
 */

import { discoverHooks, resolvePluginPaths, getHooksByEvent } from "./discovery"
import { matchPostToolUseHooks, matchStopHooks } from "./matcher"
import { executeHooksParallel } from "./executor"
import { invalidateFile } from "./cache"
import { formatValidationResults, formatStopResults } from "./formatter"
import { mapToolName } from "./types"
import { BridgeEventLogger } from "./events"
import {
  discoverAllSkills,
  loadSkillContent,
  formatSkillList,
  type SkillInfo,
} from "./skills"
import {
  discoverDisciplines,
  formatDisciplineList,
  buildDisciplineContext,
  type DisciplineInfo,
} from "./disciplines"
import { buildPromptContext } from "./context"
import { syncAll } from "./sync"

const PREFIX = "[han]"

/**
 * Start the Han coordinator daemon in the background.
 */
function startCoordinator(watchDir: string): void {
  try {
    const { spawn } = require("node:child_process") as typeof import("node:child_process")

    const child = spawn(
      "han",
      ["coordinator", "ensure", "--background", "--watch-path", watchDir],
      {
        stdio: "ignore",
        detached: true,
        env: {
          ...process.env,
          HAN_PROVIDER: "antigravity",
        },
      },
    )

    child.unref()
    console.error(`${PREFIX} Coordinator ensure started (watch: ${watchDir})`)
  } catch {
    console.error(
      `${PREFIX} Could not start coordinator (han CLI not found). ` +
        `Browse UI won't show Antigravity sessions.`,
    )
  }
}

/**
 * Create and start the Han MCP server for Antigravity.
 *
 * This is the main entry point. It discovers plugins, sets up tools,
 * and returns an MCP server configuration that Antigravity can use.
 */
export async function createHanMcpServer(projectDir: string) {
  // ─── Plugin Discovery ───────────────────────────────────────────────────
  const resolvedPlugins = resolvePluginPaths(projectDir)

  // ─── Hook Discovery ──────────────────────────────────────────────────────
  const allHooks = discoverHooks(projectDir)
  const postToolUseHooks = getHooksByEvent(allHooks, "PostToolUse")
  const stopHooks = getHooksByEvent(allHooks, "Stop")

  // ─── Skill Discovery ──────────────────────────────────────────────────────
  const allSkills = discoverAllSkills(resolvedPlugins)
  const skillsByName = new Map<string, SkillInfo>()
  for (const skill of allSkills) {
    skillsByName.set(skill.name, skill)
  }

  // ─── Discipline Discovery ──────────────────────────────────────────────────
  const allDisciplines = discoverDisciplines(resolvedPlugins, allSkills)
  const disciplinesByName = new Map<string, DisciplineInfo>()
  for (const d of allDisciplines) {
    disciplinesByName.set(d.name, d)
  }

  let activeDiscipline: DisciplineInfo | null = null

  // ─── Logging ──────────────────────────────────────────────────────────────
  const pluginCount = resolvedPlugins.size
  const skillCount = allSkills.length
  const disciplineCount = allDisciplines.length

  if (pluginCount === 0) {
    console.error(
      `${PREFIX} No Han plugins found. ` +
        `Install plugins: han plugin install --auto`,
    )
  } else {
    console.error(
      `${PREFIX} Discovered ${pluginCount} plugins: ` +
        `${postToolUseHooks.length} PostToolUse, ` +
        `${stopHooks.length} Stop hooks, ` +
        `${skillCount} skills, ` +
        `${disciplineCount} disciplines`,
    )
  }

  // ─── Session State ───────────────────────────────────────────────────────
  const sessionId = crypto.randomUUID()
  process.env.HAN_PROVIDER = "antigravity"
  process.env.HAN_SESSION_ID = sessionId

  // ─── Event Logger ──────────────────────────────────────────────────────
  const eventLogger = new BridgeEventLogger(sessionId, projectDir)

  // ─── Coordinator ───────────────────────────────────────────────────────
  startCoordinator(eventLogger.getWatchDir())

  // ─── MCP Tool Definitions ─────────────────────────────────────────────
  return {
    name: "han",
    version: "0.1.0",
    tools: {
      /**
       * han_skills - Browse and load Han's skill library.
       */
      han_skills: {
        description:
          "Browse and load Han skills (400+ specialized coding skills). " +
          'Use action="list" to search available skills, ' +
          'action="load" with skill name to get full skill content.',
        inputSchema: {
          type: "object" as const,
          properties: {
            action: {
              type: "string" as const,
              enum: ["list", "load"],
              description: 'Action: "list" to search, "load" to get content',
            },
            skill: {
              type: "string" as const,
              description: "Skill name to load (required for action=load)",
            },
            filter: {
              type: "string" as const,
              description: "Search filter (optional for action=list)",
            },
          },
          required: ["action"],
        },
        async execute(args: { action: string; skill?: string; filter?: string }) {
          if (args.action === "load") {
            if (!args.skill) {
              return { content: [{ type: "text" as const, text: "Error: skill parameter required for action=load" }] }
            }

            const skill = skillsByName.get(args.skill)
            if (!skill) {
              const matches = allSkills.filter((s) =>
                s.name.toLowerCase().includes(args.skill!.toLowerCase()),
              )
              if (matches.length === 1) {
                return { content: [{ type: "text" as const, text: loadSkillContent(matches[0]) }] }
              }
              if (matches.length > 1) {
                return {
                  content: [{
                    type: "text" as const,
                    text:
                      `Multiple skills match "${args.skill}":\n` +
                      matches.map((s) => `- ${s.name}`).join("\n") +
                      "\n\nBe more specific.",
                  }],
                }
              }
              return { content: [{ type: "text" as const, text: `Skill "${args.skill}" not found. Use action="list" to see available skills.` }] }
            }

            return { content: [{ type: "text" as const, text: loadSkillContent(skill) }] }
          }

          return { content: [{ type: "text" as const, text: formatSkillList(allSkills, args.filter) }] }
        },
      },

      /**
       * han_discipline - Activate specialized agent disciplines.
       */
      han_discipline: {
        description:
          "Activate a Han discipline (specialized agent persona). " +
          'Use action="list" to see available disciplines, ' +
          'action="activate" to switch, action="deactivate" to clear.',
        inputSchema: {
          type: "object" as const,
          properties: {
            action: {
              type: "string" as const,
              enum: ["list", "activate", "deactivate"],
              description: 'Action: "list", "activate", or "deactivate"',
            },
            discipline: {
              type: "string" as const,
              description: "Discipline name (required for activate)",
            },
          },
          required: ["action"],
        },
        async execute(args: { action: string; discipline?: string }) {
          if (args.action === "activate") {
            if (!args.discipline) {
              return { content: [{ type: "text" as const, text: "Error: discipline parameter required for activate" }] }
            }

            const d = disciplinesByName.get(args.discipline)
            if (!d) {
              return {
                content: [{
                  type: "text" as const,
                  text:
                    `Discipline "${args.discipline}" not found.\n\n` +
                    formatDisciplineList(allDisciplines),
                }],
              }
            }

            activeDiscipline = d
            return {
              content: [{
                type: "text" as const,
                text:
                  `Activated discipline: **${d.name}**\n\n` +
                  `${d.description}\n\n` +
                  (d.skills.length > 0
                    ? `${d.skills.length} specialized skills available. ` +
                      `Use han_skills to load any of them.\n\n` +
                      buildDisciplineContext(d)
                    : ""),
              }],
            }
          }

          if (args.action === "deactivate") {
            const prev = activeDiscipline?.name
            activeDiscipline = null
            return {
              content: [{
                type: "text" as const,
                text: prev
                  ? `Deactivated discipline: ${prev}`
                  : "No discipline was active.",
              }],
            }
          }

          return { content: [{ type: "text" as const, text: formatDisciplineList(allDisciplines) }] }
        },
      },

      /**
       * han_validate - Run validation hooks on demand.
       *
       * Since Antigravity lacks lifecycle hooks, the agent calls this
       * tool explicitly after making edits or before finishing a task.
       *
       * Two modes:
       *   - file: Run PostToolUse hooks for specific files (after edits)
       *   - project: Run Stop hooks for full project validation (before finishing)
       */
      han_validate: {
        description:
          "Run Han validation hooks (linting, type checking, formatting). " +
          'Use mode="file" with file paths after editing files, or ' +
          'mode="project" for full project validation before completing a task.',
        inputSchema: {
          type: "object" as const,
          properties: {
            mode: {
              type: "string" as const,
              enum: ["file", "project"],
              description: '"file" for per-file validation, "project" for full project check',
            },
            files: {
              type: "array" as const,
              items: { type: "string" as const },
              description: "File paths to validate (required for mode=file)",
            },
            tool: {
              type: "string" as const,
              description: 'Tool that edited the files (e.g. "Edit", "Write"). Defaults to "Edit".',
            },
          },
          required: ["mode"],
        },
        async execute(args: { mode: string; files?: string[]; tool?: string }) {
          if (args.mode === "file") {
            if (!args.files || args.files.length === 0) {
              return { content: [{ type: "text" as const, text: "Error: files parameter required for mode=file" }] }
            }

            const claudeToolName = args.tool
              ? mapToolName(args.tool)
              : "Edit"

            // Invalidate cache for edited files
            for (const fp of args.files) {
              invalidateFile(fp)
            }

            // Find and run matching PostToolUse hooks for the first file
            const matching = matchPostToolUseHooks(
              postToolUseHooks,
              claudeToolName,
              args.files[0],
              projectDir,
            )

            if (matching.length === 0) {
              return {
                content: [{
                  type: "text" as const,
                  text: `No validation hooks matched for ${args.files.join(", ")}. ` +
                    `(${postToolUseHooks.length} PostToolUse hooks registered)`,
                }],
              }
            }

            const results = await executeHooksParallel(matching, args.files, {
              cwd: projectDir,
              sessionId,
              eventLogger,
              hookType: "PostToolUse",
            })

            return {
              content: [{
                type: "text" as const,
                text: formatValidationResults(results, args.files),
              }],
            }
          }

          if (args.mode === "project") {
            const matching = matchStopHooks(stopHooks, projectDir)

            if (matching.length === 0) {
              return {
                content: [{
                  type: "text" as const,
                  text: `No project validation hooks matched. ` +
                    `(${stopHooks.length} Stop hooks registered)`,
                }],
              }
            }

            const results = await executeHooksParallel(matching, [], {
              cwd: projectDir,
              sessionId,
              timeout: 120_000,
              eventLogger,
              hookType: "Stop",
            })

            eventLogger.flush()

            return {
              content: [{
                type: "text" as const,
                text: formatValidationResults(results),
              }],
            }
          }

          return {
            content: [{
              type: "text" as const,
              text: 'Error: mode must be "file" or "project"',
            }],
            isError: true,
          }
        },
      },

      /**
       * han_sync - Sync Han assets to Antigravity's native directories.
       *
       * Copies skills to .agent/skills/ and generates rules in .agent/rules/
       * so Antigravity discovers them natively without MCP tool calls.
       */
      han_sync: {
        description:
          "Sync Han skills and rules to Antigravity's native directories " +
          "(.agent/skills/ and .agent/rules/). This lets Antigravity discover " +
          "Han's skills natively. Run once after installing new plugins.",
        inputSchema: {
          type: "object" as const,
          properties: {},
          required: [],
        },
        async execute() {
          const result = syncAll(projectDir, allSkills, allDisciplines)
          return { content: [{ type: "text" as const, text: result }] }
        },
      },

      /**
       * han_context - Get current session context.
       *
       * Returns current time, active discipline, and capabilities summary.
       * Useful since Antigravity doesn't have automatic context injection hooks.
       */
      han_context: {
        description:
          "Get current Han session context including time, active discipline, " +
          "and capabilities summary.",
        inputSchema: {
          type: "object" as const,
          properties: {},
          required: [],
        },
        async execute() {
          const lines: string[] = []

          lines.push(buildPromptContext())
          lines.push("")

          if (activeDiscipline) {
            lines.push(`Active discipline: **${activeDiscipline.name}**`)
            lines.push(buildDisciplineContext(activeDiscipline))
          } else {
            lines.push("No discipline active. Use han_discipline to activate one.")
          }

          lines.push("")
          lines.push(`Available: ${skillCount} skills, ${disciplineCount} disciplines`)
          lines.push(`Validation: ${postToolUseHooks.length} PostToolUse hooks, ${stopHooks.length} Stop hooks`)

          return { content: [{ type: "text" as const, text: lines.join("\n") }] }
        },
      },
    },
  }
}

/**
 * CLI entry point for running the MCP server via stdio.
 *
 * Usage in mcp_config.json:
 * {
 *   "mcpServers": {
 *     "han": {
 *       "command": "npx",
 *       "args": ["-y", "@thebushidocollective/antigravity-han-mcp"]
 *     }
 *   }
 * }
 */
async function main() {
  const projectDir = process.argv.includes("--project-dir")
    ? process.argv[process.argv.indexOf("--project-dir") + 1]
    : process.cwd()

  console.error(`${PREFIX} Starting Han MCP server for Antigravity`)
  console.error(`${PREFIX} Project: ${projectDir}`)

  const server = await createHanMcpServer(projectDir)

  // MCP stdio transport: read JSON-RPC from stdin, write to stdout
  const { createInterface } = await import("node:readline")
  const rl = createInterface({ input: process.stdin })

  const tools = server.tools

  rl.on("line", async (line) => {
    try {
      const request = JSON.parse(line)

      if (request.method === "initialize") {
        const response = {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            protocolVersion: "2024-11-05",
            serverInfo: { name: server.name, version: server.version },
            capabilities: {
              tools: {},
            },
          },
        }
        process.stdout.write(JSON.stringify(response) + "\n")
        return
      }

      if (request.method === "tools/list") {
        const toolList = Object.entries(tools).map(([name, tool]) => ({
          name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        }))
        const response = {
          jsonrpc: "2.0",
          id: request.id,
          result: { tools: toolList },
        }
        process.stdout.write(JSON.stringify(response) + "\n")
        return
      }

      if (request.method === "tools/call") {
        const { name, arguments: args } = request.params
        const tool = tools[name as keyof typeof tools]
        if (!tool) {
          const response = {
            jsonrpc: "2.0",
            id: request.id,
            error: { code: -32601, message: `Unknown tool: ${name}` },
          }
          process.stdout.write(JSON.stringify(response) + "\n")
          return
        }

        try {
          const result = await tool.execute(args ?? {})
          const response = {
            jsonrpc: "2.0",
            id: request.id,
            result,
          }
          process.stdout.write(JSON.stringify(response) + "\n")
        } catch (err) {
          const response = {
            jsonrpc: "2.0",
            id: request.id,
            result: {
              content: [{
                type: "text",
                text: `Error: ${err instanceof Error ? err.message : String(err)}`,
              }],
              isError: true,
            },
          }
          process.stdout.write(JSON.stringify(response) + "\n")
        }
        return
      }

      if (request.method === "notifications/initialized") {
        // No response needed for notifications
        return
      }

      // Unknown method
      const response = {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32601, message: `Method not found: ${request.method}` },
      }
      process.stdout.write(JSON.stringify(response) + "\n")
    } catch (err) {
      console.error(`${PREFIX} Parse error:`, err)
    }
  })

  rl.on("close", () => {
    console.error(`${PREFIX} MCP server shutting down`)
    process.exit(0)
  })
}

// Run if invoked directly
if (require.main === module || process.argv[1]?.endsWith("index.ts")) {
  main().catch((err) => {
    console.error(`${PREFIX} Fatal error:`, err)
    process.exit(1)
  })
}

export default createHanMcpServer
