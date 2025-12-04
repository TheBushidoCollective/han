#!/usr/bin/env node

import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Self-repair: detect stale npx cache and fix it
async function selfRepairIfNeeded() {
	// Skip if already in repair mode (prevent infinite loops)
	if (process.env.HAN_SELF_REPAIR === "1") {
		return;
	}

	// Skip for version/help commands (let user see current version)
	const args = process.argv.slice(2);
	if (
		args.includes("--version") ||
		args.includes("-V") ||
		args.includes("--help") ||
		args.includes("-h") ||
		args.length === 0
	) {
		return;
	}

	// Only run for npx invocations (check if in _npx cache directory)
	const scriptPath = fileURLToPath(import.meta.url);
	if (!scriptPath.includes("_npx")) {
		return;
	}

	try {
		// Get current version
		const packageJsonPath = join(__dirname, "..", "package.json");
		const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
		const currentVersion = packageJson.version;

		// Fetch latest version from npm (with short timeout)
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 3000);

		const response = await fetch(
			"https://registry.npmjs.org/@thebushidocollective/han",
			{ signal: controller.signal },
		);
		clearTimeout(timeout);

		if (!response.ok) {
			return;
		}

		const data = await response.json();
		const latestVersion = data["dist-tags"]?.latest;

		if (!latestVersion || currentVersion === latestVersion) {
			return;
		}

		// Compare versions (simple semver comparison)
		const current = currentVersion.split(".").map(Number);
		const latest = latestVersion.split(".").map(Number);

		const isBehind =
			current[0] < latest[0] ||
			(current[0] === latest[0] && current[1] < latest[1]) ||
			(current[0] === latest[0] &&
				current[1] === latest[1] &&
				current[2] < latest[2]);

		if (!isBehind) {
			return;
		}

		console.error(
			`\x1b[33m⚠ Stale npx cache detected (v${currentVersion} < v${latestVersion}), repairing...\x1b[0m`,
		);

		// Clear npx cache
		try {
			execSync("npx clear-npx-cache", { stdio: "pipe" });
		} catch {
			// Try manual clear if clear-npx-cache not available
			const { homedir } = await import("node:os");
			const npxCachePath = join(homedir(), ".npm", "_npx");
			if (existsSync(npxCachePath)) {
				const { rmSync } = await import("node:fs");
				rmSync(npxCachePath, { recursive: true, force: true });
			}
		}

		// Re-exec with the exact version we fetched
		const result = spawnSync(
			"npx",
			["-y", `@thebushidocollective/han@${latestVersion}`, ...args],
			{
				stdio: "inherit",
				env: { ...process.env, HAN_SELF_REPAIR: "1" },
				shell: true,
			},
		);

		process.exit(result.status ?? 0);
	} catch {
		// Silently continue if self-repair fails (network issues, etc.)
	}
}

await selfRepairIfNeeded();
const require = createRequire(import.meta.url);

// Platform package mapping
const platformPackages = {
	"darwin-arm64": "@thebushidocollective/han-darwin-arm64",
	"darwin-x64": "@thebushidocollective/han-darwin-x64",
	"linux-x64": "@thebushidocollective/han-linux-x64",
	"linux-arm64": "@thebushidocollective/han-linux-arm64",
	"win32-x64": "@thebushidocollective/han-win32-x64",
};

function getPlatformKey() {
	return `${process.platform}-${process.arch}`;
}

function tryRunBinary() {
	const platformKey = getPlatformKey();
	const packageName = platformPackages[platformKey];

	if (!packageName) {
		return false;
	}

	try {
		// Try to resolve the platform package
		const pkgPath = require.resolve(`${packageName}/package.json`);
		const pkgDir = dirname(pkgPath);
		const binaryName = process.platform === "win32" ? "han.exe" : "han";
		const binaryPath = join(pkgDir, binaryName);

		if (!existsSync(binaryPath)) {
			return false;
		}

		// Run the binary
		const result = spawnSync(binaryPath, process.argv.slice(2), {
			stdio: "inherit",
			windowsHide: true,
		});

		if (result.error) {
			return false;
		}

		process.exit(result.status ?? 0);
	} catch {
		return false;
	}
}

// Retry logic for CDN propagation delays
async function waitForPackageAvailability(packageName, maxRetries = 5) {
	const baseDelay = 2000; // 2 seconds

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 5000);

			const response = await fetch(
				`https://registry.npmjs.org/${packageName}`,
				{ signal: controller.signal },
			);
			clearTimeout(timeout);

			if (response.ok) {
				const data = await response.json();
				if (data["dist-tags"]?.latest) {
					return true;
				}
			}
		} catch {
			// Network error, continue retrying
		}

		if (attempt < maxRetries) {
			const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
			console.error(
				`\x1b[33m⏳ Waiting for package availability (attempt ${attempt}/${maxRetries})...\x1b[0m`,
			);
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	return false;
}

// Run binary - no JS fallback in production
if (!tryRunBinary()) {
	const platformKey = getPlatformKey();
	const packageName = platformPackages[platformKey];

	if (!packageName) {
		console.error(`\x1b[31mError: Unsupported platform: ${platformKey}\x1b[0m`);
		console.error(
			"Supported platforms: darwin-arm64, darwin-x64, linux-x64, linux-arm64, win32-x64",
		);
		process.exit(1);
	}

	// Check if this might be a CDN propagation issue and retry
	const scriptPath = fileURLToPath(import.meta.url);
	if (scriptPath.includes("_npx") && !process.env.HAN_NO_RETRY) {
		console.error(
			`\x1b[33m⚠ Platform binary not found, checking for CDN propagation delay...\x1b[0m`,
		);

		const isAvailable = await waitForPackageAvailability(packageName);

		if (isAvailable) {
			// Clear cache and retry once more
			try {
				execSync("npx clear-npx-cache", { stdio: "pipe" });
			} catch {
				const { homedir } = await import("node:os");
				const npxCachePath = join(homedir(), ".npm", "_npx");
				if (existsSync(npxCachePath)) {
					const { rmSync } = await import("node:fs");
					rmSync(npxCachePath, { recursive: true, force: true });
				}
			}

			console.error(`\x1b[32m✓ Package available, retrying...\x1b[0m`);

			const args = process.argv.slice(2);
			const result = spawnSync(
				"npx",
				["-y", "@thebushidocollective/han@latest", ...args],
				{
					stdio: "inherit",
					env: { ...process.env, HAN_NO_RETRY: "1" },
					shell: true,
				},
			);

			process.exit(result.status ?? 0);
		}
	}

	console.error(
		`\x1b[31mError: Platform binary not found for ${platformKey}\x1b[0m`,
	);
	console.error(`Expected package: ${packageName}`);
	console.error("\nTry reinstalling:");
	console.error("  npm cache clean --force");
	console.error("  npx clear-npx-cache");
	console.error("  npx -y @thebushidocollective/han@latest --version");
	process.exit(1);
}
