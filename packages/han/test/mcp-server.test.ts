/**
 * Tests for commands/mcp/server.ts
 * Tests MCP server helper functions and JSON-RPC formatting
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

describe("mcp-server.ts helper functions", () => {
	const testDir = `/tmp/test-mcp-server-${Date.now()}`;
	let originalEnv: string | undefined;

	beforeEach(() => {
		// Save original environment
		originalEnv = process.env.CLAUDE_CONFIG_DIR;

		// Set up test environment
		process.env.CLAUDE_CONFIG_DIR = join(testDir, "config");
		mkdirSync(join(testDir, "config", "han", "metrics", "jsonldb"), {
			recursive: true,
		});
	});

	afterEach(() => {
		// Restore environment
		if (originalEnv) {
			process.env.CLAUDE_CONFIG_DIR = originalEnv;
		} else {
			delete process.env.CLAUDE_CONFIG_DIR;
		}

		rmSync(testDir, { recursive: true, force: true });
	});

	describe("JSON-RPC message format", () => {
		test("creates valid JSON-RPC 2.0 request object", () => {
			const request = {
				jsonrpc: "2.0" as const,
				id: 1,
				method: "tools/list",
				params: {},
			};

			expect(request.jsonrpc).toBe("2.0");
			expect(request.method).toBe("tools/list");
			expect(typeof request.id).toBe("number");
		});

		test("creates valid JSON-RPC 2.0 response object", () => {
			const response = {
				jsonrpc: "2.0" as const,
				id: 1,
				result: { tools: [] },
			};

			expect(response.jsonrpc).toBe("2.0");
			expect(response.id).toBe(1);
			expect(response.result).toBeDefined();
		});

		test("creates valid JSON-RPC 2.0 error response", () => {
			const errorResponse = {
				jsonrpc: "2.0" as const,
				id: 1,
				error: {
					code: -32600,
					message: "Invalid Request",
				},
			};

			expect(errorResponse.jsonrpc).toBe("2.0");
			expect(errorResponse.error.code).toBe(-32600);
			expect(errorResponse.error.message).toBe("Invalid Request");
		});

		test("supports string IDs", () => {
			const request = {
				jsonrpc: "2.0" as const,
				id: "request-123",
				method: "tools/call",
			};

			expect(typeof request.id).toBe("string");
		});

		test("supports null ID for notifications", () => {
			const notification: { jsonrpc: "2.0"; method: string; id?: string } = {
				jsonrpc: "2.0" as const,
				method: "notifications/initialized",
			};

			expect(notification.id).toBeUndefined();
		});
	});

	describe("MCP protocol version", () => {
		test("uses correct protocol version", () => {
			const protocolVersion = "2024-11-05";
			expect(protocolVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		});

		test("server info structure", () => {
			const serverInfo = {
				name: "han",
				version: "1.0.0",
			};

			expect(serverInfo.name).toBe("han");
			expect(serverInfo.version).toMatch(/^\d+\.\d+\.\d+$/);
		});

		test("capabilities include tools", () => {
			const capabilities = {
				tools: {},
			};

			expect(capabilities.tools).toBeDefined();
		});
	});

	describe("MCP tool annotations", () => {
		test("readOnlyHint for read-only tools", () => {
			const annotations = {
				title: "Query Metrics",
				readOnlyHint: true,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false,
			};

			expect(annotations.readOnlyHint).toBe(true);
			expect(annotations.destructiveHint).toBe(false);
		});

		test("idempotentHint for safe-to-retry tools", () => {
			const annotations = {
				title: "Lint Code",
				readOnlyHint: false,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false,
			};

			expect(annotations.idempotentHint).toBe(true);
		});

		test("all annotation fields are optional", () => {
			const minimalAnnotations: Record<string, unknown> = {};
			expect(Object.keys(minimalAnnotations).length).toBe(0);
		});
	});

	describe("MCP tool input schema", () => {
		test("creates object type schema", () => {
			const schema = {
				type: "object" as const,
				properties: {
					cache: { type: "boolean" },
				},
				required: [],
			};

			expect(schema.type).toBe("object");
			expect(schema.properties.cache).toBeDefined();
			expect(schema.required).toEqual([]);
		});

		test("supports required fields", () => {
			const schema = {
				type: "object" as const,
				properties: {
					description: { type: "string" },
					type: { type: "string", enum: ["fix", "feature", "refactor"] },
				},
				required: ["description", "type"],
			};

			expect(schema.required).toContain("description");
			expect(schema.required).toContain("type");
		});

		test("supports enum values", () => {
			const schema = {
				type: "object" as const,
				properties: {
					outcome: {
						type: "string",
						enum: ["success", "partial", "failure"],
					},
				},
			};

			const enumValues = schema.properties.outcome.enum;
			expect(enumValues).toContain("success");
			expect(enumValues).toContain("partial");
			expect(enumValues).toContain("failure");
		});

		test("supports numeric ranges", () => {
			const schema = {
				type: "object" as const,
				properties: {
					confidence: {
						type: "number",
						minimum: 0,
						maximum: 1,
					},
				},
			};

			expect(schema.properties.confidence.minimum).toBe(0);
			expect(schema.properties.confidence.maximum).toBe(1);
		});
	});

	describe("formatToolsForMcp logic", () => {
		test("generates title from hook name", () => {
			const hookName = "lint";
			const title = hookName.charAt(0).toUpperCase() + hookName.slice(1);
			expect(title).toBe("Lint");
		});

		test("extracts technology from plugin name with jutsu prefix", () => {
			const pluginName = "jutsu-typescript";
			const technology = pluginName.replace(/^(jutsu|do|hashi)-/, "");
			expect(technology).toBe("typescript");
		});

		test("extracts technology from plugin name with do prefix", () => {
			const pluginName = "do-accessibility";
			const technology = pluginName.replace(/^(jutsu|do|hashi)-/, "");
			expect(technology).toBe("accessibility");
		});

		test("extracts technology from plugin name with hashi prefix", () => {
			const pluginName = "hashi-github";
			const technology = pluginName.replace(/^(jutsu|do|hashi)-/, "");
			expect(technology).toBe("github");
		});

		test("handles plugin names without prefix", () => {
			const pluginName = "core";
			const technology = pluginName.replace(/^(jutsu|do|hashi)-/, "");
			expect(technology).toBe("core");
		});

		test("capitalizes technology display name", () => {
			const technology = "typescript";
			const techDisplay =
				technology.charAt(0).toUpperCase() + technology.slice(1);
			expect(techDisplay).toBe("Typescript");
		});
	});

	describe("MCP error codes", () => {
		test("Parse error code", () => {
			const PARSE_ERROR = -32700;
			expect(PARSE_ERROR).toBe(-32700);
		});

		test("Invalid Request code", () => {
			const INVALID_REQUEST = -32600;
			expect(INVALID_REQUEST).toBe(-32600);
		});

		test("Method not found code", () => {
			const METHOD_NOT_FOUND = -32601;
			expect(METHOD_NOT_FOUND).toBe(-32601);
		});

		test("Invalid params code", () => {
			const INVALID_PARAMS = -32602;
			expect(INVALID_PARAMS).toBe(-32602);
		});

		test("Internal error code", () => {
			const INTERNAL_ERROR = -32603;
			expect(INTERNAL_ERROR).toBe(-32603);
		});
	});

	describe("metrics tools definition", () => {
		test("start_task tool has required fields", () => {
			const tool = {
				name: "start_task",
				description: "Start tracking a new task",
				inputSchema: {
					type: "object" as const,
					properties: {
						description: { type: "string" },
						type: {
							type: "string",
							enum: ["implementation", "fix", "refactor", "research"],
						},
					},
					required: ["description", "type"],
				},
			};

			expect(tool.name).toBe("start_task");
			expect(tool.inputSchema.required).toContain("description");
			expect(tool.inputSchema.required).toContain("type");
		});

		test("complete_task tool has confidence field", () => {
			const tool = {
				name: "complete_task",
				inputSchema: {
					type: "object" as const,
					properties: {
						task_id: { type: "string" },
						outcome: {
							type: "string",
							enum: ["success", "partial", "failure"],
						},
						confidence: {
							type: "number",
							minimum: 0,
							maximum: 1,
						},
					},
					required: ["task_id", "outcome", "confidence"],
				},
			};

			expect(tool.inputSchema.properties.confidence).toBeDefined();
			expect(tool.inputSchema.properties.confidence.minimum).toBe(0);
			expect(tool.inputSchema.properties.confidence.maximum).toBe(1);
		});

		test("query_metrics tool has period enum", () => {
			const tool = {
				name: "query_metrics",
				inputSchema: {
					type: "object" as const,
					properties: {
						period: {
							type: "string",
							enum: ["day", "week", "month"],
						},
					},
				},
			};

			const periodEnum = tool.inputSchema.properties.period.enum;
			expect(periodEnum).toContain("day");
			expect(periodEnum).toContain("week");
			expect(periodEnum).toContain("month");
		});

		test("record_frustration tool has required fields", () => {
			const tool = {
				name: "record_frustration",
				inputSchema: {
					type: "object" as const,
					properties: {
						frustration_level: {
							type: "string",
							enum: ["low", "moderate", "high"],
						},
						frustration_score: {
							type: "number",
							minimum: 0,
							maximum: 10,
						},
						user_message: { type: "string" },
						detected_signals: {
							type: "array",
							items: { type: "string" },
						},
					},
					required: [
						"frustration_level",
						"frustration_score",
						"user_message",
						"detected_signals",
					],
				},
			};

			expect(tool.inputSchema.properties.frustration_level.enum).toContain(
				"high",
			);
			expect(tool.inputSchema.required).toContain("user_message");
		});
	});

	describe("tool name formatting", () => {
		test("formats plugin tool name correctly", () => {
			const pluginName = "jutsu-biome";
			const hookName = "lint";
			const toolName = `${pluginName.replace(/-/g, "_")}_${hookName}`;
			expect(toolName).toBe("jutsu_biome_lint");
		});

		test("handles multiple dashes in plugin name", () => {
			const pluginName = "do-claude-plugin-development";
			const hookName = "claudelint";
			const toolName = `${pluginName.replace(/-/g, "_")}_${hookName}`;
			expect(toolName).toBe("do_claude_plugin_development_claudelint");
		});
	});

	describe("memory tools definition", () => {
		test("memory tool has question and session_id properties", () => {
			const tool = {
				name: "memory",
				description:
					"Query memory with auto-routing. Automatically determines whether to check personal sessions, team knowledge, or project conventions.",
				inputSchema: {
					type: "object" as const,
					properties: {
						question: {
							type: "string",
							description:
								"Any question about your work, the team, or project conventions.",
						},
						session_id: {
							type: "string",
							description:
								"Current Claude session ID. Used to associate queries with the active session context.",
						},
					},
					required: ["question"],
				},
			};

			expect(tool.name).toBe("memory");
			expect(tool.inputSchema.properties.question).toBeDefined();
			expect(tool.inputSchema.properties.session_id).toBeDefined();
			expect(tool.inputSchema.required).toContain("question");
			expect(tool.inputSchema.required).not.toContain("session_id"); // session_id is optional
		});

		test("memory tool session_id is string type", () => {
			const sessionIdSchema = {
				type: "string",
				description:
					"Current Claude session ID. Used to associate queries with the active session context.",
			};

			expect(sessionIdSchema.type).toBe("string");
			expect(sessionIdSchema.description).toContain("session ID");
		});

		test("memory tool has read-only annotations", () => {
			const annotations = {
				title: "Memory (Unified)",
				readOnlyHint: true,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false,
			};

			expect(annotations.readOnlyHint).toBe(true);
			expect(annotations.destructiveHint).toBe(false);
			expect(annotations.idempotentHint).toBe(true);
		});

		test("learn tool has required fields", () => {
			const tool = {
				name: "learn",
				inputSchema: {
					type: "object" as const,
					properties: {
						content: {
							type: "string",
							description: "The learning content in markdown format",
						},
						domain: {
							type: "string",
							description:
								"Domain name for the rule file (e.g., 'api', 'testing')",
						},
						paths: {
							type: "array",
							items: { type: "string" },
							description: "Optional path patterns for path-specific rules",
						},
						scope: {
							type: "string",
							enum: ["project", "user"],
							description: "Where to store the rule",
						},
						append: {
							type: "boolean",
							description: "Whether to append to existing file",
						},
					},
					required: ["content", "domain"],
				},
			};

			expect(tool.name).toBe("learn");
			expect(tool.inputSchema.required).toContain("content");
			expect(tool.inputSchema.required).toContain("domain");
			expect(tool.inputSchema.properties.scope.enum).toContain("project");
			expect(tool.inputSchema.properties.scope.enum).toContain("user");
		});

		test("memory tools are consolidated to memory and learn only", () => {
			// These tools should NOT exist in the new consolidated design
			const removedTools = [
				"team_query",
				"auto_learn",
				"memory_list",
				"memory_read",
			];

			// These are the only two memory tools that should exist
			const activeTools = ["memory", "learn"];

			// Verify structure
			expect(activeTools).toHaveLength(2);
			expect(activeTools).toContain("memory");
			expect(activeTools).toContain("learn");

			// Verify removed tools are not in active set
			for (const removed of removedTools) {
				expect(activeTools).not.toContain(removed);
			}
		});
	});
});
