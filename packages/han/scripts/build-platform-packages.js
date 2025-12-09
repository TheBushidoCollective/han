#!/usr/bin/env node
import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const packageJson = JSON.parse(
	readFileSync(join(rootDir, "package.json"), "utf-8"),
);

const version = packageJson.version;
const scope = "@thebushidocollective";

const platforms = [
	{
		name: "darwin-arm64",
		os: "darwin",
		cpu: "arm64",
		binary: "han-darwin-arm64",
		nativeModule: "han-native.darwin-arm64.node",
	},
	{
		name: "darwin-x64",
		os: "darwin",
		cpu: "x64",
		binary: "han-darwin-x64",
		nativeModule: "han-native.darwin-x64.node",
	},
	{
		name: "linux-x64",
		os: "linux",
		cpu: "x64",
		binary: "han-linux-x64",
		nativeModule: "han-native.linux-x64-gnu.node",
	},
	{
		name: "linux-arm64",
		os: "linux",
		cpu: "arm64",
		binary: "han-linux-arm64",
		nativeModule: "han-native.linux-arm64-gnu.node",
	},
	{
		name: "win32-x64",
		os: "win32",
		cpu: "x64",
		binary: "han-windows-x64.exe",
		nativeModule: "han-native.win32-x64-msvc.node",
	},
];

const npmDir = join(rootDir, "dist", "npm");
const binariesDir = join(rootDir, "dist", "binaries");
const nativeDir = join(rootDir, "..", "han-native", "dist", "native");

// Create platform-specific packages
for (const platform of platforms) {
	const pkgName = `han-${platform.name}`;
	const pkgDir = join(npmDir, pkgName);

	console.log(`Building ${scope}/${pkgName}...`);

	mkdirSync(pkgDir, { recursive: true });

	// Copy binary
	const binaryName = platform.os === "win32" ? "han.exe" : "han";
	copyFileSync(join(binariesDir, platform.binary), join(pkgDir, binaryName));

	// Make executable on unix
	if (platform.os !== "win32") {
		chmodSync(join(pkgDir, binaryName), 0o755);
	}

	// Copy native module if it exists
	const nativeModuleName = "han-native.node";
	const nativeModuleSrc = join(nativeDir, platform.nativeModule);
	const files = [binaryName];

	if (existsSync(nativeModuleSrc)) {
		copyFileSync(nativeModuleSrc, join(pkgDir, nativeModuleName));
		files.push(nativeModuleName);
		console.log(`  - Included native module: ${platform.nativeModule}`);
	} else {
		console.log(`  - Native module not found: ${nativeModuleSrc} (skipping)`);
	}

	// Create package.json
	const pkgJson = {
		name: `${scope}/${pkgName}`,
		version,
		description: `Han CLI binary for ${platform.os} ${platform.cpu}`,
		repository: {
			type: "git",
			url: "git+https://github.com/TheBushidoCollective/han.git",
		},
		homepage: "https://han.guru",
		license: "MIT",
		os: [platform.os],
		cpu: [platform.cpu],
		files,
	};

	writeFileSync(
		join(pkgDir, "package.json"),
		`${JSON.stringify(pkgJson, null, 2)}\n`,
	);

	// Create README
	writeFileSync(
		join(pkgDir, "README.md"),
		`# ${scope}/${pkgName}

Platform-specific binary for Han CLI (${platform.os} ${platform.cpu}).

This package is installed automatically by \`${scope}/han\` on compatible systems.

For more information, see https://han.guru
`,
	);
}

console.log(`\nBuilt ${platforms.length} platform packages in ${npmDir}`);
