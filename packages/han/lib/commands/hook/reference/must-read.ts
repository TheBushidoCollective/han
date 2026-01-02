import { Command } from "commander";

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
		.action((file: string, options: { mustReadFirst?: string[] }) => {
			// Get the plugin root from environment variable set by hook dispatcher
			const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || "";

			if (options.mustReadFirst) {
				// Join variadic args back into a single reason string
				const reason = options.mustReadFirst.join(" ");
				const output = `<must-read-first reason="${reason}">${pluginRoot}/${file}</must-read-first>`;
				console.log(output);
				// TODO: Track metrics for must-read-first references
			} else {
				// Future: support other reference types
				console.log(`${pluginRoot}/${file}`);
			}
		});

	return command;
}
