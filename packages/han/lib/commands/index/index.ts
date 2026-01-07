/**
 * Han Reindex Command
 *
 * CLI command for reindexing memory content into FTS.
 *
 * Usage:
 *   han reindex                      # Reindex all content for current project
 *   han reindex --layer observations # Reindex only observations
 *   han reindex --layer summaries    # Reindex only summaries
 *   han reindex --layer transcripts  # Reindex only transcripts
 *   han reindex --layer team         # Reindex only team memory
 *   han reindex --all                # Full reindex of all projects
 */

import type { Command } from "commander";
import { type IndexLayer, searchAll } from "../../memory/indexer.ts";
import { getGitRemote } from "../../memory/paths.ts";

/**
 * Register the reindex command
 */
export function registerReindexCommand(program: Command): void {
	const reindexCommand = program
		.command("reindex")
		.description("Reindex memory content for semantic search");

	// Main reindex action (default)
	reindexCommand
		.command("run", { isDefault: true })
		.description("Run indexing on memory content")
		.option(
			"--layer <layer>",
			"Index specific layer (observations, summaries, transcripts, team)",
		)
		.option("--session <id>", "Index specific session only")
		.option("--all", "Index all projects (not just current)")
		.option("-v, --verbose", "Show detailed progress")
		.action(
			async (options: {
				layer?: string;
				session?: string;
				all?: boolean;
				verbose?: boolean;
			}) => {
				try {
					// Lazy import to avoid loading native module until needed
					const { runIndex } = await import("../../memory/indexer.ts");
					type IndexLayer = import("../../memory/indexer.ts").IndexLayer;
					type IndexOptions = import("../../memory/indexer.ts").IndexOptions;

					// Validate layer if provided
					const validLayers: IndexLayer[] = [
						"observations",
						"summaries",
						"transcripts",
						"team",
					];
					if (
						options.layer &&
						!validLayers.includes(options.layer as IndexLayer)
					) {
						console.error(
							`Invalid layer: ${options.layer}. Valid options: ${validLayers.join(", ")}`,
						);
						process.exit(1);
					}

					const gitRemote = getGitRemote() || undefined;

					const indexOptions: IndexOptions = {
						layer: options.layer as IndexLayer | undefined,
						sessionId: options.session,
						gitRemote,
						verbose: options.verbose,
					};

					if (options.verbose) {
						console.log("Starting indexing...");
						if (gitRemote) {
							console.log(`Project: ${gitRemote}`);
						}
						if (options.layer) {
							console.log(`Layer: ${options.layer}`);
						}
					}

					const results = await runIndex(indexOptions);

					// Print summary
					const totalIndexed =
						results.observations +
						results.summaries +
						results.team +
						results.transcripts;

					if (options.verbose || totalIndexed > 0) {
						console.log("\nIndexing complete:");
						if (results.observations > 0) {
							console.log(`  Observations: ${results.observations} documents`);
						}
						if (results.summaries > 0) {
							console.log(`  Summaries: ${results.summaries} documents`);
						}
						if (results.team > 0) {
							console.log(`  Team memory: ${results.team} documents`);
						}
						if (results.transcripts > 0) {
							console.log(`  Transcripts: ${results.transcripts} documents`);
						}
						if (totalIndexed === 0) {
							console.log("  No new documents to index");
						}
					}

					process.exit(0);
				} catch (error: unknown) {
					console.error(
						"Error during indexing:",
						error instanceof Error ? error.message : error,
					);
					process.exit(1);
				}
			},
		);

	// Search command for testing the index
	reindexCommand
		.command("search <query>")
		.description("Search indexed content (for testing)")
		.option(
			"--layer <layer>",
			"Search specific layer (observations, summaries, transcripts, team)",
		)
		.option("--limit <n>", "Maximum results", "10")
		.action(
			async (query: string, options: { layer?: string; limit: string }) => {
				try {
					const gitRemote = getGitRemote() || undefined;
					const limit = Number.parseInt(options.limit, 10);

					const layers = options.layer
						? [options.layer as IndexLayer]
						: undefined;

					const results = await searchAll(query, {
						layers,
						gitRemote,
						limit,
					});

					if (results.length === 0) {
						console.log("No results found");
						process.exit(0);
					}

					console.log(`Found ${results.length} results:\n`);

					for (const result of results) {
						const meta = result.metadata || {};
						const layer = meta.layer || "unknown";
						const score = result.score.toFixed(3);

						console.log(`[${layer}] Score: ${score}`);
						console.log(`  ID: ${result.id}`);

						// Truncate content for display
						const content =
							result.content.length > 200
								? `${result.content.slice(0, 200)}...`
								: result.content;
						console.log(`  ${content.replace(/\n/g, "\n  ")}`);
						console.log();
					}

					process.exit(0);
				} catch (error: unknown) {
					console.error(
						"Error searching:",
						error instanceof Error ? error.message : error,
					);
					process.exit(1);
				}
			},
		);

	// Status command to check index health
	reindexCommand
		.command("status")
		.description("Show index status")
		.action(async () => {
			try {
				const { getIndexDbPath } = await import("../../memory/indexer.ts");
				const { existsSync, statSync } = await import("node:fs");

				const dbPath = getIndexDbPath();
				const exists = existsSync(dbPath);

				console.log("Index Status:");
				console.log(`  Database: ${dbPath}`);
				console.log(`  Exists: ${exists ? "Yes" : "No"}`);

				if (exists) {
					const stats = statSync(dbPath);
					const sizeMb = (stats.size / 1024 / 1024).toFixed(2);
					console.log(`  Size: ${sizeMb} MB`);
					console.log(`  Modified: ${stats.mtime.toISOString()}`);
				}

				const gitRemote = getGitRemote();
				console.log(`  Git remote: ${gitRemote || "Not in a git repo"}`);

				process.exit(0);
			} catch (error: unknown) {
				console.error(
					"Error getting status:",
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		});
}
