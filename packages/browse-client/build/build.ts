#!/usr/bin/env bun
/**
 * Production build script using Bun's bundler with JS entrypoint
 *
 * Uses a JS entrypoint instead of HTML to avoid a Bun HTML bundler bug
 * where the wrong chunk gets assigned as the entry script on Linux.
 * Generates index.html manually with the correct script reference.
 */
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { pagesPlugin } from "./pages-plugin";
import { relayPlugin } from "./relay-plugin";
import { rnwCompatPlugin } from "./rnw-compat-plugin";

const projectRoot = dirname(import.meta.dir);
const outDir = join(projectRoot, "out");
const pagesDir = join(projectRoot, "src", "pages");

// Clean output directory
try {
	rmSync(outDir, { recursive: true });
} catch {
	// Directory may not exist
}

console.log("Building browse-client with Bun...");
console.log(`  Output: ${outDir}`);

// Use JS entrypoint instead of HTML to avoid Bun's HTML bundler bug
// on Linux where it assigns the wrong chunk as the entry script.
const result = await Bun.build({
	entrypoints: [join(projectRoot, "src", "main.tsx")],
	outdir: outDir,
	minify: true,
	splitting: true,
	sourcemap: "external",
	target: "browser",
	publicPath: "/",
	naming: "[dir]/[name]-[hash].[ext]",
	plugins: [
		rnwCompatPlugin(),
		relayPlugin({ devMode: false }),
		pagesPlugin({ pagesDir }),
	],
	define: {
		"process.env.NODE_ENV": JSON.stringify("production"),
		global: "globalThis",
		...(process.env.GRAPHQL_URL
			? {
					__GRAPHQL_URL__: JSON.stringify(process.env.GRAPHQL_URL),
					__GRAPHQL_WS_URL__: JSON.stringify(
						process.env.GRAPHQL_URL.replace(/^https:/, "wss:").replace(
							/^http:/,
							"ws:",
						),
					),
				}
			: {}),
	},
	loader: {
		".css": "css",
		".svg": "file",
		".png": "file",
		".jpg": "file",
		".jpeg": "file",
		".gif": "file",
		".woff": "file",
		".woff2": "file",
	},
});

if (!result.success) {
	console.error("Build failed:");
	for (const log of result.logs) {
		console.error(log);
	}
	process.exit(1);
}

// Find the entry point output (the main.tsx bundle)
const entryOutput = result.outputs.find(
	(o) => o.kind === "entry-point" && o.path.endsWith(".js"),
);
if (!entryOutput) {
	console.error("Build failed: could not find entry-point JS output");
	process.exit(1);
}
const entryFilename = `/${basename(entryOutput.path)}`;

// Generate index.html from template with the correct entry script
const template = readFileSync(join(projectRoot, "index.html"), "utf-8");
const html = template.replace(
	/<script type="module" src="\.\/src\/main\.tsx"><\/script>/,
	`<script type="module" crossorigin src="${entryFilename}"></script>`,
);
writeFileSync(join(outDir, "index.html"), html);

// Report build artifacts
console.log("\nBuild complete:");
for (const output of result.outputs) {
	const size = output.size;
	const sizeStr =
		size > 1024 * 1024
			? `${(size / 1024 / 1024).toFixed(2)} MB`
			: `${(size / 1024).toFixed(1)} KB`;
	console.log(`  ${output.path.replace(outDir, "out")} (${sizeStr})`);
}
console.log(`  out/index.html (entry: ${entryFilename})`);
