import { describe, expect, it } from "bun:test";
import type {
	BackendCapability,
	McpServerConfig as HanMcpServerConfig,
} from "../lib/commands/mcp/capability-registry.ts";
import {
	buildAllowedTools,
	buildMcpServers,
	generateAgentPrompt,
	type WorkflowOptions,
	type WorkflowResult,
} from "../lib/commands/mcp/workflow-agent.ts";

// Helper to create test BackendCapability
function createBackend(
	serverId: string,
	options: Partial<BackendCapability> = {},
): BackendCapability {
	const defaultServerConfig: HanMcpServerConfig = {
		pluginName: options.pluginName || `hashi-${serverId}`,
		serverName: serverId,
		description: options.summary || `${serverId} integration`,
		command: "npx",
		args: ["-y", `@mcp/server-${serverId}`],
	};

	return {
		pluginName: `hashi-${serverId}`,
		serverId,
		serverConfig: options.serverConfig || defaultServerConfig,
		category: "Other",
		summary: `${serverId} integration`,
		keywords: [serverId],
		examples: [`Use ${serverId} for testing`],
		...options,
	};
}

describe("workflow-agent", () => {
	describe("generateAgentPrompt", () => {
		it("should generate prompt with backend descriptions", () => {
			const backends = [
				createBackend("github", { summary: "GitHub PRs and issues" }),
				createBackend("playwright", { summary: "Browser automation" }),
			];

			const prompt = generateAgentPrompt("Create a PR", backends);

			expect(prompt).toContain("workflow agent");
			expect(prompt).toContain("github: GitHub PRs and issues");
			expect(prompt).toContain("playwright: Browser automation");
			expect(prompt).toContain("Create a PR");
		});

		it("should include task section with intent", () => {
			const backends = [createBackend("github")];
			const intent = "Create a PR for the bug fix";

			const prompt = generateAgentPrompt(intent, backends);

			expect(prompt).toContain("## Task");
			expect(prompt).toContain(intent);
		});

		it("should handle empty backends", () => {
			const prompt = generateAgentPrompt("Test intent", []);

			expect(prompt).toContain("workflow agent");
			expect(prompt).toContain("Test intent");
		});
	});

	describe("buildMcpServers", () => {
		it("should build stdio server config", () => {
			const backends = [
				createBackend("github", {
					serverConfig: {
						pluginName: "hashi-github",
						serverName: "github",
						description: "GitHub integration",
						command: "npx",
						args: ["-y", "@mcp/server-github"],
						env: { GITHUB_TOKEN: "test-token" },
					},
				}),
			];

			const servers = buildMcpServers(backends);

			expect(servers.github).toBeDefined();
			// Use type assertion to access stdio-specific properties
			const githubConfig = servers.github as {
				command: string;
				args?: string[];
				env?: Record<string, string>;
			};
			expect(githubConfig.command).toBe("npx");
			expect(githubConfig.args).toEqual(["-y", "@mcp/server-github"]);
			expect(githubConfig.env).toEqual({ GITHUB_TOKEN: "test-token" });
		});

		it("should build HTTP server config", () => {
			const backends = [
				createBackend("api", {
					serverConfig: {
						pluginName: "hashi-api",
						serverName: "api",
						description: "API integration",
						type: "http",
						url: "https://api.example.com/mcp",
					},
				}),
			];

			const servers = buildMcpServers(backends);

			expect(servers.api).toBeDefined();
			// Use type assertion to access http-specific properties
			const apiConfig = servers.api as { type: string; url: string };
			expect(apiConfig.type).toBe("http");
			expect(apiConfig.url).toBe("https://api.example.com/mcp");
		});

		it("should skip backends without command or URL", () => {
			const backends = [
				createBackend("incomplete", {
					serverConfig: {
						pluginName: "hashi-incomplete",
						serverName: "incomplete",
						description: "Missing config",
						// No command or URL
					},
				}),
			];

			const servers = buildMcpServers(backends);

			expect(Object.keys(servers)).toHaveLength(0);
		});

		it("should handle multiple backends", () => {
			const backends = [
				createBackend("github", {
					serverConfig: {
						pluginName: "hashi-github",
						serverName: "github",
						description: "GitHub",
						command: "npx",
						args: ["-y", "@mcp/server-github"],
					},
				}),
				createBackend("playwright", {
					serverConfig: {
						pluginName: "hashi-playwright",
						serverName: "playwright",
						description: "Playwright",
						command: "npx",
						args: ["-y", "@playwright/mcp"],
					},
				}),
			];

			const servers = buildMcpServers(backends);

			expect(Object.keys(servers)).toHaveLength(2);
			expect(servers.github).toBeDefined();
			expect(servers.playwright).toBeDefined();
		});
	});

	describe("buildAllowedTools", () => {
		it("should create wildcard patterns for each backend", () => {
			const backends = [createBackend("github"), createBackend("playwright")];

			const patterns = buildAllowedTools(backends);

			expect(patterns).toContain("mcp__github__*");
			expect(patterns).toContain("mcp__playwright__*");
		});

		it("should handle empty backends", () => {
			const patterns = buildAllowedTools([]);

			expect(patterns).toEqual([]);
		});

		it("should use server ID for pattern", () => {
			const backends = [
				createBackend("custom-server", {
					serverId: "my-server",
				}),
			];

			const patterns = buildAllowedTools(backends);

			expect(patterns).toContain("mcp__my-server__*");
		});
	});

	describe("WorkflowOptions interface", () => {
		it("should support sessionId for workflow continuity", () => {
			const options: WorkflowOptions = {
				sessionId: "test-session-123",
			};

			expect(options.sessionId).toBe("test-session-123");
		});

		it("should support fork option for creating new session from existing", () => {
			const options: WorkflowOptions = {
				sessionId: "main-session-456",
				fork: true,
			};

			expect(options.sessionId).toBe("main-session-456");
			expect(options.fork).toBe(true);
		});

		it("should allow all options together", () => {
			const options: WorkflowOptions = {
				maxTurns: 10,
				model: "sonnet",
				streamProgress: true,
				onProgress: () => {},
				sessionId: "workflow-session",
				fork: false,
			};

			expect(options.maxTurns).toBe(10);
			expect(options.model).toBe("sonnet");
			expect(options.sessionId).toBe("workflow-session");
			expect(options.fork).toBe(false);
		});
	});

	describe("WorkflowResult interface", () => {
		it("should include sessionId for workflow continuity", () => {
			const result: WorkflowResult = {
				success: true,
				summary: "Workflow completed",
				backendsUsed: ["github"],
				toolsInvoked: ["mcp__github__create_pr"],
				sessionId: "result-session-789",
			};

			expect(result.sessionId).toBe("result-session-789");
		});

		it("should allow sessionId to be undefined", () => {
			const result: WorkflowResult = {
				success: true,
				summary: "Workflow completed",
				backendsUsed: [],
				toolsInvoked: [],
			};

			expect(result.sessionId).toBeUndefined();
		});

		it("should include sessionId even on failure", () => {
			const result: WorkflowResult = {
				success: false,
				summary: "Workflow failed",
				backendsUsed: ["github"],
				toolsInvoked: [],
				error: "Connection failed",
				sessionId: "failed-session-abc",
			};

			expect(result.success).toBe(false);
			expect(result.sessionId).toBe("failed-session-abc");
			expect(result.error).toBe("Connection failed");
		});
	});
});
