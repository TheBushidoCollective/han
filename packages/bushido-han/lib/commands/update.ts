import { execSync, spawn, spawnSync } from "node:child_process";
import { existsSync, readlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Command } from "commander";

type InstallMethod = "homebrew" | "npm" | "standalone" | "unknown";

// Cache file for update check (avoid checking too frequently)
const UPDATE_CHECK_INTERVAL = 1000 * 60 * 60; // 1 hour

/**
 * Detect how han was installed
 */
function detectInstallMethod(): InstallMethod {
	try {
		const hanPath = execSync("which han", { encoding: "utf8" }).trim();

		// Check if it's a Homebrew installation
		if (hanPath.includes("/homebrew/") || hanPath.includes("/Cellar/")) {
			return "homebrew";
		}

		// Check if it's a symlink to node_modules (npm install -g)
		try {
			const realPath = readlinkSync(hanPath);
			if (realPath.includes("node_modules")) {
				return "npm";
			}
		} catch {
			// Not a symlink, check if it's in a node_modules path
			if (hanPath.includes("node_modules")) {
				return "npm";
			}
		}

		// Check for standalone binary (installed via curl script)
		if (hanPath.includes("/.local/bin") || hanPath.includes("/usr/local/bin")) {
			// Check if there's a node_modules nearby
			const binDir = dirname(hanPath);
			if (!existsSync(join(binDir, "../lib/node_modules"))) {
				return "standalone";
			}
		}

		return "npm"; // Default to npm if we can't determine
	} catch {
		return "unknown";
	}
}

/**
 * Get the current version
 */
function getCurrentVersion(): string {
	try {
		return execSync("han --version", { encoding: "utf8" }).trim();
	} catch {
		return "unknown";
	}
}

/**
 * Get the latest version from npm
 */
async function getLatestVersion(): Promise<string> {
	try {
		const result = execSync(
			"npm view @thebushidocollective/han version 2>/dev/null",
			{ encoding: "utf8" },
		).trim();
		return result;
	} catch {
		return "unknown";
	}
}

/**
 * Perform update and re-exec the current command
 * Returns true if update was performed and re-exec happened
 */
async function performUpdateAndReexec(): Promise<boolean> {
	const installMethod = detectInstallMethod();

	let updateCommand: string;
	let updateArgs: string[];

	switch (installMethod) {
		case "homebrew":
			updateCommand = "brew";
			updateArgs = ["upgrade", "han"];
			break;
		case "npm":
			updateCommand = "npm";
			updateArgs = ["install", "-g", "@thebushidocollective/han@latest"];
			break;
		case "standalone":
			updateCommand = "sh";
			updateArgs = ["-c", "curl -fsSL https://han.guru/install.sh | sh"];
			break;
		default:
			return false;
	}

	// Perform update silently
	const result = spawnSync(updateCommand, updateArgs, {
		stdio: "pipe",
		shell: installMethod === "standalone",
	});

	if (result.status !== 0) {
		return false;
	}

	// Re-exec with the same arguments
	const args = process.argv.slice(2);
	const hanPath = execSync("which han", { encoding: "utf8" }).trim();

	// Spawn the new version with the same args and inherit stdio
	const child = spawn(hanPath, args, {
		stdio: "inherit",
		env: { ...process.env, HAN_SKIP_UPDATE_CHECK: "1" },
	});

	child.on("exit", (code) => {
		process.exit(code ?? 0);
	});

	// Return true to signal we're re-execing (caller should not continue)
	return true;
}

/**
 * Check for updates and auto-update if available
 * Call this at startup to enable auto-updates
 * Returns true if an update was performed and re-exec is in progress
 */
export async function checkAndAutoUpdate(): Promise<boolean> {
	// Skip if explicitly disabled or already checking
	if (process.env.HAN_SKIP_UPDATE_CHECK === "1") {
		return false;
	}

	// Skip for update command itself
	const args = process.argv.slice(2);
	if (args[0] === "update") {
		return false;
	}

	try {
		const currentVersion = getCurrentVersion();
		const latestVersion = await getLatestVersion();

		if (currentVersion !== latestVersion && latestVersion !== "unknown") {
			console.error(`Updating han: ${currentVersion} → ${latestVersion}...`);
			const reexeced = await performUpdateAndReexec();
			if (reexeced) {
				return true;
			}
		}
	} catch {
		// Silently ignore update check failures
	}

	return false;
}

/**
 * Register the update command
 */
export function registerUpdateCommand(program: Command): void {
	program
		.command("update")
		.description("Update han to the latest version")
		.option("--check", "Only check for updates, don't install")
		.action(async (options: { check?: boolean }) => {
			const currentVersion = getCurrentVersion();
			const latestVersion = await getLatestVersion();

			console.log(`Current version: ${currentVersion}`);
			console.log(`Latest version:  ${latestVersion}`);

			if (currentVersion === latestVersion) {
				console.log("\n✅ You're already on the latest version!");
				return;
			}

			if (options.check) {
				console.log(
					`\n📦 Update available: ${currentVersion} → ${latestVersion}`,
				);
				console.log("Run 'han update' to install the update.");
				return;
			}

			const installMethod = detectInstallMethod();
			console.log(`\nInstallation method: ${installMethod}`);
			console.log("Updating...\n");

			let updateCommand: string;
			let updateArgs: string[];

			switch (installMethod) {
				case "homebrew":
					updateCommand = "brew";
					updateArgs = ["upgrade", "han"];
					break;
				case "npm":
					updateCommand = "npm";
					updateArgs = ["install", "-g", "@thebushidocollective/han@latest"];
					break;
				case "standalone":
					// Re-run the install script
					console.log("Downloading latest version...");
					updateCommand = "sh";
					updateArgs = ["-c", "curl -fsSL https://han.guru/install.sh | sh"];
					break;
				default:
					console.error(
						"Could not determine installation method. Please update manually:",
					);
					console.error("  npm:      npm install -g @thebushidocollective/han");
					console.error("  homebrew: brew upgrade han");
					console.error(
						"  curl:     curl -fsSL https://han.guru/install.sh | sh",
					);
					process.exit(1);
			}

			const result = spawnSync(updateCommand, updateArgs, {
				stdio: "inherit",
				shell: installMethod === "standalone",
			});

			if (result.status === 0) {
				const newVersion = execSync("han --version", {
					encoding: "utf8",
				}).trim();
				console.log(`\n✅ Successfully updated to version ${newVersion}`);
			} else {
				console.error("\n❌ Update failed. Please try updating manually.");
				process.exit(1);
			}
		});
}
