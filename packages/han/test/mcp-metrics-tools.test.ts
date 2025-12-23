/**
 * Unit tests for MCP metrics tools
 * Tests the JSON-RPC 2.0 MCP server implementation for metrics tracking
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	handleToolsCall,
	handleToolsList,
	METRICS_TOOLS,
	resetMetricsStorage,
} from "../lib/commands/mcp/metrics.ts";

// Store original environment
const originalEnv = { ...process.env };

let testDir: string;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	testDir = join(tmpdir(), `han-mcp-metrics-test-${Date.now()}-${random}`);
	mkdirSync(testDir, { recursive: true });
	process.env.CLAUDE_CONFIG_DIR = testDir;
	// Ensure PROJECT_DIR is set for config loading
	process.env.CLAUDE_PROJECT_DIR = testDir;
}

function teardown(): void {
	// Reset storage singleton to release file handles before cleanup
	resetMetricsStorage();

	process.env = { ...originalEnv };

	if (testDir) {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
}

/**
 * Helper to enable metrics via han.yml config
 */
function enableMetrics(): void {
	mkdirSync(join(testDir, ".claude"), { recursive: true });
	writeFileSync(
		join(testDir, ".claude", "han.yml"),
		"metrics:\n  enabled: true\n",
	);
}

/**
 * Helper to disable metrics via han.yml config
 */
function disableMetrics(): void {
	mkdirSync(join(testDir, ".claude"), { recursive: true });
	writeFileSync(
		join(testDir, ".claude", "han.yml"),
		"metrics:\n  enabled: false\n",
	);
}

/**
 * Helper to parse content from MCP tool response
 */
function parseToolResponse(response: unknown): unknown {
	const res = response as { content: Array<{ type: string; text: string }> };
	if (res.content?.[0]?.type === "text") {
		return JSON.parse(res.content[0].text);
	}
	return null;
}

/**
 * Helper to get error flag from response
 */
function isErrorResponse(response: unknown): boolean {
	return !!(response as { isError?: boolean }).isError;
}

/**
 * Helper to get text content from response
 */
function getTextContent(response: unknown): string {
	const res = response as { content: Array<{ type: string; text: string }> };
	return res.content?.[0]?.text ?? "";
}

describe.serial("MCP Metrics Tools", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	describe("handleToolsList", () => {
		test("returns all metrics tools when metrics is enabled", () => {
			enableMetrics();

			const result = handleToolsList() as { tools: Array<{ name: string }> };

			expect(result.tools).toBeDefined();
			expect(Array.isArray(result.tools)).toBe(true);
			expect(result.tools.length).toBe(METRICS_TOOLS.length);

			// Verify all expected tool names are present
			const toolNames = result.tools.map((t): string => t.name);
			expect(toolNames).toContain("start_task");
			expect(toolNames).toContain("update_task");
			expect(toolNames).toContain("complete_task");
			expect(toolNames).toContain("fail_task");
			expect(toolNames).toContain("query_metrics");
			expect(toolNames).toContain("query_hook_metrics");
			expect(toolNames).toContain("query_session_metrics");
		});

		test("returns empty tools array when metrics is disabled", () => {
			disableMetrics();

			const result = handleToolsList() as { tools: unknown[] };

			expect(result.tools).toBeDefined();
			expect(Array.isArray(result.tools)).toBe(true);
			expect(result.tools.length).toBe(0);
		});

		test("tools have correct schema structure", () => {
			enableMetrics();

			const result = handleToolsList() as {
				tools: Array<{
					name: string;
					description: string;
					inputSchema: {
						type: string;
						properties: Record<string, unknown>;
						required?: string[];
					};
				}>;
			};

			for (const tool of result.tools) {
				expect(typeof tool.name).toBe("string");
				expect(typeof tool.description).toBe("string");
				expect(tool.inputSchema).toBeDefined();
				expect(tool.inputSchema.type).toBe("object");
				expect(typeof tool.inputSchema.properties).toBe("object");
			}
		});
	});

	describe("start_task Tool", () => {
		test("creates a new task and returns task_id", async () => {
			enableMetrics();

			const response = await handleToolsCall({
				name: "start_task",
				arguments: {
					description: "Implement new feature",
					type: "implementation",
					session_id: "test-session-123",
				},
			});

			expect(isErrorResponse(response)).toBe(false);

			const result = parseToolResponse(response) as { task_id: string };
			expect(result.task_id).toBeDefined();
			expect(result.task_id.startsWith("task-")).toBe(true);
		});

		test("creates task with optional estimated_complexity", async () => {
			enableMetrics();

			const response = await handleToolsCall({
				name: "start_task",
				arguments: {
					description: "Complex refactoring",
					type: "refactor",
					estimated_complexity: "complex",
					session_id: "test-session-456",
				},
			});

			expect(isErrorResponse(response)).toBe(false);

			const result = parseToolResponse(response) as { task_id: string };
			expect(result.task_id).toBeDefined();
		});

		test("returns error when metrics is disabled", async () => {
			disableMetrics();

			const response = await handleToolsCall({
				name: "start_task",
				arguments: {
					description: "Test task",
					type: "fix",
					session_id: "test-session",
				},
			});

			expect(isErrorResponse(response)).toBe(true);
			expect(getTextContent(response)).toContain(
				"Metrics tracking is disabled",
			);
		});
	});

	describe("update_task Tool", () => {
		test("updates task with status and notes", async () => {
			enableMetrics();

			// First create a task
			const createResponse = await handleToolsCall({
				name: "start_task",
				arguments: {
					description: "Task to update",
					type: "implementation",
					session_id: "test-session",
				},
			});
			const created = parseToolResponse(createResponse) as { task_id: string };

			// Then update it
			const response = await handleToolsCall({
				name: "update_task",
				arguments: {
					task_id: created.task_id,
					status: "in_progress",
					notes: "Halfway done with implementation",
				},
			});

			expect(isErrorResponse(response)).toBe(false);
			const result = parseToolResponse(response) as { success: boolean };
			expect(result.success).toBe(true);
		});

		test("updates task with only notes", async () => {
			enableMetrics();

			const createResponse = await handleToolsCall({
				name: "start_task",
				arguments: {
					description: "Another task",
					type: "fix",
					session_id: "test-session",
				},
			});
			const created = parseToolResponse(createResponse) as { task_id: string };

			const response = await handleToolsCall({
				name: "update_task",
				arguments: {
					task_id: created.task_id,
					notes: "Found the root cause",
				},
			});

			expect(isErrorResponse(response)).toBe(false);
		});
	});

	describe("complete_task Tool", () => {
		test("completes task with success outcome", async () => {
			enableMetrics();

			// Create task
			const createResponse = await handleToolsCall({
				name: "start_task",
				arguments: {
					description: "Task to complete",
					type: "implementation",
					session_id: "test-session",
				},
			});
			const created = parseToolResponse(createResponse) as { task_id: string };

			// Complete it
			const response = await handleToolsCall({
				name: "complete_task",
				arguments: {
					task_id: created.task_id,
					outcome: "success",
					confidence: 0.9,
				},
			});

			expect(isErrorResponse(response)).toBe(false);
			const result = parseToolResponse(response) as { success: boolean };
			expect(result.success).toBe(true);
		});

		test("completes task with partial outcome and files_modified", async () => {
			enableMetrics();

			const createResponse = await handleToolsCall({
				name: "start_task",
				arguments: {
					description: "Partial completion task",
					type: "refactor",
					session_id: "test-session",
				},
			});
			const created = parseToolResponse(createResponse) as { task_id: string };

			const response = await handleToolsCall({
				name: "complete_task",
				arguments: {
					task_id: created.task_id,
					outcome: "partial",
					confidence: 0.7,
					files_modified: ["src/main.ts", "src/utils.ts"],
					tests_added: 3,
					notes: "Core functionality done, edge cases pending",
				},
			});

			expect(isErrorResponse(response)).toBe(false);
		});

		test("completes task with failure outcome", async () => {
			enableMetrics();

			const createResponse = await handleToolsCall({
				name: "start_task",
				arguments: {
					description: "Task that failed",
					type: "fix",
					session_id: "test-session",
				},
			});
			const created = parseToolResponse(createResponse) as { task_id: string };

			const response = await handleToolsCall({
				name: "complete_task",
				arguments: {
					task_id: created.task_id,
					outcome: "failure",
					confidence: 0.4,
				},
			});

			expect(isErrorResponse(response)).toBe(false);
		});
	});

	describe("fail_task Tool", () => {
		test("fails task with reason", async () => {
			enableMetrics();

			const createResponse = await handleToolsCall({
				name: "start_task",
				arguments: {
					description: "Task that will fail",
					type: "research",
					session_id: "test-session",
				},
			});
			const created = parseToolResponse(createResponse) as { task_id: string };

			const response = await handleToolsCall({
				name: "fail_task",
				arguments: {
					task_id: created.task_id,
					reason: "Unable to find solution in documentation",
				},
			});

			expect(isErrorResponse(response)).toBe(false);
			const result = parseToolResponse(response) as { success: boolean };
			expect(result.success).toBe(true);
		});

		test("fails task with attempted solutions", async () => {
			enableMetrics();

			const createResponse = await handleToolsCall({
				name: "start_task",
				arguments: {
					description: "Complex debugging task",
					type: "fix",
					session_id: "test-session",
				},
			});
			const created = parseToolResponse(createResponse) as { task_id: string };

			const response = await handleToolsCall({
				name: "fail_task",
				arguments: {
					task_id: created.task_id,
					reason: "Type errors persist",
					confidence: 0.6,
					attempted_solutions: [
						"Try type assertion",
						"Use generic constraints",
						"Cast to any",
					],
					notes: "Need user guidance on correct approach",
				},
			});

			expect(isErrorResponse(response)).toBe(false);
		});
	});

	describe("query_metrics Tool", () => {
		test("queries metrics without filters", async () => {
			enableMetrics();

			// Create and complete a few tasks
			for (let i = 0; i < 3; i++) {
				const createResponse = await handleToolsCall({
					name: "start_task",
					arguments: {
						description: `Task ${i + 1}`,
						type: "implementation",
						session_id: "test-session",
					},
				});
				const created = parseToolResponse(createResponse) as {
					task_id: string;
				};
				await handleToolsCall({
					name: "complete_task",
					arguments: {
						task_id: created.task_id,
						outcome: i === 0 ? "failure" : "success",
						confidence: 0.8,
					},
				});
			}

			const response = await handleToolsCall({
				name: "query_metrics",
				arguments: {},
			});

			expect(isErrorResponse(response)).toBe(false);
			const result = parseToolResponse(response) as {
				total_tasks: number;
				success_rate: number;
			};
			expect(result.total_tasks).toBe(3);
		});

		test("queries metrics with period filter", async () => {
			enableMetrics();

			// Create a task
			const createResponse = await handleToolsCall({
				name: "start_task",
				arguments: {
					description: "Recent task",
					type: "fix",
					session_id: "test-session",
				},
			});
			const created = parseToolResponse(createResponse) as { task_id: string };
			await handleToolsCall({
				name: "complete_task",
				arguments: {
					task_id: created.task_id,
					outcome: "success",
					confidence: 0.9,
				},
			});

			const response = await handleToolsCall({
				name: "query_metrics",
				arguments: {
					period: "day",
				},
			});

			expect(isErrorResponse(response)).toBe(false);
			const result = parseToolResponse(response) as { total_tasks: number };
			expect(result.total_tasks).toBeGreaterThanOrEqual(1);
		});

		test("queries metrics with task_type filter", async () => {
			enableMetrics();

			// Create tasks of different types
			const types = ["implementation", "fix", "refactor"];
			for (const type of types) {
				const createResponse = await handleToolsCall({
					name: "start_task",
					arguments: {
						description: `${type} task`,
						type,
						session_id: "test-session",
					},
				});
				const created = parseToolResponse(createResponse) as {
					task_id: string;
				};
				await handleToolsCall({
					name: "complete_task",
					arguments: {
						task_id: created.task_id,
						outcome: "success",
						confidence: 0.85,
					},
				});
			}

			const response = await handleToolsCall({
				name: "query_metrics",
				arguments: {
					task_type: "implementation",
				},
			});

			expect(isErrorResponse(response)).toBe(false);
			const result = parseToolResponse(response) as { total_tasks: number };
			expect(result.total_tasks).toBeGreaterThanOrEqual(1);
		});

		test("queries metrics with outcome filter", async () => {
			enableMetrics();

			// Create tasks with different outcomes
			const outcomes = ["success", "failure", "partial"];
			for (const outcome of outcomes) {
				const createResponse = await handleToolsCall({
					name: "start_task",
					arguments: {
						description: `${outcome} task`,
						type: "fix",
						session_id: "test-session",
					},
				});
				const created = parseToolResponse(createResponse) as {
					task_id: string;
				};
				await handleToolsCall({
					name: "complete_task",
					arguments: {
						task_id: created.task_id,
						outcome,
						confidence: 0.7,
					},
				});
			}

			const response = await handleToolsCall({
				name: "query_metrics",
				arguments: {
					outcome: "success",
				},
			});

			expect(isErrorResponse(response)).toBe(false);
		});
	});

	describe("query_hook_metrics Tool", () => {
		test("queries hook metrics with default period", async () => {
			enableMetrics();

			const response = await handleToolsCall({
				name: "query_hook_metrics",
				arguments: {},
			});

			expect(isErrorResponse(response)).toBe(false);
			const result = parseToolResponse(response) as {
				hooks: unknown[];
				period: string;
				total_hooks: number;
			};
			expect(result.period).toBe("week");
			expect(Array.isArray(result.hooks)).toBe(true);
		});

		test("queries hook metrics with period filter", async () => {
			enableMetrics();

			const response = await handleToolsCall({
				name: "query_hook_metrics",
				arguments: {
					period: "day",
				},
			});

			expect(isErrorResponse(response)).toBe(false);
			const result = parseToolResponse(response) as { period: string };
			expect(result.period).toBe("day");
		});

		test("queries hook metrics with hook_name filter", async () => {
			enableMetrics();

			const response = await handleToolsCall({
				name: "query_hook_metrics",
				arguments: {
					hook_name: "typescript-typecheck",
				},
			});

			expect(isErrorResponse(response)).toBe(false);
		});

		test("queries hook metrics with min_failure_rate filter", async () => {
			enableMetrics();

			const response = await handleToolsCall({
				name: "query_hook_metrics",
				arguments: {
					min_failure_rate: 50,
				},
			});

			expect(isErrorResponse(response)).toBe(false);
		});
	});

	describe("query_session_metrics Tool", () => {
		test("queries session metrics with default parameters", async () => {
			enableMetrics();

			const response = await handleToolsCall({
				name: "query_session_metrics",
				arguments: {},
			});

			expect(isErrorResponse(response)).toBe(false);
			const result = parseToolResponse(response) as {
				sessions: unknown[];
				trends: unknown;
			};
			expect(Array.isArray(result.sessions)).toBe(true);
			expect(result.trends).toBeDefined();
		});

		test("queries session metrics with period filter", async () => {
			enableMetrics();

			const response = await handleToolsCall({
				name: "query_session_metrics",
				arguments: {
					period: "month",
				},
			});

			expect(isErrorResponse(response)).toBe(false);
		});

		test("queries session metrics with limit", async () => {
			enableMetrics();

			const response = await handleToolsCall({
				name: "query_session_metrics",
				arguments: {
					limit: 5,
				},
			});

			expect(isErrorResponse(response)).toBe(false);
			const result = parseToolResponse(response) as { sessions: unknown[] };
			// With limit 5, we expect at most 5 sessions
			expect(result.sessions.length).toBeLessThanOrEqual(5);
		});
	});

	describe("Error Handling", () => {
		test("returns error for unknown tool name", async () => {
			enableMetrics();

			const response = await handleToolsCall({
				name: "unknown_tool",
				arguments: {},
			});

			expect(isErrorResponse(response)).toBe(true);
			// The error message includes the tool name in the format: "Error executing unknown_tool: ..."
			expect(getTextContent(response)).toContain(
				"Error executing unknown_tool",
			);
		});

		test("handles missing arguments gracefully", async () => {
			enableMetrics();

			// update_task with only task_id should work (status and notes are optional)
			const createResponse = await handleToolsCall({
				name: "start_task",
				arguments: {
					description: "Test task",
					type: "fix",
					session_id: "test-session",
				},
			});
			const created = parseToolResponse(createResponse) as { task_id: string };

			const response = await handleToolsCall({
				name: "update_task",
				arguments: {
					task_id: created.task_id,
				},
			});

			expect(isErrorResponse(response)).toBe(false);
		});

		test("handles completing non-existent task", async () => {
			enableMetrics();

			const response = await handleToolsCall({
				name: "complete_task",
				arguments: {
					task_id: "nonexistent-task-id",
					outcome: "success",
					confidence: 0.9,
				},
			});

			// Storage handles this gracefully
			expect(isErrorResponse(response)).toBe(false);
		});

		test("handles failing non-existent task", async () => {
			enableMetrics();

			const response = await handleToolsCall({
				name: "fail_task",
				arguments: {
					task_id: "nonexistent-task-id",
					reason: "Task not found",
				},
			});

			// Storage handles this gracefully
			expect(isErrorResponse(response)).toBe(false);
		});

		test("all tools blocked when metrics disabled", async () => {
			disableMetrics();

			const tools = [
				{
					name: "start_task",
					arguments: { description: "x", type: "fix", session_id: "s" },
				},
				{ name: "update_task", arguments: { task_id: "x" } },
				{
					name: "complete_task",
					arguments: { task_id: "x", outcome: "success", confidence: 0.9 },
				},
				{ name: "fail_task", arguments: { task_id: "x", reason: "r" } },
				{ name: "query_metrics", arguments: {} },
				{ name: "query_hook_metrics", arguments: {} },
				{ name: "query_session_metrics", arguments: {} },
			];

			for (const tool of tools) {
				const response = await handleToolsCall(tool);
				expect(isErrorResponse(response)).toBe(true);
				expect(getTextContent(response)).toContain(
					"Metrics tracking is disabled",
				);
			}
		});
	});

	describe("Tool Schema Validation", () => {
		test("start_task has required fields in schema", () => {
			const tool = METRICS_TOOLS.find((t) => t.name === "start_task");
			expect(tool).toBeDefined();
			expect(tool?.inputSchema.required).toContain("description");
			expect(tool?.inputSchema.required).toContain("type");
			expect(tool?.inputSchema.required).toContain("session_id");
		});

		test("update_task has task_id required", () => {
			const tool = METRICS_TOOLS.find((t) => t.name === "update_task");
			expect(tool).toBeDefined();
			expect(tool?.inputSchema.required).toContain("task_id");
		});

		test("complete_task has required fields", () => {
			const tool = METRICS_TOOLS.find((t) => t.name === "complete_task");
			expect(tool).toBeDefined();
			expect(tool?.inputSchema.required).toContain("task_id");
			expect(tool?.inputSchema.required).toContain("outcome");
			expect(tool?.inputSchema.required).toContain("confidence");
		});

		test("fail_task has required fields", () => {
			const tool = METRICS_TOOLS.find((t) => t.name === "fail_task");
			expect(tool).toBeDefined();
			expect(tool?.inputSchema.required).toContain("task_id");
			expect(tool?.inputSchema.required).toContain("reason");
		});

		test("query tools have optional parameters only", () => {
			const queryTools = [
				"query_metrics",
				"query_hook_metrics",
				"query_session_metrics",
			];
			for (const toolName of queryTools) {
				const tool = METRICS_TOOLS.find((t) => t.name === toolName);
				expect(tool).toBeDefined();
				// Query tools should not have required parameters
				expect(tool?.inputSchema.required ?? []).toEqual([]);
			}
		});

		test("tools have proper annotations", () => {
			for (const tool of METRICS_TOOLS) {
				expect(tool.annotations).toBeDefined();

				// Query tools should be readOnlyHint: true
				if (tool.name.startsWith("query_")) {
					expect(tool.annotations?.readOnlyHint).toBe(true);
				} else {
					// Mutation tools should be readOnlyHint: false
					expect(tool.annotations?.readOnlyHint).toBe(false);
				}

				// None should be destructive
				expect(tool.annotations?.destructiveHint).toBe(false);
			}
		});
	});

	describe("Integration Scenarios", () => {
		test("full task lifecycle: start, update, complete", async () => {
			enableMetrics();

			// Start task
			const startResponse = await handleToolsCall({
				name: "start_task",
				arguments: {
					description: "Implement user authentication",
					type: "implementation",
					estimated_complexity: "complex",
					session_id: "integration-test-session",
				},
			});
			const started = parseToolResponse(startResponse) as { task_id: string };
			expect(started.task_id).toBeDefined();

			// Update progress
			await handleToolsCall({
				name: "update_task",
				arguments: {
					task_id: started.task_id,
					status: "in_progress",
					notes: "Started working on JWT implementation",
				},
			});

			await handleToolsCall({
				name: "update_task",
				arguments: {
					task_id: started.task_id,
					notes: "JWT tokens working, now adding refresh logic",
				},
			});

			// Complete task
			const completeResponse = await handleToolsCall({
				name: "complete_task",
				arguments: {
					task_id: started.task_id,
					outcome: "success",
					confidence: 0.85,
					files_modified: ["src/auth/jwt.ts", "src/auth/refresh.ts"],
					tests_added: 5,
					notes: "All tests passing, authentication fully implemented",
				},
			});
			const completed = parseToolResponse(completeResponse) as {
				success: boolean;
			};
			expect(completed.success).toBe(true);

			// Query to verify
			const queryResponse = await handleToolsCall({
				name: "query_metrics",
				arguments: {},
			});
			const metrics = parseToolResponse(queryResponse) as {
				total_tasks: number;
				tasks: Array<{ id: string; status: string }>;
			};
			expect(metrics.total_tasks).toBeGreaterThanOrEqual(1);
		});

		test("multiple tasks with different outcomes", async () => {
			enableMetrics();

			// Create successful task
			const task1Response = await handleToolsCall({
				name: "start_task",
				arguments: {
					description: "Add logging",
					type: "implementation",
					session_id: "multi-task-session",
				},
			});
			const task1 = parseToolResponse(task1Response) as { task_id: string };
			await handleToolsCall({
				name: "complete_task",
				arguments: {
					task_id: task1.task_id,
					outcome: "success",
					confidence: 0.9,
				},
			});

			// Create partial task
			const task2Response = await handleToolsCall({
				name: "start_task",
				arguments: {
					description: "Improve error handling",
					type: "refactor",
					session_id: "multi-task-session",
				},
			});
			const task2 = parseToolResponse(task2Response) as { task_id: string };
			await handleToolsCall({
				name: "complete_task",
				arguments: {
					task_id: task2.task_id,
					outcome: "partial",
					confidence: 0.7,
				},
			});

			// Create failed task
			const task3Response = await handleToolsCall({
				name: "start_task",
				arguments: {
					description: "Migrate database",
					type: "fix",
					session_id: "multi-task-session",
				},
			});
			const task3 = parseToolResponse(task3Response) as { task_id: string };
			await handleToolsCall({
				name: "fail_task",
				arguments: {
					task_id: task3.task_id,
					reason: "Connection timeout",
					attempted_solutions: ["Retry connection", "Increase timeout"],
				},
			});

			// Query all metrics
			const allMetrics = await handleToolsCall({
				name: "query_metrics",
				arguments: {},
			});
			const result = parseToolResponse(allMetrics) as {
				total_tasks: number;
				by_outcome: Record<string, number>;
			};
			expect(result.total_tasks).toBeGreaterThanOrEqual(3);
		});
	});
});
