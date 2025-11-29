#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
	readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
);

const version = packageJson.version;

// Read the detect-plugins prompt
const detectPluginsPrompt = readFileSync(
	join(__dirname, "..", "lib", "detect-plugins-prompt.md"),
	"utf-8",
);

// Node.js built-ins to mark as external
const nodeBuiltins = [
	"assert",
	"buffer",
	"child_process",
	"cluster",
	"crypto",
	"dns",
	"events",
	"fs",
	"http",
	"http2",
	"https",
	"net",
	"os",
	"path",
	"process",
	"querystring",
	"readline",
	"stream",
	"string_decoder",
	"tls",
	"tty",
	"url",
	"util",
	"v8",
	"vm",
	"worker_threads",
	"zlib",
];

// Build external patterns for both bare and node: prefixed imports
const external = nodeBuiltins.flatMap((mod) => [mod, `node:${mod}`]);

// Banner to create require function in ESM context
const banner = `import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);`;

console.log(`Building bundle for version ${version}...`);

await esbuild.build({
	entryPoints: [join(__dirname, "..", "lib", "main.ts")],
	bundle: true,
	minify: true,
	platform: "node",
	target: "node20",
	outfile: join(__dirname, "..", "dist", "bundle.js"),
	format: "esm",
	external,
	alias: {
		"react-devtools-core": "./lib/shims/react-devtools-core.js",
	},
	define: {
		__HAN_VERSION__: JSON.stringify(version),
		__DETECT_PLUGINS_PROMPT__: JSON.stringify(detectPluginsPrompt),
	},
	banner: {
		js: banner,
	},
});

console.log("Bundle built successfully!");
