import fs from "node:fs";
import path from "node:path";
import { buildSearchIndex } from "../lib/search";

// Generate the search index and save it as a static JSON file
const index = buildSearchIndex();

// Extract just what we need for autocomplete
const autocompleteData = {
	plugins: index.entries.map((entry) => ({
		name: entry.name,
		category: entry.category,
		path: entry.path,
	})),
	tags: index.tags.map((tag) => tag.name),
};

// Create public directory if it doesn't exist
const publicDir = path.join(process.cwd(), "public");
if (!fs.existsSync(publicDir)) {
	fs.mkdirSync(publicDir, { recursive: true });
}

// Write the index to a static JSON file
const outputPath = path.join(publicDir, "search-index.json");
fs.writeFileSync(outputPath, JSON.stringify(autocompleteData, null, 2));

console.log(`Search index generated at ${outputPath}`);
console.log(`- ${autocompleteData.plugins.length} plugins`);
console.log(`- ${autocompleteData.tags.length} tags`);
