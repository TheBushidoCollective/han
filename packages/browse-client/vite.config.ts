/**
 * Vite configuration for browse-client
 *
 * Provides true HMR with React Fast Refresh in dev mode.
 * Ports the Bun build plugins (relay, pages, rnw-compat) to Vite format.
 */
import { createHash } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { parse, print } from "graphql";
import { defineConfig } from "vite";

const projectRoot = resolve(import.meta.dirname);
const srcDir = join(projectRoot, "src");
const pagesDir = join(srcDir, "pages");

// =============================================================================
// Relay Plugin (Vite)
// =============================================================================

function hasGraphQLTag(contents: string): boolean {
	return /(?<![/\w])graphql\s*`/.test(contents);
}

function viteRelayPlugin() {
	return {
		name: "vite-relay",
		transform(code: string, id: string) {
			if (id.includes("node_modules") || id.includes("__generated__")) return;
			if (!/\.tsx?$/.test(id)) return;
			if (!hasGraphQLTag(code)) return;

			const imports: string[] = [];

			const transformed = code.replace(
				/(?<![/\w])graphql\s*`([\s\S]*?)`/gm,
				(match, query: string) => {
					if (/^\s*\/\//.test(query)) return match;

					const ast = parse(query);
					if (ast.definitions.length !== 1 || !ast.definitions[0]) {
						throw new Error(
							`Expected exactly one definition per graphql tag in ${id}`,
						);
					}

					const definition = ast.definitions[0];
					if (
						definition.kind !== "FragmentDefinition" &&
						definition.kind !== "OperationDefinition"
					) {
						throw new Error(
							`Expected fragment/mutation/query/subscription in ${id}, got ${definition.kind}`,
						);
					}

					const name = definition.name?.value;
					if (!name) {
						throw new Error(
							`GraphQL operations and fragments must have names in ${id}`,
						);
					}

					const hash = createHash("md5")
						.update(print(definition), "utf8")
						.digest("hex");
					const varName = `graphql__${hash}`;
					const importPath = `./__generated__/${name}.graphql.ts`;

					// Resolve import relative to the source file
					const fileDir = id.substring(0, id.lastIndexOf("/"));
					const absoluteImport = resolve(fileDir, importPath);
					imports.push(`import ${varName} from "${absoluteImport}";`);

					return `(${varName}.hash && ${varName}.hash !== "${hash}" && console.error("The definition of '${name}' appears to have changed. Run relay-compiler to update."), ${varName})`;
				},
			);

			if (imports.length === 0) return;

			return {
				code: `${imports.join("\n")}\n${transformed}`,
				map: null,
			};
		},
	};
}

// =============================================================================
// Pages Plugin (Vite) - File-based routing
// =============================================================================

interface Route {
	path: string;
	file: string;
	children?: Route[];
}

function scanPages(
	dir: string,
	baseDir: string,
	extensions: string[],
): Route[] {
	const routes: Route[] = [];
	let entries: ReturnType<typeof readdirSync>;
	try {
		entries = readdirSync(dir, { withFileTypes: true, encoding: "utf8" });
	} catch {
		return routes;
	}

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			const indexFile = extensions
				.map((ext) => join(fullPath, `index${ext}`))
				.find((f) => {
					try {
						return statSync(f).isFile();
					} catch {
						return false;
					}
				});

			const children = scanPages(fullPath, fullPath, extensions);

			if (indexFile || children.length > 0) {
				const dirPath = convertPathToRoute(relative(baseDir, fullPath));
				routes.push({
					path: dirPath,
					file: indexFile ?? "",
					children: children.length > 0 ? children : undefined,
				});
			}
		} else if (entry.isFile()) {
			const ext = extensions.find((e) => entry.name.endsWith(e));
			if (!ext) continue;

			const name = basename(entry.name, ext);
			if (name === "index") {
				if (dir === baseDir) {
					routes.push({ path: "", file: fullPath });
				}
				continue;
			}

			routes.push({
				path: convertPathToRoute(name),
				file: fullPath,
			});
		}
	}

	return routes.sort((a, b) => {
		const aIsDynamic = a.path.includes(":");
		const bIsDynamic = b.path.includes(":");
		if (aIsDynamic !== bIsDynamic) return aIsDynamic ? 1 : -1;
		return a.path.localeCompare(b.path);
	});
}

function convertPathToRoute(filePath: string): string {
	return filePath
		.split("/")
		.map((segment) => {
			if (segment.startsWith("[") && segment.endsWith("]")) {
				return `:${segment.slice(1, -1)}`;
			}
			return segment;
		})
		.join("/");
}

function flattenRoutes(routes: Route[], parentPath = ""): Route[] {
	const result: Route[] = [];
	for (const route of routes) {
		const fullPath = parentPath ? `${parentPath}/${route.path}` : route.path;
		if (route.file) {
			result.push({ path: fullPath, file: route.file });
		}
		if (route.children) {
			result.push(...flattenRoutes(route.children, fullPath));
		}
	}
	return result;
}

function generateRoutesCode(routes: Route[]): string {
	const imports: string[] = [];
	const importMap = new Map<string, string>();
	let importCounter = 0;

	function getImportName(file: string): string {
		if (!file) return "";
		const existing = importMap.get(file);
		if (existing) return existing;
		const name = `Page${importCounter++}`;
		importMap.set(file, name);
		imports.push(`import ${name} from "${file}";`);
		return name;
	}

	function generateRouteObject(route: Route, isRoot = false): string {
		const componentName = route.file ? getImportName(route.file) : null;
		const path = isRoot
			? `/${route.path}`
			: (route.path.split("/").pop() ?? "");
		const parts: string[] = [];
		parts.push(`path: "${path}"`);
		if (componentName) {
			parts.push(`element: createElement(${componentName})`);
		}
		if (route.children && route.children.length > 0) {
			const childrenCode = route.children
				.map((c) => generateRouteObject(c))
				.join(",\n    ");
			parts.push(`children: [\n    ${childrenCode}\n  ]`);
		}
		return `{ ${parts.join(", ")} }`;
	}

	const flatRoutes = flattenRoutes(routes);
	const routeObjects = flatRoutes.map((r) => generateRouteObject(r, true));

	return `import { createElement } from "react";
${imports.join("\n")}

const routes = [
  ${routeObjects.join(",\n  ")}
];

export default routes;
`;
}

function vitePagesPlugin() {
	const virtualModuleId = "~react-pages";
	const resolvedVirtualModuleId = `\0${virtualModuleId}`;

	return {
		name: "vite-pages",
		resolveId(id: string) {
			if (id === virtualModuleId) return resolvedVirtualModuleId;
		},
		load(id: string) {
			if (id === resolvedVirtualModuleId) {
				const routes = scanPages(pagesDir, pagesDir, [".tsx"]);
				return generateRoutesCode(routes);
			}
		},
	};
}

// =============================================================================
// RNW Compat Plugin (Vite) - inline-style-prefixer CJS/ESM fix
// =============================================================================

function viteRnwCompatPlugin() {
	return {
		name: "vite-rnw-compat",
		transform(code: string, id: string) {
			if (!/(prefixStyles|inline-style-prefixer.*plugins).*\.js$/.test(id))
				return;

			let transformed = code;
			transformed = transformed.replace(
				/(['"])inline-style-prefixer\/lib\//g,
				"$1inline-style-prefixer/es/",
			);
			transformed = transformed.replace(
				/(['"])css-in-js-utils\/lib\//g,
				"$1css-in-js-utils/es/",
			);

			if (transformed === code) return;
			return { code: transformed, map: null };
		},
	};
}

// =============================================================================
// Vite Config
// =============================================================================

export default defineConfig({
	root: projectRoot,
	plugins: [
		react(),
		viteRelayPlugin(),
		vitePagesPlugin(),
		viteRnwCompatPlugin(),
	],
	resolve: {
		alias: {
			"react-native": "react-native-web",
			"@": srcDir,
		},
		extensions: [".web.tsx", ".web.ts", ".web.js", ".tsx", ".ts", ".js"],
	},
	define: {
		global: "globalThis",
	},
	server: {
		port: 3000,
		host: true,
	},
});
