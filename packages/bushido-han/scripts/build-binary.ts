#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const __dirname = dirname(new URL(import.meta.url).pathname);
const packageJson = JSON.parse(
	readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
);

const version = packageJson.version;

// Read the detect-plugins prompt
const detectPluginsPrompt = readFileSync(
	join(__dirname, "..", "lib", "detect-plugins-prompt.md"),
	"utf-8",
);

// Plugin to replace react-devtools-core with a stub
const shimReactDevtools: import("bun").BunPlugin = {
	name: "shim-react-devtools",
	setup(build) {
		build.onResolve({ filter: /^react-devtools-core$/ }, () => ({
			path: join(__dirname, "..", "lib", "shims", "react-devtools-core.js"),
		}));
	},
};

const target = Bun.argv[2] || "bun";

console.log(`Building binary for version ${version}, target: ${target}...`);

const result = await Bun.build({
	entrypoints: [join(__dirname, "..", "lib", "main.ts")],
	outdir: join(__dirname, "..", "dist"),
	naming: "bundle.js",
	target: "bun",
	format: "esm",
	minify: true,
	plugins: [shimReactDevtools],
	define: {
		__HAN_VERSION__: JSON.stringify(version),
		__DETECT_PLUGINS_PROMPT__: JSON.stringify(detectPluginsPrompt),
	},
});

if (!result.success) {
	console.error("Bundle build failed:");
	for (const log of result.logs) {
		console.error(log);
	}
	process.exit(1);
}

console.log("Bundle built, now compiling executable...");

// Now compile the bundle with bun build --compile
const proc = Bun.spawn(
	[
		"bun",
		"build",
		"--compile",
		"--minify",
		`--target=${target}`,
		join(__dirname, "..", "dist", "bundle.js"),
		"--outfile",
		join(
			__dirname,
			"..",
			"dist",
			target === "bun" ? "han" : `han-${target.replace("bun-", "")}`,
		),
	],
	{
		cwd: join(__dirname, ".."),
		stdout: "inherit",
		stderr: "inherit",
	},
);

const exitCode = await proc.exited;
if (exitCode !== 0) {
	console.error("Compile failed");
	process.exit(exitCode);
}

console.log("Binary built successfully!");
