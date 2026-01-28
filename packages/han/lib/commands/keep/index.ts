/**
 * han keep - Scoped key-value storage
 *
 * Commands:
 *   han keep save <key> [content...]    Save content to storage
 *   han keep load <key>                 Load content from storage
 *   han keep list                       List all keys in scope
 *   han keep delete <key>               Delete a key from storage
 *   han keep clear                      Clear all keys in scope
 *
 * Scoping:
 *   --global    Global storage (shared across all repos)
 *   --repo      Repository-scoped (shared across branches)
 *   --branch    Branch-scoped (default)
 */
import type { Command } from "commander";
import { type Scope, clear, list, load, remove, save } from "./storage.ts";

/**
 * Parse scope from command options
 */
function parseScope(options: {
	global?: boolean;
	repo?: boolean;
	branch?: boolean;
}): Scope {
	if (options.global) return "global";
	if (options.repo) return "repo";
	return "branch"; // Default
}

/**
 * Register han keep commands
 */
export function registerKeepCommands(program: Command): void {
	const keepCommand = program
		.command("keep")
		.description("Scoped key-value storage for persisting state across sessions");

	// han keep save <key> [content...]
	keepCommand
		.command("save <key> [content...]")
		.description("Save content to storage (reads from stdin if no content provided)")
		.option("--global", "Use global scope (shared across all repos)")
		.option("--repo", "Use repo scope (shared across branches)")
		.option("--branch", "Use branch scope (default)")
		.action(async (key: string, contentParts: string[], options) => {
			// Join content parts back together (handles space-separated arguments)
			let content: string | undefined =
				contentParts.length > 0 ? contentParts.join(" ") : undefined;
			const scope = parseScope(options);

			// If no content provided, read from stdin
			if (content === undefined) {
				const chunks: Buffer[] = [];
				for await (const chunk of process.stdin) {
					chunks.push(chunk);
				}
				content = Buffer.concat(chunks).toString("utf-8").trimEnd();
			}

			try {
				save(scope, key, content);
				console.log(`Saved to ${scope}:${key}`);
			} catch (error) {
				console.error(
					`Error saving ${key}:`,
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		});

	// han keep load <key>
	keepCommand
		.command("load <key>")
		.description("Load content from storage")
		.option("--global", "Use global scope")
		.option("--repo", "Use repo scope")
		.option("--branch", "Use branch scope (default)")
		.option("-q, --quiet", "Suppress errors if key not found")
		.action((key: string, options) => {
			const scope = parseScope(options);

			try {
				const content = load(scope, key);

				if (content === null) {
					if (!options.quiet) {
						console.error(`Key not found: ${scope}:${key}`);
					}
					process.exit(1);
				}

				console.log(content);
			} catch (error) {
				if (!options.quiet) {
					console.error(
						`Error loading ${key}:`,
						error instanceof Error ? error.message : error,
					);
				}
				process.exit(1);
			}
		});

	// han keep list
	keepCommand
		.command("list")
		.description("List all keys in scope")
		.option("--global", "Use global scope")
		.option("--repo", "Use repo scope")
		.option("--branch", "Use branch scope (default)")
		.option("--json", "Output as JSON array")
		.action((options) => {
			const scope = parseScope(options);

			try {
				const keys = list(scope);

				if (options.json) {
					console.log(JSON.stringify(keys));
				} else if (keys.length === 0) {
					console.log(`No keys in ${scope} scope`);
				} else {
					for (const key of keys) {
						console.log(key);
					}
				}
			} catch (error) {
				console.error(
					"Error listing keys:",
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		});

	// han keep delete <key>
	keepCommand
		.command("delete <key>")
		.description("Delete a key from storage")
		.option("--global", "Use global scope")
		.option("--repo", "Use repo scope")
		.option("--branch", "Use branch scope (default)")
		.option("-q, --quiet", "Suppress errors if key not found")
		.action((key: string, options) => {
			const scope = parseScope(options);

			try {
				const deleted = remove(scope, key);

				if (!deleted && !options.quiet) {
					console.error(`Key not found: ${scope}:${key}`);
					process.exit(1);
				}

				if (deleted) {
					console.log(`Deleted ${scope}:${key}`);
				}
			} catch (error) {
				if (!options.quiet) {
					console.error(
						`Error deleting ${key}:`,
						error instanceof Error ? error.message : error,
					);
				}
				process.exit(1);
			}
		});

	// han keep clear
	keepCommand
		.command("clear")
		.description("Clear all keys in scope")
		.option("--global", "Use global scope")
		.option("--repo", "Use repo scope")
		.option("--branch", "Use branch scope (default)")
		.option("-f, --force", "Skip confirmation prompt")
		.action((options) => {
			const scope = parseScope(options);

			try {
				const keys = list(scope);

				if (keys.length === 0) {
					console.log(`No keys to clear in ${scope} scope`);
					return;
				}

				// For now, just proceed (could add interactive prompt later)
				if (!options.force) {
					console.log(`Clearing ${keys.length} key(s) from ${scope} scope:`);
					for (const key of keys) {
						console.log(`  - ${key}`);
					}
				}

				const deleted = clear(scope);
				console.log(`Cleared ${deleted} key(s) from ${scope} scope`);
			} catch (error) {
				console.error(
					"Error clearing keys:",
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		});
}
