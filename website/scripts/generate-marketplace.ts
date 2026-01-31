/**
 * Generate public marketplace.json from source of truth
 *
 * Reads the source marketplace.json from .claude-plugin/marketplace.json
 * and transforms it to a public format with GitHub source references.
 */
import fs from "node:fs";
import path from "node:path";

interface SourcePlugin {
	name: string;
	description: string;
	source: string; // e.g., "./languages/typescript"
	category:
		| "Core"
		| "Language"
		| "Framework"
		| "Validation"
		| "Tool"
		| "Integration"
		| "Discipline"
		| "Pattern"
		| "Specialized";
	keywords: string[];
}

interface SourceMarketplace {
	name: string;
	owner: {
		name: string;
		url: string;
	};
	metadata: {
		description: string;
		version: string;
	};
	plugins: SourcePlugin[];
}

interface PublicPluginSource {
	type: "github";
	repo: string;
	path: string;
}

interface PublicPlugin {
	name: string;
	description: string;
	source: PublicPluginSource;
	category:
		| "Core"
		| "Language"
		| "Framework"
		| "Validation"
		| "Tool"
		| "Integration"
		| "Discipline"
		| "Pattern"
		| "Specialized";
	keywords: string[];
}

interface PublicMarketplace {
	name: string;
	owner: {
		name: string;
		url: string;
	};
	metadata: {
		description: string;
		version: string;
	};
	plugins: PublicPlugin[];
}

const REPO = "TheBushidoCollective/han";
const ROOT_DIR = path.join(process.cwd(), "..");

function transformMarketplace(source: SourceMarketplace): PublicMarketplace {
	const plugins: PublicPlugin[] = source.plugins.map((plugin) => ({
		name: plugin.name,
		description: plugin.description,
		source: {
			type: "github" as const,
			repo: REPO,
			path: plugin.source.replace("./", ""), // "./languages/typescript" -> "languages/typescript"
		},
		category: plugin.category,
		keywords: plugin.keywords,
	}));

	return {
		name: source.name,
		owner: source.owner,
		metadata: source.metadata,
		plugins,
	};
}

// Read source marketplace.json
const sourcePath = path.join(ROOT_DIR, ".claude-plugin", "marketplace.json");
const sourceData: SourceMarketplace = JSON.parse(
	fs.readFileSync(sourcePath, "utf-8"),
);

// Transform to public format
const publicMarketplace = transformMarketplace(sourceData);

// Write to website/public for web consumption
const publicDir = path.join(process.cwd(), "public");
if (!fs.existsSync(publicDir)) {
	fs.mkdirSync(publicDir, { recursive: true });
}

const outputPath = path.join(publicDir, "marketplace.json");
fs.writeFileSync(outputPath, JSON.stringify(publicMarketplace, null, 2));

console.log(`Public marketplace generated at ${outputPath}`);
console.log(`- ${publicMarketplace.plugins.length} plugins`);
console.log(
	`  - Core: ${publicMarketplace.plugins.filter((p) => p.category === "Core").length}`,
);
console.log(
	`  - Language: ${publicMarketplace.plugins.filter((p) => p.category === "Language").length}`,
);
console.log(
	`  - Framework: ${publicMarketplace.plugins.filter((p) => p.category === "Framework").length}`,
);
console.log(
	`  - Validation: ${publicMarketplace.plugins.filter((p) => p.category === "Validation").length}`,
);
console.log(
	`  - Tool: ${publicMarketplace.plugins.filter((p) => p.category === "Tool").length}`,
);
console.log(
	`  - Integration: ${publicMarketplace.plugins.filter((p) => p.category === "Integration").length}`,
);
console.log(
	`  - Discipline: ${publicMarketplace.plugins.filter((p) => p.category === "Discipline").length}`,
);
console.log(
	`  - Pattern: ${publicMarketplace.plugins.filter((p) => p.category === "Pattern").length}`,
);
console.log(
	`  - Specialized: ${publicMarketplace.plugins.filter((p) => p.category === "Specialized").length}`,
);
