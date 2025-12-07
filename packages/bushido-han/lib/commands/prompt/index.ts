import { Command } from "commander";
import { createMustReadCommand } from "./must-read.js";

export function createPromptCommand(): Command {
	const command = new Command("prompt");

	command.description("Prompt utilities for Claude Code hooks");

	command.addCommand(createMustReadCommand());

	return command;
}
