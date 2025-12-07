import { Command } from "commander";

export function createMustReadCommand(): Command {
	const command = new Command("must-read");

	command
		.description(
			"Output a <must-read-first> tag for Claude Code hook injection",
		)
		.argument("<file>", "Path to the file to inject (relative to plugin root)")
		.option("-r, --reason <reason>", "Reason why the file must be read first")
		.action((file: string, options: { reason?: string }) => {
			const reason = options.reason || "required reading";
			const output = `<must-read-first reason="${reason}">\${CLAUDE_PLUGIN_ROOT}/${file}</must-read-first>`;
			console.log(output);
		});

	return command;
}
