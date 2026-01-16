import type { Command } from "commander";
import { syncBlueprintsIndex } from "../mcp/blueprints.ts";

export function registerBlueprintsCommands(program: Command): void {
	const blueprintsCommand = program
		.command("blueprints")
		.description("Commands for managing technical blueprint documentation.");

	blueprintsCommand
		.command("sync-index")
		.description(
			"Sync blueprints index to .claude/rules/hashi-blueprints/blueprints-index.md\n" +
				"This generates a lightweight index for session context injection.",
		)
		.action(() => {
			const result = syncBlueprintsIndex();
			if (result.success) {
				if (result.count === 0) {
					console.log("No blueprints found to index.");
				} else {
					console.log(
						`Synced ${result.count} blueprints to .claude/rules/hashi-blueprints/blueprints-index.md`,
					);
				}
			} else {
				console.error("Failed to sync blueprints index.");
				process.exit(1);
			}
		});
}
