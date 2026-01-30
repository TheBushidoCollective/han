/**
 * Parse command - JSON and YAML parsing utilities
 *
 * Replaces the need for jq/yq in hook scripts by providing
 * built-in parsing capabilities.
 */
import type { Command } from "commander";
import yaml from "yaml";

/**
 * Get a value from an object using dot notation path
 * Supports array indexing with [n] syntax
 *
 * @example
 * getPath({ a: { b: [1, 2, 3] } }, "a.b[1]") // returns 2
 */
function getPath(obj: unknown, path: string): unknown {
	if (!path || path === ".") return obj;

	const parts = path.split(/\.|\[|\]/).filter(Boolean);
	let current: unknown = obj;

	for (const part of parts) {
		if (current === null || current === undefined) return undefined;
		if (typeof current !== "object") return undefined;

		const index = parseInt(part, 10);
		if (!Number.isNaN(index) && Array.isArray(current)) {
			current = current[index];
		} else {
			current = (current as Record<string, unknown>)[part];
		}
	}

	return current;
}

/**
 * Set a value in an object using dot notation path
 * Creates intermediate objects/arrays as needed
 */
function setPath(obj: unknown, path: string, value: unknown): unknown {
	if (!path || path === ".") return value;

	const result = structuredClone(obj) || {};
	const parts = path.split(/\.|\[|\]/).filter(Boolean);
	let current: Record<string, unknown> = result as Record<string, unknown>;

	for (let i = 0; i < parts.length - 1; i++) {
		const part = parts[i];
		const nextPart = parts[i + 1];
		const nextIsIndex = !Number.isNaN(parseInt(nextPart, 10));

		if (current[part] === undefined || current[part] === null) {
			current[part] = nextIsIndex ? [] : {};
		}
		current = current[part] as Record<string, unknown>;
	}

	const lastPart = parts[parts.length - 1];
	current[lastPart] = value;

	return result;
}

/**
 * Extract frontmatter from markdown content
 * Frontmatter is YAML between --- markers at the start of the file
 *
 * @example
 * extractFrontmatter("---\nname: test\n---\n# Content") // returns "name: test"
 */
function extractFrontmatter(content: string): string | null {
	const trimmed = content.trimStart();

	// Must start with ---
	if (!trimmed.startsWith("---")) {
		return null;
	}

	// Find the closing ---
	const lines = trimmed.split("\n");
	let endIndex = -1;

	for (let i = 1; i < lines.length; i++) {
		if (lines[i].trim() === "---") {
			endIndex = i;
			break;
		}
	}

	if (endIndex === -1) {
		return null;
	}

	// Return content between the --- markers
	return lines.slice(1, endIndex).join("\n");
}

/**
 * Update frontmatter in markdown content while preserving body
 * If no frontmatter exists, adds one
 *
 * @example
 * updateFrontmatter("---\nstatus: pending\n---\n# Content", { status: "completed" })
 * // returns "---\nstatus: completed\n---\n# Content"
 */
function updateFrontmatter(
	content: string,
	updates: Record<string, unknown>,
): string {
	const trimmed = content.trimStart();
	const leadingWhitespace = content.slice(0, content.length - trimmed.length);

	// Check if frontmatter exists
	if (!trimmed.startsWith("---")) {
		// No frontmatter - add one with updates
		const newFrontmatter = yaml.stringify(updates).trim();
		return `---\n${newFrontmatter}\n---\n${content}`;
	}

	// Find the closing ---
	const lines = trimmed.split("\n");
	let endIndex = -1;

	for (let i = 1; i < lines.length; i++) {
		if (lines[i].trim() === "---") {
			endIndex = i;
			break;
		}
	}

	if (endIndex === -1) {
		// Malformed frontmatter - treat as no frontmatter
		const newFrontmatter = yaml.stringify(updates).trim();
		return `---\n${newFrontmatter}\n---\n${content}`;
	}

	// Parse existing frontmatter
	const frontmatterContent = lines.slice(1, endIndex).join("\n");
	const existingData = yaml.parse(frontmatterContent) || {};

	// Merge updates
	const updatedData = { ...existingData, ...updates };
	const newFrontmatter = yaml.stringify(updatedData).trim();

	// Reconstruct document
	const body = lines.slice(endIndex + 1).join("\n");
	return `${leadingWhitespace}---\n${newFrontmatter}\n---${body ? `\n${body}` : ""}`;
}

/**
 * Validate JSON against a simple schema
 * Schema format: { field: "type", field2: "type" }
 * Types: string, number, boolean, array, object
 */
function validateSchema(
	data: unknown,
	schema: Record<string, string>,
): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (typeof data !== "object" || data === null) {
		return { valid: false, errors: ["Data must be an object"] };
	}

	const obj = data as Record<string, unknown>;

	for (const [field, expectedType] of Object.entries(schema)) {
		const value = obj[field];

		if (value === undefined) {
			errors.push(`Missing required field: ${field}`);
			continue;
		}

		const actualType = Array.isArray(value) ? "array" : typeof value;
		if (actualType !== expectedType) {
			errors.push(
				`Field '${field}' should be ${expectedType}, got ${actualType}`,
			);
		}
	}

	return { valid: errors.length === 0, errors };
}

export function registerParseCommands(program: Command): void {
	const parseCmd = program
		.command("parse")
		.description("JSON and YAML parsing utilities (replaces jq/yq)");

	// han parse json get <path>
	// Reads JSON from stdin and extracts value at path
	parseCmd
		.command("json")
		.description("Parse JSON from stdin")
		.argument("[path]", "Path to extract (dot notation, e.g., foo.bar[0])", ".")
		.option("-r, --raw", "Output raw string without quotes")
		.option("-e, --exit-code", "Exit with 1 if path not found or null")
		.option("--default <value>", "Default value if path not found")
		.option("-k, --keys", "Output object keys instead of values")
		.action(async (pathArg: string, opts) => {
			try {
				const input = await Bun.stdin.text();
				const data = JSON.parse(input);
				let result = getPath(data, pathArg);

				if (result === undefined && opts.default !== undefined) {
					result = opts.default;
				}

				if (result === undefined || result === null) {
					if (opts.exitCode) {
						process.exit(1);
					}
					console.log(opts.raw ? "" : "null");
					return;
				}

				// If --keys flag, output object keys
				if (opts.keys) {
					if (typeof result === "object" && !Array.isArray(result)) {
						const keys = Object.keys(result as Record<string, unknown>);
						for (const key of keys) {
							console.log(key);
						}
					}
					return;
				}

				if (opts.raw && typeof result === "string") {
					console.log(result);
				} else {
					console.log(JSON.stringify(result));
				}
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : error}`,
				);
				process.exit(1);
			}
		});

	// han parse json-set <path> <value>
	// Reads JSON from stdin, sets value at path, outputs result
	parseCmd
		.command("json-set")
		.description("Set a value in JSON (reads from stdin, outputs to stdout)")
		.argument("<path>", "Path to set (dot notation)")
		.argument("<value>", "Value to set (JSON-encoded)")
		.action(async (pathArg: string, valueArg: string) => {
			try {
				const input = await Bun.stdin.text();
				const data = JSON.parse(input);
				const value = JSON.parse(valueArg);
				const result = setPath(data, pathArg, value);
				console.log(JSON.stringify(result));
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : error}`,
				);
				process.exit(1);
			}
		});

	// han parse json-validate --schema '{"field":"type"}'
	// Validates JSON from stdin against schema
	parseCmd
		.command("json-validate")
		.description("Validate JSON structure from stdin")
		.option("--schema <json>", "Schema as JSON: {field: type, ...}")
		.option("-q, --quiet", "Only output exit code, no messages")
		.action(async (opts) => {
			try {
				const input = await Bun.stdin.text();
				const data = JSON.parse(input);

				if (opts.schema) {
					const schema = JSON.parse(opts.schema);
					const { valid, errors } = validateSchema(data, schema);

					if (!valid) {
						if (!opts.quiet) {
							for (const error of errors) {
								console.error(error);
							}
						}
						process.exit(1);
					}
				}

				if (!opts.quiet) {
					console.log("valid");
				}
			} catch (error) {
				if (!opts.quiet) {
					console.error(
						`Error: ${error instanceof Error ? error.message : error}`,
					);
				}
				process.exit(1);
			}
		});

	// han parse yaml <path>
	// Reads YAML from stdin and extracts value at path
	// Automatically extracts frontmatter if input starts with ---
	parseCmd
		.command("yaml")
		.description(
			"Parse YAML from stdin (auto-extracts frontmatter from markdown)",
		)
		.argument("[path]", "Path to extract (dot notation)", ".")
		.option("-r, --raw", "Output raw string without quotes")
		.option("-e, --exit-code", "Exit with 1 if path not found or null")
		.option("--default <value>", "Default value if path not found")
		.option("--json", "Output as JSON instead of YAML")
		.option("--no-frontmatter", "Disable automatic frontmatter extraction")
		.action(async (pathArg: string, opts) => {
			try {
				let input = await Bun.stdin.text();

				// Auto-extract frontmatter if input looks like markdown with frontmatter
				if (opts.frontmatter !== false) {
					const frontmatter = extractFrontmatter(input);
					if (frontmatter !== null) {
						input = frontmatter;
					}
				}

				const data = yaml.parse(input);
				let result = getPath(data, pathArg);

				if (result === undefined && opts.default !== undefined) {
					result = opts.default;
				}

				if (result === undefined || result === null) {
					if (opts.exitCode) {
						process.exit(1);
					}
					console.log(opts.raw ? "" : "null");
					return;
				}

				if (opts.raw && typeof result === "string") {
					console.log(result);
				} else if (opts.json) {
					console.log(JSON.stringify(result));
				} else {
					console.log(yaml.stringify(result).trim());
				}
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : error}`,
				);
				process.exit(1);
			}
		});

	// han parse yaml-set <path> <value>
	// Reads markdown with frontmatter from stdin, sets value in frontmatter, outputs result
	parseCmd
		.command("yaml-set")
		.description(
			"Set a value in YAML frontmatter (reads markdown from stdin, outputs to stdout)",
		)
		.argument("<path>", "Path to set (dot notation)")
		.argument("<value>", "Value to set (string, or JSON with --json flag)")
		.option("--json", "Parse value as JSON")
		.action(async (pathArg: string, valueArg: string, opts) => {
			try {
				const input = await Bun.stdin.text();
				const value = opts.json ? JSON.parse(valueArg) : valueArg;
				const update = setPath({}, pathArg, value);
				const result = updateFrontmatter(
					input,
					update as Record<string, unknown>,
				);
				console.log(result);
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : error}`,
				);
				process.exit(1);
			}
		});

	// han parse yaml-to-json
	// Converts YAML from stdin to JSON
	parseCmd
		.command("yaml-to-json")
		.description("Convert YAML to JSON")
		.action(async () => {
			try {
				const input = await Bun.stdin.text();
				const data = yaml.parse(input);
				console.log(JSON.stringify(data));
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : error}`,
				);
				process.exit(1);
			}
		});

	// han parse json-to-yaml
	// Converts JSON from stdin to YAML
	parseCmd
		.command("json-to-yaml")
		.description("Convert JSON to YAML")
		.action(async () => {
			try {
				const input = await Bun.stdin.text();
				const data = JSON.parse(input);
				console.log(yaml.stringify(data).trim());
			} catch (error) {
				console.error(
					`Error: ${error instanceof Error ? error.message : error}`,
				);
				process.exit(1);
			}
		});
}
