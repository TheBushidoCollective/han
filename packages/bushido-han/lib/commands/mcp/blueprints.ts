import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

interface JsonRpcRequest {
	jsonrpc: "2.0";
	id?: string | number;
	method: string;
	params?: Record<string, unknown>;
}

interface JsonRpcResponse {
	jsonrpc: "2.0";
	id?: string | number;
	result?: unknown;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
}

interface McpToolAnnotations {
	title?: string;
	readOnlyHint?: boolean;
	destructiveHint?: boolean;
	idempotentHint?: boolean;
	openWorldHint?: boolean;
}

interface McpTool {
	name: string;
	description: string;
	annotations?: McpToolAnnotations;
	inputSchema: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
}

interface BlueprintMetadata {
	name: string;
	summary: string;
}

interface Blueprint extends BlueprintMetadata {
	content: string;
}

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

/**
 * Find the blueprints directory in the current repository
 */
function getBlueprintsDir(): string | null {
	const cwd = process.cwd();
	const blueprintsPath = join(cwd, "blueprints");

	if (existsSync(blueprintsPath)) {
		return blueprintsPath;
	}

	return null;
}

/**
 * Parse frontmatter from blueprint markdown
 */
function parseFrontmatter(content: string): {
	metadata: BlueprintMetadata | null;
	content: string;
} {
	const match = content.match(FRONTMATTER_REGEX);

	if (!match) {
		return { metadata: null, content };
	}

	const frontmatterText = match[1];
	const bodyContent = match[2];

	// Parse YAML frontmatter (simple key-value pairs)
	const metadata: Partial<BlueprintMetadata> = {};
	for (const line of frontmatterText.split("\n")) {
		const colonIndex = line.indexOf(":");
		if (colonIndex === -1) continue;

		const key = line.slice(0, colonIndex).trim();
		const value = line.slice(colonIndex + 1).trim();

		if (key === "name" || key === "summary") {
			metadata[key] = value;
		}
	}

	if (!metadata.name || !metadata.summary) {
		return { metadata: null, content };
	}

	return {
		metadata: metadata as BlueprintMetadata,
		content: bodyContent,
	};
}

/**
 * Format blueprint with frontmatter
 */
function formatWithFrontmatter(blueprint: Blueprint): string {
	return `---
name: ${blueprint.name}
summary: ${blueprint.summary}
---

${blueprint.content}`;
}

/**
 * Search blueprints by optional keyword
 */
function searchBlueprints(keyword?: string): {
	blueprints: BlueprintMetadata[];
} {
	const blueprintsDir = getBlueprintsDir();
	if (!blueprintsDir) {
		return { blueprints: [] };
	}

	const files = readdirSync(blueprintsDir).filter(
		(f) => f.endsWith(".md") && f !== "README.md",
	);

	const blueprints: BlueprintMetadata[] = [];

	for (const file of files) {
		const filePath = join(blueprintsDir, file);
		const content = readFileSync(filePath, "utf-8");
		const { metadata } = parseFrontmatter(content);

		if (!metadata) {
			// If no frontmatter, try to extract from filename
			const name = file.replace(".md", "");
			blueprints.push({
				name,
				summary: "No summary available (missing frontmatter)",
			});
			continue;
		}

		// Filter by keyword if provided
		if (keyword) {
			const lowerKeyword = keyword.toLowerCase();
			const matchesName = metadata.name.toLowerCase().includes(lowerKeyword);
			const matchesSummary = metadata.summary
				.toLowerCase()
				.includes(lowerKeyword);

			if (!matchesName && !matchesSummary) {
				continue;
			}
		}

		blueprints.push(metadata);
	}

	// Sort alphabetically by name
	blueprints.sort((a, b) => a.name.localeCompare(b.name));

	return { blueprints };
}

/**
 * Read a specific blueprint by name
 */
function readBlueprint(name: string): Blueprint {
	const blueprintsDir = getBlueprintsDir();
	if (!blueprintsDir) {
		throw new Error("Blueprints directory not found at repository root");
	}

	const filePath = join(blueprintsDir, `${name}.md`);
	if (!existsSync(filePath)) {
		throw new Error(`Blueprint not found: ${name}`);
	}

	const fileContent = readFileSync(filePath, "utf-8");
	const { metadata, content } = parseFrontmatter(fileContent);

	if (!metadata) {
		throw new Error(
			`Blueprint ${name} is missing frontmatter. Expected:\n---\nname: ${name}\nsummary: Brief description\n---`,
		);
	}

	return {
		name: metadata.name,
		summary: metadata.summary,
		content,
	};
}

/**
 * Write a blueprint (create or update)
 */
function writeBlueprint(
	name: string,
	summary: string,
	content: string,
): { success: boolean; message: string } {
	const blueprintsDir = getBlueprintsDir();
	if (!blueprintsDir) {
		throw new Error("Blueprints directory not found at repository root");
	}

	// Validate inputs
	if (!name || !summary || !content) {
		throw new Error("Name, summary, and content are all required");
	}

	// Ensure name doesn't have .md extension
	const cleanName = name.replace(/\.md$/, "");

	const blueprint: Blueprint = {
		name: cleanName,
		summary,
		content: content.trim(),
	};

	const filePath = join(blueprintsDir, `${cleanName}.md`);
	const alreadyExists = existsSync(filePath);
	const fileContent = formatWithFrontmatter(blueprint);

	writeFileSync(filePath, fileContent, "utf-8");

	const action = alreadyExists ? "updated" : "created";
	return {
		success: true,
		message: `Blueprint ${cleanName} ${action} successfully`,
	};
}

/**
 * Define all blueprint tools
 */
const BLUEPRINT_TOOLS: McpTool[] = [
	{
		name: "search_blueprints",
		description:
			"Search and list available technical blueprints. USE THIS FIRST before creating new blueprints to avoid duplication. Returns blueprint names and summaries. Optionally filter by keyword.",
		annotations: {
			title: "Search Blueprints",
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				keyword: {
					type: "string",
					description:
						"Optional keyword to filter blueprints by name or summary",
				},
			},
			required: [],
		},
	},
	{
		name: "read_blueprint",
		description:
			"Read the full content of a specific blueprint by name. USE THIS before modifying systems to understand current documentation. Returns the blueprint's name, summary, and complete markdown content.",
		annotations: {
			title: "Read Blueprint",
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				name: {
					type: "string",
					description: "Blueprint name (without .md extension)",
				},
			},
			required: ["name"],
		},
	},
	{
		name: "write_blueprint",
		description:
			"Create or update a technical blueprint. USE THIS after making implementation changes to keep documentation current. Automatically manages frontmatter with name and summary. Content should be markdown without frontmatter.",
		annotations: {
			title: "Write Blueprint",
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				name: {
					type: "string",
					description:
						"Blueprint name (without .md extension, e.g., 'cli-architecture')",
				},
				summary: {
					type: "string",
					description:
						"Brief one-line summary of what this blueprint documents",
				},
				content: {
					type: "string",
					description:
						"Markdown content of the blueprint (frontmatter will be added automatically)",
				},
			},
			required: ["name", "summary", "content"],
		},
	},
];

function handleInitialize(): unknown {
	return {
		protocolVersion: "2024-11-05",
		capabilities: {
			tools: {},
		},
		serverInfo: {
			name: "blueprints",
			version: "1.0.0",
		},
	};
}

function handleToolsList(): unknown {
	return {
		tools: BLUEPRINT_TOOLS,
	};
}

async function handleToolsCall(params: {
	name: string;
	arguments?: Record<string, unknown>;
}): Promise<unknown> {
	try {
		const args = params.arguments || {};

		switch (params.name) {
			case "search_blueprints": {
				const keyword =
					typeof args.keyword === "string" ? args.keyword : undefined;
				const result = searchBlueprints(keyword);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			}

			case "read_blueprint": {
				if (typeof args.name !== "string") {
					throw new Error("Blueprint name is required");
				}
				const result = readBlueprint(args.name);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			}

			case "write_blueprint": {
				if (
					typeof args.name !== "string" ||
					typeof args.summary !== "string" ||
					typeof args.content !== "string"
				) {
					throw new Error("Name, summary, and content are all required");
				}
				const result = writeBlueprint(args.name, args.summary, args.content);
				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(result, null, 2),
						},
					],
				};
			}

			default:
				throw {
					code: -32602,
					message: `Unknown tool: ${params.name}`,
				};
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			content: [
				{
					type: "text",
					text: `Error executing ${params.name}: ${message}`,
				},
			],
			isError: true,
		};
	}
}

async function handleRequest(
	request: JsonRpcRequest,
): Promise<JsonRpcResponse> {
	try {
		let result: unknown;

		switch (request.method) {
			case "initialize":
				result = handleInitialize();
				break;
			case "initialized":
				// Notification, no response needed
				return { jsonrpc: "2.0", id: request.id, result: {} };
			case "ping":
				// Simple ping/pong for health checks
				result = {};
				break;
			case "tools/list":
				result = handleToolsList();
				break;
			case "tools/call":
				result = await handleToolsCall(
					request.params as {
						name: string;
						arguments?: Record<string, unknown>;
					},
				);
				break;
			default:
				throw {
					code: -32601,
					message: `Method not found: ${request.method}`,
				};
		}

		return {
			jsonrpc: "2.0",
			id: request.id,
			result,
		};
	} catch (error) {
		const errorObj =
			typeof error === "object" && error !== null && "code" in error
				? (error as { code: number; message: string })
				: { code: -32603, message: String(error) };

		return {
			jsonrpc: "2.0",
			id: request.id,
			error: errorObj,
		};
	}
}

function sendResponse(response: JsonRpcResponse): void {
	const json = JSON.stringify(response);
	process.stdout.write(`${json}\n`);
}

/**
 * Start the blueprints MCP server
 */
export async function startBlueprintsMcpServer(): Promise<void> {
	const rl = createInterface({
		input: process.stdin,
		terminal: false,
	});

	for await (const line of rl) {
		if (!line.trim()) continue;

		try {
			const request = JSON.parse(line) as JsonRpcRequest;
			const response = await handleRequest(request);

			// Only send response if there's an id (not a notification)
			if (request.id !== undefined) {
				sendResponse(response);
			}
		} catch (error) {
			// JSON parse error
			sendResponse({
				jsonrpc: "2.0",
				error: {
					code: -32700,
					message: "Parse error",
					data: String(error),
				},
			});
		}
	}
}
