import type { Command } from "commander";
import { render } from "ink";
import React from "react";
import { install, installInteractive } from "../../install.ts";
import { installPlugins } from "../../plugin-install.ts";
import { ScopeSelector } from "../../scope-selector.tsx";
import {
	getEffectiveProjectScope,
	getSettingsFilename,
	type InstallScope,
} from "../../shared/index.ts";

/**
 * Determine the installation scope, using smart detection if no explicit scope provided.
 *
 * Han plugins are ALWAYS installed at project or local scope, never user scope.
 * This ensures plugins are tracked per-project and don't pollute global settings.
 *
 * Logic:
 * 1. If --scope was explicitly provided, validate it's project or local
 * 2. Otherwise, check if Han is already in a project-level scope (local or project)
 * 3. If yes, use that existing scope (with a message)
 * 4. If no, default to "project" scope
 */
async function resolveScope(
	explicitScope: string | undefined,
	wasExplicitlyProvided: boolean,
): Promise<InstallScope | null> {
	// If scope was explicitly provided via --scope, validate and use it
	if (wasExplicitlyProvided && explicitScope) {
		if (explicitScope === "user") {
			console.error(
				'Error: --scope "user" is not supported. Han plugins must be installed at project or local scope.',
			);
			console.error(
				'Use --scope "project" (default) or --scope "local" instead.',
			);
			process.exit(1);
		}
		if (explicitScope !== "project" && explicitScope !== "local") {
			console.error('Error: --scope must be "project" or "local"');
			process.exit(1);
		}
		return explicitScope as InstallScope;
	}

	// Try to detect existing project-level scope
	const effectiveScope = getEffectiveProjectScope();

	if (effectiveScope) {
		// Han is already installed in a project-level scope, use it automatically
		const filename = getSettingsFilename(effectiveScope);
		console.log(`Using existing ${effectiveScope} scope (${filename})\n`);
		return effectiveScope;
	}

	// Default to project scope (no prompting needed)
	console.log("Installing to project scope (.claude/settings.json)\n");
	return "project";
}

/**
 * Prompt the user to select an installation scope using Ink
 */
async function promptForScope(): Promise<InstallScope | null> {
	return new Promise<InstallScope | null>((resolve) => {
		const { unmount } = render(
			React.createElement(ScopeSelector, {
				onSelect: (scope: InstallScope) => {
					unmount();
					resolve(scope);
				},
				onCancel: () => {
					unmount();
					resolve(null);
				},
			}),
		);
	});
}

export function registerPluginInstall(pluginCommand: Command): void {
	pluginCommand
		.command("install [plugin-names...]")
		.description("Install plugins interactively, or use --auto to auto-detect")
		.option("--auto", "Auto-detect plugins using file markers and AI analysis")
		.option(
			"--no-analyze",
			"Skip AI analysis (only use file marker detection with --auto)",
		)
		.option(
			"--scope <scope>",
			'Installation scope: "project" (.claude/settings.json, default) or "local" (.claude/settings.local.json)',
		)
		.action(
			async (
				pluginNames: string[],
				options: { auto?: boolean; analyze?: boolean; scope?: string },
				command: Command,
			) => {
				try {
					// Check if --scope was explicitly provided (not just defaulted)
					const wasExplicitlyProvided =
						command.getOptionValueSource("scope") === "cli";

					// Resolve scope using smart detection
					const scope = await resolveScope(
						options.scope,
						wasExplicitlyProvided,
					);

					if (scope === null) {
						// User cancelled scope selection
						console.log("\nInstallation cancelled");
						process.exit(0);
					}

					// --no-analyze sets analyze to false (commander convention)
					const useAiAnalysis = options.analyze !== false;

					if (options.auto) {
						await install(scope, { useAiAnalysis });
					} else if (pluginNames.length > 0) {
						await installPlugins(pluginNames, scope);
					} else {
						await installInteractive(scope);
					}
					process.exit(0);
				} catch (error: unknown) {
					console.error(
						"Error during plugin installation:",
						error instanceof Error ? error.message : error,
					);
					process.exit(1);
				}
			},
		);
}
