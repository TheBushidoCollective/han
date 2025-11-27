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

const command = [
	"npx esbuild lib/main.ts",
	"--bundle",
	"--platform=node",
	"--target=node20",
	"--outfile=dist/bundle.js",
	"--format=esm",
	"--alias:react-devtools-core=./lib/shims/react-devtools-core.js",
	`--define:__HAN_VERSION__='"${version}"'`,
].join(" ");

console.log(`Building bundle for version ${version}...`);
execSync(command, {
	cwd: join(__dirname, ".."),
	stdio: "inherit",
});
