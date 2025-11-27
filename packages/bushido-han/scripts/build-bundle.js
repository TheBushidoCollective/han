#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
	readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
);

const version = packageJson.version;

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

const externals = nodeBuiltins
	.flatMap((mod) => [`--external:${mod}`, `--external:node:${mod}`])
	.join(" ");

// Banner to create require function in ESM context
const banner = `import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);`;

const command = [
	"npx esbuild lib/main.ts",
	"--bundle",
	"--minify",
	"--platform=node",
	"--target=node20",
	"--outfile=dist/bundle.js",
	"--format=esm",
	"--alias:react-devtools-core=./lib/shims/react-devtools-core.js",
	`--define:__HAN_VERSION__='"${version}"'`,
	`--banner:js="${banner}"`,
].join(" ");

console.log(`Building bundle for version ${version}...`);
execSync(command, {
	cwd: join(__dirname, ".."),
	stdio: "inherit",
});
