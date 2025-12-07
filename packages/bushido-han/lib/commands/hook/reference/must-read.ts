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
			"--must-read-first <reason>",
			"Mark file as required reading with given reason",
		)
		.action((file: string, options: { mustReadFirst?: string }) => {
			if (options.mustReadFirst) {
				// Output ${CLAUDE_PLUGIN_ROOT} without escaping so dispatch.ts can expand it
				const output =
					`<must-read-first reason="${options.mustReadFirst}">` +
					// biome-ignore lint/suspicious/noTemplateCurlyInString: Need literal ${CLAUDE_PLUGIN_ROOT} for dispatch expansion
					"${CLAUDE_PLUGIN_ROOT}" +
					`/${file}</must-read-first>`;
				console.log(output);
				// TODO: Track metrics for must-read-first references
			} else {
				// Future: support other reference types
				// biome-ignore lint/style/useTemplate: Need literal ${CLAUDE_PLUGIN_ROOT} for dispatch expansion
				// biome-ignore lint/suspicious/noTemplateCurlyInString: Need literal ${CLAUDE_PLUGIN_ROOT} for dispatch expansion
				console.log("${CLAUDE_PLUGIN_ROOT}" + `/${file}`);
			}
		});

	return command;
}
