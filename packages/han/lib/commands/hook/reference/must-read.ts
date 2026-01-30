import { existsSync, readFileSync } from "node:fs";
import { Command } from "commander";
import { getOrCreateEventLogger } from "../../../events/logger.ts";
import { getPluginNameFromRoot } from "../../../shared.ts";

export function createReferenceCommand(): Command {
	const command = new Command("reference");

	command
		.description("Output a file reference tag for Claude Code hook injection")
		.argument(
			"<file>",
			"Path to the file to reference (relative to plugin root)",
		)
		.option(
			"--must-read-first <reason...>",
			"Mark file as required reading with given reason (supports multi-word)",
		)
		.option(
			"--inline",
			"Output file content directly instead of a path reference (for subagent injection)",
		)
		.action(
			(file: string, options: { mustReadFirst?: string[]; inline?: boolean }) => {
				const startTime = Date.now();
				// Get the plugin root from environment variable set by hook dispatcher
				const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || "";
				const pluginName = getPluginNameFromRoot(pluginRoot);
				const filePath = `${pluginRoot}/${file}`;

				// --inline: Output file content directly for subagent injection
				if (options.inline) {
					if (!existsSync(filePath)) {
						console.error(`File not found: ${filePath}`);
						process.exit(1);
					}
					const content = readFileSync(filePath, "utf-8");
					console.log(content);

					// Log hook reference event
					const eventLogger = getOrCreateEventLogger();
					eventLogger?.logHookReference(
						pluginName,
						filePath,
						"inline content",
						true,
						Date.now() - startTime,
					);
					return;
				}

				if (options.mustReadFirst) {
					// Join variadic args back into a single reason string
					const reason = options.mustReadFirst.join(" ");
					const output = `<must-read-first reason="${reason}">${filePath}</must-read-first>`;
					console.log(output);

					// Log hook reference event
					const eventLogger = getOrCreateEventLogger();
					eventLogger?.logHookReference(
						pluginName,
						filePath,
						reason,
						true,
						Date.now() - startTime,
					);
				} else {
					// Future: support other reference types
					console.log(filePath);

					// Log hook reference event (no reason)
					const eventLogger = getOrCreateEventLogger();
					eventLogger?.logHookReference(
						pluginName,
						filePath,
						undefined,
						true,
						Date.now() - startTime,
					);
				}
			},
		);

	return command;
}
