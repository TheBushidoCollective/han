/**
 * Bun plugin for file-based routing (replaces vite-plugin-pages)
 *
 * Scans a pages directory and generates route definitions compatible with
 * react-router-dom's useRoutes hook.
 */
import { type Dirent, readdirSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import type { BunPlugin } from "bun";

export interface Route {
	path: string;
	file: string;
	children?: Route[];
}

export interface PagesPluginOptions {
	/** Directory containing page components */
	pagesDir: string;
	/** File extensions to consider as pages */
	extensions?: string[];
	/** Root directory for module resolution (where node_modules lives) */
	clientRoot?: string;
}

export function pagesPlugin(opts: PagesPluginOptions): BunPlugin {
	const extensions = opts.extensions ?? [".tsx"];
	const pagesDir = opts.pagesDir;
	// Get the browse-client root directory (where node_modules lives)
	// Use explicit clientRoot if provided, otherwise infer from pagesDir
	const clientRoot = opts.clientRoot ?? join(pagesDir, "..", "..");

	return {
		name: "pages",
		setup(build) {
			// Handle the virtual module import
			build.onResolve({ filter: /^~react-pages$/ }, () => ({
				path: "virtual:react-pages",
				namespace: "pages",
			}));

			// Generate routes module
			build.onLoad({ filter: /.*/, namespace: "pages" }, () => {
				const routes = scanPages(pagesDir, pagesDir, extensions);
				const code = generateRoutesCode(routes, pagesDir, clientRoot);

				return {
					contents: code,
					loader: "ts", // Use 'ts' not 'tsx' since we use createElement, not JSX
					// Resolve imports relative to clientRoot (finds node_modules)
					resolveDir: clientRoot,
				};
			});
		},
	};
}

function scanPages(
	dir: string,
	baseDir: string,
	extensions: string[],
): Route[] {
	const routes: Route[] = [];

	let entries: Dirent<string>[];
	try {
		entries = readdirSync(dir, { withFileTypes: true, encoding: "utf8" });
	} catch {
		return routes;
	}

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			// Check for index file in directory
			const indexFile = extensions
				.map((ext) => join(fullPath, `index${ext}`))
				.find((f) => {
					try {
						return statSync(f).isFile();
					} catch {
						return false;
					}
				});

			// Scan children - children paths are relative to THIS directory
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

			// Handle index files
			if (name === "index") {
				// Only include root-level index (maps to "/")
				// Nested index files are handled by their parent directory
				if (dir === baseDir) {
					routes.push({
						path: "", // Empty path becomes "/" when prefixed
						file: fullPath,
					});
				}
				continue;
			}

			// Path is relative to current baseDir (which is the parent directory)
			const routePath = convertPathToRoute(name);

			routes.push({
				path: routePath,
				file: fullPath,
			});
		}
	}

	// Sort: static routes before dynamic, then alphabetically
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
			// Convert [param] to :param
			if (segment.startsWith("[") && segment.endsWith("]")) {
				return `:${segment.slice(1, -1)}`;
			}
			return segment;
		})
		.join("/");
}

function generateRoutesCode(
	routes: Route[],
	_baseDir: string,
	clientRoot: string,
): string {
	const imports: string[] = [];
	const importMap = new Map<string, string>();
	let importCounter = 0;

	// Use explicit path to react to avoid resolution issues when running from different CWDs
	const reactPath = join(clientRoot, "node_modules", "react");

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
			// Use createElement instead of JSX to avoid jsx-runtime resolution issues
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

	// Flatten top-level routes for react-router
	const flatRoutes = flattenRoutes(routes);
	const routeObjects = flatRoutes.map((r) => generateRouteObject(r, true));

	return `import { createElement } from "${reactPath}";
${imports.join("\n")}

const routes = [
  ${routeObjects.join(",\n  ")}
];

export default routes;
`;
}

function flattenRoutes(routes: Route[], parentPath = ""): Route[] {
	const result: Route[] = [];

	for (const route of routes) {
		const fullPath = parentPath ? `${parentPath}/${route.path}` : route.path;

		if (route.file) {
			// Don't spread children - we want flat routes, not nested
			result.push({ path: fullPath, file: route.file });
		}

		if (route.children) {
			result.push(...flattenRoutes(route.children, fullPath));
		}
	}

	return result;
}
