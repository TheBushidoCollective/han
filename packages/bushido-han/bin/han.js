#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
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

// Try binary first, fall back to JS implementation
if (!tryRunBinary()) {
	// Fall back to TypeScript-compiled JS implementation
	await import("../dist/lib/main.js");
}
