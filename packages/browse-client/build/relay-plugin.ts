/**
 * Bun plugin for Relay GraphQL transforms
 *
 * Replaces graphql`...` tagged template literals with imports to pre-compiled
 * artifacts from __generated__/ directories. Requires relay-compiler to have
 * already generated the artifact files.
 */
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import type { BunPlugin } from "bun";
import { parse, print } from "graphql";

/**
 * Check if the content has actual graphql tagged template literals
 * (not just "/graphql" URLs in template strings)
 */
function hasGraphQLTag(contents: string): boolean {
	// Match graphql` that is preceded by whitespace, start of line, or certain characters
	// but not preceded by / or alphanumeric characters
	return /(?<![/\w])graphql\s*`/.test(contents);
}

export interface RelayPluginOptions {
	/** Directory containing generated artifacts (if centralized) */
	artifactDirectory?: string;
	/** Enable dev mode with hash validation */
	devMode?: boolean;
	/** Enable debug logging */
	debug?: boolean;
}

export function relayPlugin(opts: RelayPluginOptions = {}): BunPlugin {
	const debug = opts.debug ?? false;

	return {
		name: "relay",
		setup(build) {
			build.onLoad({ filter: /\.tsx?$/ }, async (args) => {
				// Skip node_modules and generated files
				if (
					args.path.includes("node_modules") ||
					args.path.includes("__generated__")
				) {
					return undefined; // Let Bun handle it
				}

				const contents = await Bun.file(args.path).text();
				const loader = args.path.endsWith(".tsx") ? "tsx" : "ts";

				// Fast path: skip files without graphql tagged template literals
				// Must be a standalone graphql tag, not part of a URL like "/graphql"
				if (!hasGraphQLTag(contents)) {
					if (debug) console.log(`[relay] skipping ${args.path}`);
					return undefined; // Let Bun handle it natively
				}

				if (debug) console.log(`[relay] transforming ${args.path}`);

				const transformed = transformRelayGraphQL(
					args.path,
					contents,
					opts.artifactDirectory,
					opts.devMode ?? process.env.NODE_ENV !== "production",
				);

				return {
					contents: transformed,
					loader,
				};
			});
		},
	};
}

function transformRelayGraphQL(
	filePath: string,
	contents: string,
	artifactDirectory?: string,
	devMode = false,
): string {
	const imports: string[] = [];

	// Match graphql tagged template literals that aren't part of URLs
	// Uses negative lookbehind to avoid matching "/graphql`"
	const transformed = contents.replace(
		/(?<![/\w])graphql\s*`([\s\S]*?)`/gm,
		(match, query: string) => {
			// Skip commented graphql tags
			if (/^\s*\/\//.test(query)) {
				return match;
			}

			const ast = parse(query);

			if (ast.definitions.length !== 1 || !ast.definitions[0]) {
				throw new Error(
					`Expected exactly one definition per graphql tag in ${filePath}`,
				);
			}

			const definition = ast.definitions[0];
			if (
				definition.kind !== "FragmentDefinition" &&
				definition.kind !== "OperationDefinition"
			) {
				throw new Error(
					`Expected fragment, mutation, query, or subscription in ${filePath}, got ${definition.kind}`,
				);
			}

			const name = definition.name?.value;
			if (!name) {
				throw new Error(
					`GraphQL operations and fragments must have names in ${filePath}`,
				);
			}

			// Generate unique identifier based on content hash
			const hash = createHash("md5")
				.update(print(definition), "utf8")
				.digest("hex");
			const id = `graphql__${hash}`;

			// Determine import path
			const importFile = `${name}.graphql.ts`;
			const importPath = artifactDirectory
				? getRelativeImportPath(filePath, importFile, artifactDirectory)
				: `./__generated__/${importFile}`;

			imports.push(`import ${id} from "${importPath}";`);

			// In dev mode, add hash validation
			if (devMode) {
				return `(${id}.hash && ${id}.hash !== "${hash}" && console.error("The definition of '${name}' appears to have changed. Run relay-compiler to update."), ${id})`;
			}

			return id;
		},
	);

	if (imports.length === 0) {
		return contents;
	}

	return `${imports.join("\n")}\n${transformed}`;
}

function getRelativeImportPath(
	file: string,
	importFile: string,
	artifactDirectory: string,
): string {
	const relativePath = relative(dirname(file), resolve(artifactDirectory));
	const prefix =
		relativePath.length === 0 || !relativePath.startsWith(".") ? "./" : "";
	return prefix + join(relativePath, importFile);
}
